import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

const API_URL = "http://127.0.0.1:8000";

export default function App() {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [ingestStatus, setIngestStatus] = useState(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [docs, setDocs] = useState([]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ingestUrl = async () => {
    if (!url.trim()) return;
    setIngestLoading(true);
    setIngestStatus(null);
    try {
      const res = await axios.post(`${API_URL}/ingest/url`, { url });
      setIngestStatus({ type: "success", msg: `✓ ${res.data.chunks_created} chunks ingested from URL` });
      setDocs((prev) => [...prev, { name: url.split("/").pop() || url, type: "url" }]);
      setUrl("");
    } catch (err) {
      setIngestStatus({ type: "error", msg: err.response?.data?.detail || "URL ingestion failed" });
    }
    setIngestLoading(false);
  };

  const ingestPdf = async () => {
    if (!file) return;
    setIngestLoading(true);
    setIngestStatus(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API_URL}/ingest/pdf`, formData);
      setIngestStatus({ type: "success", msg: `✓ ${res.data.chunks_created} chunks ingested from PDF` });
      setDocs((prev) => [...prev, { name: file.name, type: "pdf" }]);
      setFile(null);
      document.querySelector('input[type="file"]').value = "";
    } catch (err) {
      setIngestStatus({ type: "error", msg: err.response?.data?.detail || "PDF ingestion failed" });
    }
    setIngestLoading(false);
  };

  const sendQuery = async () => {
    if (!question.trim() || queryLoading) return;
    const q = question.trim();
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setQueryLoading(true);
    try {
      const res = await axios.post(`${API_URL}/query`, { question: q });
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: res.data.answer,
          sources: res.data.sources,
          confidence: res.data.confidence,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Something went wrong. Please try again.", sources: [], confidence: "low" },
      ]);
    }
    setQueryLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  };

  return (
    <div style={styles.root}>
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>⬡</span>
          <span style={styles.logoText}>DocuSphere</span>
        </div>
        <p style={styles.logoSub}>AI Documentation Assistant</p>
        <div style={styles.divider} />
        <p style={styles.sectionLabel}>INGEST URL</p>
        <input
          style={styles.input}
          placeholder="https://docs.example.com/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ingestUrl()}
        />
        <button
          style={{ ...styles.btn, opacity: ingestLoading ? 0.6 : 1 }}
          onClick={ingestUrl}
          disabled={ingestLoading}
        >
          {ingestLoading ? "Ingesting..." : "Ingest URL"}
        </button>
        <p style={{ ...styles.sectionLabel, marginTop: "1.25rem" }}>UPLOAD PDF</p>
        <label style={styles.fileLabel}>
          <input
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files[0])}
          />
          {file ? file.name : "Choose PDF file"}
        </label>
        <button
          style={{ ...styles.btn, opacity: !file || ingestLoading ? 0.5 : 1 }}
          onClick={ingestPdf}
          disabled={!file || ingestLoading}
        >
          {ingestLoading ? "Ingesting..." : "Ingest PDF"}
        </button>
        {ingestStatus && (
          <div style={{ ...styles.statusBox, background: ingestStatus.type === "success" ? "#0f2d1a" : "#2d0f0f", color: ingestStatus.type === "success" ? "#4ade80" : "#f87171" }}>
            {ingestStatus.msg}
          </div>
        )}
        <div style={styles.divider} />
        <p style={styles.sectionLabel}>INGESTED DOCS</p>
        {docs.length === 0 ? (
          <p style={styles.emptyDocs}>No documents yet</p>
        ) : (
          docs.map((d, i) => (
            <div key={i} style={styles.docItem}>
              <span style={styles.docIcon}>{d.type === "pdf" ? "📄" : "🔗"}</span>
              <span style={styles.docName}>{d.name}</span>
            </div>
          ))
        )}
      </div>

      <div style={styles.main}>
        <div style={styles.chatHeader}>
          <p style={styles.chatTitle}>Ask your documentation</p>
          <p style={styles.chatSub}>Answers are grounded in your ingested documents only</p>
        </div>
        <div style={styles.messages}>
          {messages.length === 0 && (
            <div style={styles.emptyChat}>
              <p style={styles.emptyChatIcon}>⬡</p>
              <p style={styles.emptyChatText}>Ingest a document and start asking questions</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ ...styles.msgRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={msg.role === "user" ? styles.userBubble : styles.aiBubble}>
                {msg.role === "ai" ? (
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                ) : (
                  <p style={styles.msgText}>{msg.text}</p>
                )}
                {msg.role === "ai" && msg.sources && msg.sources.length > 0 && (
                  <div style={styles.sources}>
                    {msg.sources.map((s, si) => (
                      <details key={si} style={styles.sourceItem}>
                        <summary style={styles.sourceSummary}>📎 {s.document.split("/").pop() || s.document}</summary>
                        <p style={styles.sourceExcerpt}>{s.excerpt}</p>
                      </details>
                    ))}
                  </div>
                )}
                {msg.role === "ai" && (
                  <span style={{ ...styles.confidenceBadge, background: msg.confidence === "high" ? "#0f2d1a" : "#2d0f0f", color: msg.confidence === "high" ? "#4ade80" : "#f87171" }}>
                    {msg.confidence === "high" ? "✓ Grounded" : "⚠ No match"}
                  </span>
                )}
              </div>
            </div>
          ))}
          {queryLoading && (
            <div style={{ ...styles.msgRow, justifyContent: "flex-start" }}>
              <div style={styles.aiBubble}>
                <p style={{ ...styles.msgText, opacity: 0.5 }}>Thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div style={styles.inputRow}>
          <textarea
            style={styles.chatInput}
            placeholder="Ask a question about your documentation..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            style={{ ...styles.sendBtn, opacity: !question.trim() || queryLoading ? 0.4 : 1 }}
            onClick={sendQuery}
            disabled={!question.trim() || queryLoading}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: { display: "flex", height: "100vh", background: "#0a0a0a", color: "#e5e5e5", fontFamily: "'Segoe UI', sans-serif" },
  sidebar: { width: "280px", minWidth: "280px", background: "#111111", borderRight: "1px solid #222", padding: "1.5rem 1.25rem", overflowY: "auto", display: "flex", flexDirection: "column" },
  logo: { display: "flex", alignItems: "center", gap: "8px" },
  logoIcon: { fontSize: "22px", color: "#6366f1" },
  logoText: { fontSize: "18px", fontWeight: "600", color: "#fff" },
  logoSub: { fontSize: "12px", color: "#555", marginTop: "4px" },
  divider: { borderTop: "1px solid #222", margin: "1.25rem 0" },
  sectionLabel: { fontSize: "10px", fontWeight: "600", letterSpacing: "0.1em", color: "#444", marginBottom: "8px" },
  input: { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "8px 12px", color: "#e5e5e5", fontSize: "13px", outline: "none", boxSizing: "border-box", marginBottom: "8px" },
  btn: { width: "100%", background: "#6366f1", border: "none", borderRadius: "8px", padding: "9px", color: "#fff", fontSize: "13px", fontWeight: "500", cursor: "pointer" },
  fileLabel: { display: "block", width: "100%", background: "#1a1a1a", border: "1px dashed #2a2a2a", borderRadius: "8px", padding: "8px 12px", color: "#555", fontSize: "13px", cursor: "pointer", boxSizing: "border-box", marginBottom: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  statusBox: { marginTop: "10px", padding: "8px 12px", borderRadius: "8px", fontSize: "12px" },
  emptyDocs: { fontSize: "12px", color: "#333" },
  docItem: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid #1a1a1a" },
  docIcon: { fontSize: "14px" },
  docName: { fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  chatHeader: { padding: "1.25rem 1.5rem", borderBottom: "1px solid #1a1a1a" },
  chatTitle: { fontSize: "16px", fontWeight: "600", color: "#fff" },
  chatSub: { fontSize: "12px", color: "#444", marginTop: "2px" },
  messages: { flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "12px" },
  emptyChat: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.3, marginTop: "6rem" },
  emptyChatIcon: { fontSize: "48px", marginBottom: "12px" },
  emptyChatText: { fontSize: "14px", color: "#888" },
  msgRow: { display: "flex" },
  userBubble: { background: "#6366f1", borderRadius: "16px 16px 4px 16px", padding: "10px 16px", maxWidth: "70%" },
  aiBubble: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "16px 16px 16px 4px", padding: "10px 16px", maxWidth: "75%" },
 msgText: { fontSize: "14px", lineHeight: "1.6", margin: 0, wordBreak: "break-word" },
  sources: { marginTop: "10px", borderTop: "1px solid #2a2a2a", paddingTop: "8px" },
  sourceItem: { marginBottom: "4px" },
  sourceSummary: { fontSize: "11px", color: "#6366f1", cursor: "pointer" },
  sourceExcerpt: { fontSize: "11px", color: "#555", marginTop: "4px", lineHeight: "1.5", paddingLeft: "8px" },
  confidenceBadge: { display: "inline-block", fontSize: "10px", padding: "2px 8px", borderRadius: "20px", marginTop: "8px" },
  inputRow: { padding: "1rem 1.5rem", borderTop: "1px solid #1a1a1a", display: "flex", gap: "10px", alignItems: "flex-end" },
  chatInput: { flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "12px 16px", color: "#e5e5e5", fontSize: "14px", outline: "none", resize: "none", fontFamily: "inherit" },
  sendBtn: { width: "42px", height: "42px", background: "#6366f1", border: "none", borderRadius: "12px", color: "#fff", fontSize: "18px", cursor: "pointer", flexShrink: 0 },
};