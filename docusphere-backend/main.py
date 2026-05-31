from langchain_huggingface import HuggingFaceEmbeddings
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.prompts import PromptTemplate
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import chromadb
import pdfplumber
import httpx
from bs4 import BeautifulSoup
import os
import tempfile

# ===== 1. ENVIRONMENT SETUP =====
load_dotenv()
if not os.getenv("GROQ_API_KEY"):
    print("ERROR: .env me GROQ_API_KEY missing hai!")
    exit()

app = FastAPI(title="DocuSphere AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== 2. PYDANTIC MODELS =====
class UrlRequest(BaseModel):
    url: str

class QueryRequest(BaseModel):
    question: str

# ===== 3. MODELS + DB SETUP =====
print("Loading models...")

embeddings = HuggingFaceEmbeddings(model_name="all-mpnet-base-v2")
chroma_client = chromadb.PersistentClient(path="./my_local_db")
vectorstore = Chroma(
    client=chroma_client,
    collection_name="docusphere_collection",
    embedding_function=embeddings,
    collection_metadata={"hnsw:space": "cosine"}
)

retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 5}
)

llm = ChatGroq(
    model="llama-3.1-8b-instant",
    temperature=0.1
)

print("Server ready!")

# ===== 4. PROMPT TEMPLATE =====
PROMPT_TEMPLATE = """You are a helpful documentation assistant.
Read the context carefully and answer the question directly.
Extract specific facts, numbers, names from the context.
If the information is present anywhere in the context, use it.
Only say "I cannot find this in the provided documentation" if the information is truly absent.

Context:
{context}

Question:
{question}

Answer:"""

prompt = PromptTemplate(
    template=PROMPT_TEMPLATE,
    input_variables=["context", "question"]
)

# ===== 5. QA CHAIN =====
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=retriever,
    return_source_documents=True,
    chain_type_kwargs={"prompt": prompt}
)

# ===== 6. IN-MEMORY TRACKER =====
ingested_docs = []

# ===== 7. DYNAMIC CHUNK SIZE =====
# Document size ke hisaab se automatically chunk size decide karta hai
# Resume/short doc → 150 chars (ek line per chunk — better precision)
# Medium doc → 500 chars (paragraph level)
# Large doc → 1000 chars (multi-paragraph — preserve context)
def get_chunk_size(text: str):
    length = len(text)
    if length < 2000:
        return 150, 50
    elif length < 50000:
        return 500, 150
    else:
        return 1000, 200


# ===== API ENDPOINTS =====

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "DocuSphere backend is running"}


@app.post("/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        raw_text = ""
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    raw_text += page_text + "\n"

        os.unlink(tmp_path)

        if not raw_text.strip():
            raise HTTPException(
                status_code=422,
                detail="PDF se text extract nahi hua. Scanned image PDF ho sakta hai."
            )

        # Dynamic chunking — document size ke hisaab se
        chunk_size, chunk_overlap = get_chunk_size(raw_text)
        print(f"PDF size: {len(raw_text)} chars | chunk_size: {chunk_size} | overlap: {chunk_overlap}")

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )

        chunks = text_splitter.split_text(raw_text)

        vectorstore.add_texts(
            texts=chunks,
            metadatas=[{
                "source": file.filename,
                "type": "pdf",
                "chunk_index": i
            } for i in range(len(chunks))]
        )

        ingested_docs.append({
            "name": file.filename,
            "type": "pdf",
            "chunks": len(chunks),
            "chunk_size": chunk_size
        })

        return {
            "message": "PDF successfully ingested",
            "filename": file.filename,
            "chunks_created": len(chunks),
            "chunk_size_used": chunk_size
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF ingestion failed: {str(e)}")


@app.post("/ingest/url")
async def ingest_url(request: UrlRequest):
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL required")

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(url)

        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="URL not found (404)")
        if response.status_code == 403:
            raise HTTPException(status_code=403, detail="Access denied (403) — paywall ya login required")
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail=f"URL fetch failed: HTTP {response.status_code}")

        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
            tag.decompose()

        raw_text = soup.get_text(separator="\n", strip=True)

        if not raw_text.strip():
            raise HTTPException(status_code=422, detail="URL se meaningful text extract nahi hua")

        # Dynamic chunking
        chunk_size, chunk_overlap = get_chunk_size(raw_text)
        print(f"URL size: {len(raw_text)} chars | chunk_size: {chunk_size} | overlap: {chunk_overlap}")

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )

        chunks = text_splitter.split_text(raw_text)

        vectorstore.add_texts(
            texts=chunks,
            metadatas=[{
                "source": url,
                "type": "url",
                "chunk_index": i
            } for i in range(len(chunks))]
        )

        doc_name = url.split("/")[-1] or url
        ingested_docs.append({
            "name": doc_name,
            "type": "url",
            "url": url,
            "chunks": len(chunks),
            "chunk_size": chunk_size
        })

        return {
            "message": "URL successfully ingested",
            "url": url,
            "chunks_created": len(chunks),
            "chunk_size_used": chunk_size
        }

    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="URL fetch timeout — site respond nahi kar raha")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"URL ingestion failed: {str(e)}")


@app.post("/query")
async def query_docs(request: QueryRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question required")

    try:
        # Query rewriting — natural language ko key terms mein convert karo
        # Better retrieval ke liye — "Which college does Adarsh study in?" → "Adarsh college university"
        rewrite_prompt = f"""Convert this question into 3-5 key search terms only. No sentences, just keywords.
Question: {question}
Keywords:"""

        rewrite_response = llm.invoke(rewrite_prompt)
        search_query = rewrite_response.content.strip()

        print(f"\n=== ORIGINAL: {question} ===")
        print(f"=== REWRITTEN: {search_query} ===")

        # Rewritten query se similarity search
        docs_with_scores = vectorstore.similarity_search_with_score(search_query, k=5)

        print("Scores:")
        for doc, score in docs_with_scores:
            print(f"  Score: {score:.4f} | {doc.page_content[:80]}")
        print("=" * 40)

        # Confidence gate
        # Cosine similarity: higher = better (0 to 1)
        # Score < 0.3 matlab koi relevant chunk nahi mila — LLM call nahi karni
        if not docs_with_scores or docs_with_scores[0][1] < 0.3:
            return {
                "answer": "I cannot find relevant information for this query in the provided documentation.",
                "sources": [],
                "confidence": "low"
            }

        # Original question se generate karo — better answer quality
        response = qa_chain.invoke({"query": question})

        sources = []
        seen = set()
        for doc in response.get("source_documents", []):
            source_name = doc.metadata.get("source", "Unknown")
            if source_name not in seen:
                seen.add(source_name)
                sources.append({
                    "document": source_name,
                    "excerpt": doc.page_content[:200] + "..."
                })

        return {
            "answer": response["result"],
            "sources": sources,
            "confidence": "high"
        }

    except Exception as e:
        import traceback
        traceback.print_exc()

        error_msg = str(e).lower()
        if "429" in error_msg or "rate limit" in error_msg:
            raise HTTPException(status_code=429, detail="API overloaded. Thodi der baad try karo.")
        elif "timeout" in error_msg:
            raise HTTPException(status_code=504, detail="AI model timeout.")
        else:
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.get("/documents")
def list_documents():
    return {
        "documents": ingested_docs,
        "total": len(ingested_docs)
    }



# cd C:\Users\Adarsh\OneDrive\Desktop\docusphere-frontend