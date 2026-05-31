# ⬡ DocuSphere AI

> **RAG-powered documentation assistant** — ingest any PDF or URL, then chat with your docs using AI.

Built with **FastAPI + LangChain + ChromaDB** on the backend and **React** on the frontend.

---

## 🖥️ Demo

| Sidebar — Ingest Docs | Chat — Ask Questions |
|---|---|
| Upload PDFs or paste URLs | Get grounded, sourced answers |

---

## 🏗️ Architecture

```
docusphere/
├── backend/          # FastAPI + LangChain RAG pipeline
│   ├── main.py       # API endpoints + RAG logic
│   ├── run_server.py # Uvicorn server entry point
│   ├── requirements.txt
│   └── .env          # API keys (not committed)
│
└── frontend/         # React chat interface
    ├── src/
    │   ├── App.js    # Main UI component
    │   └── index.css # Tailwind CSS
    └── package.json
```

---

## ⚙️ How It Works

1. **Ingest** — User uploads a PDF or pastes a URL
2. **Chunk** — Text is split dynamically based on document size (150–1000 chars per chunk)
3. **Embed** — Chunks are embedded using `all-mpnet-base-v2` (HuggingFace)
4. **Store** — Embeddings stored in ChromaDB (local persistent vector store)
5. **Query** — User asks a question → query is rewritten into keywords → similarity search → LLM answers using retrieved context
6. **Respond** — Answer returned with source excerpts and confidence badge

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Groq API Key](https://console.groq.com/keys) (free)

---

### Backend Setup

```bash
# 1. Go to backend folder
cd backend

# 2. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create .env file
GROQ_API_KEY=your_groq_api_key_here

# 5. Start server
python run_server.py
```

Backend runs at `http://127.0.0.1:8000`

---

### Frontend Setup

```bash
# 1. Go to frontend folder
cd frontend

# 2. Install dependencies
npm install

# 3. Start dev server
npm start
```

Frontend runs at `http://localhost:3000`

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `POST` | `/ingest/pdf` | Upload and ingest a PDF file |
| `POST` | `/ingest/url` | Ingest content from a URL |
| `POST` | `/query` | Ask a question against ingested docs |
| `GET` | `/documents` | List all ingested documents |

---

## 🧠 Tech Stack

### Backend
| Tool | Purpose |
|---|---|
| FastAPI | REST API framework |
| LangChain | RAG pipeline orchestration |
| ChromaDB | Local vector database |
| HuggingFace (`all-mpnet-base-v2`) | Text embeddings |
| Groq (`llama-3.1-8b-instant`) | LLM for answer generation |
| pdfplumber | PDF text extraction |
| httpx + BeautifulSoup | URL scraping |

### Frontend
| Tool | Purpose |
|---|---|
| React 18 | UI framework |
| Axios | API calls |
| react-markdown | Render AI responses with formatting |
| react-dropzone | Drag-and-drop PDF upload |
| Tailwind CSS | Styling |

---

## ✨ Features

- 📄 **PDF Ingestion** — Upload any text-based PDF
- 🔗 **URL Ingestion** — Scrape and ingest any public webpage
- 💬 **Chat Interface** — ChatGPT-style conversation UI
- 🔍 **Query Rewriting** — Questions auto-converted to search keywords for better retrieval
- 📎 **Source Citations** — Every answer shows which document it came from
- ✅ **Confidence Badge** — "Grounded" or "No match" shown per response
- ⚡ **Dynamic Chunking** — Chunk size auto-adjusts based on document length

---

## 🔒 Environment Variables

Create a `.env` file in the `backend/` folder:

```env
GROQ_API_KEY=your_groq_api_key_here
```

## 📌 Notes

- ChromaDB stores data locally in `backend/my_local_db/` — this folder is excluded from git
- The embedding model (`all-mpnet-base-v2`) downloads automatically on first run (~420MB)
- Scanned/image PDFs are not supported — only text-based PDFs work

---

## 👨‍💻 Author

**Adarsh Beriwala**  
[GitHub](https://github.com/Adarsh-Beriwala)