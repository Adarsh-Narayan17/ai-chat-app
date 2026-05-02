import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const authHeader = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  return { Authorization: `Bearer ${user?.token}` };
};

// ✅ AI Personas config
const PERSONAS = [
  { id: "default",      label: "Claira",           icon: "◈", desc: "General assistant" },
  { id: "coder",        label: "Coding Assistant",  icon: "💻", desc: "Code & debugging" },
  { id: "teacher",      label: "Teacher",           icon: "📚", desc: "Explain & simplify" },
  { id: "writer",       label: "Creative Writer",   icon: "✍️", desc: "Stories & essays" },
  { id: "interviewer",  label: "Interview Coach",   icon: "🎯", desc: "Job prep & tips" },
];

export default function Chat() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [image, setImage] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  // ✅ Persona state
  const [persona, setPersona] = useState("default");
  const [showPersonas, setShowPersonas] = useState(false);

  // ✅ Voice input state
  const [isListening, setIsListening] = useState(false);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => { fetchHistory(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ✅ Setup Web Speech API for voice input
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join("");
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return alert("Voice input not supported in this browser. Try Chrome.");
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await axios.get("/api/chat/history", { headers: authHeader() });
      setChatHistory(data);
    } catch (err) { console.error("fetchHistory error:", err.response?.data || err.message); }
  };

  const loadChat = async (id) => {
    try {
      const { data } = await axios.get(`/api/chat/${id}`, { headers: authHeader() });
      setChatId(data._id);
      setMessages(data.messages);
    } catch (err) { console.error("loadChat error:", err.response?.data || err.message); }
  };

  const newChat = () => { setChatId(null); setMessages([]); setInput(""); setImage(null); };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    try {
      await axios.delete(`/api/chat/${id}`, { headers: authHeader() });
      if (chatId === id) newChat();
      setChatHistory((prev) => prev.filter((c) => c._id !== id));
    } catch (err) { console.error(err); }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setImage({ base64: dataUrl.split(",")[1], mimeType: file.type, preview: dataUrl, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ✅ Streaming send message
  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && !image) || loading) return;

    const userMsg = { role: "user", content: text || "What's in this image?", imagePreview: image?.preview || null };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const imgToSend = image;
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(true);

    // Add streaming placeholder
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      const token = JSON.parse(localStorage.getItem("user"))?.token;
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: text,
          chatId,
          imageBase64: imgToSend?.base64 || null,
          imageMimeType: imgToSend?.mimeType || null,
          persona,  // ✅ send selected persona
        }),
      });

      if (!response.ok) throw new Error("Request failed");

      const newChatId = response.headers.get("X-Chat-Id");
      if (newChatId && !chatId) setChatId(newChatId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) {
              fullText += parsed.text;
              // ✅ Update streaming message word by word
              setMessages((prev) => prev.map((m) => m.streaming ? { ...m, content: fullText } : m));
            }
            if (parsed.done) { setChatId(parsed.chatId); fetchHistory(); }
            if (parsed.error) throw new Error(parsed.error);
          } catch (_) {}
        }
      }

      // Remove streaming flag
      setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false } : m));
    } catch (err) {
      setMessages((prev) => prev.map((m) =>
        m.streaming ? { ...m, content: "⚠️ Something went wrong. Please try again.", streaming: false } : m
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const autoResize = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  const currentPersona = PERSONAS.find((p) => p.id === persona);
  const isDark = theme === "dark";

  return (
    <div style={styles.layout} onClick={() => setShowPersonas(false)}>
      {/* Sidebar */}
      <aside style={{ ...styles.sidebar, width: sidebarOpen ? 260 : 0, overflow: "hidden" }}>
        <div style={styles.sidebarInner}>
          <div style={styles.sidebarHeader}>
            <div style={styles.logo}>
              <span style={{ color: "var(--accent)", fontSize: 20 }}>◈</span>
              <span style={styles.logoText}>Claira</span>
            </div>
          </div>
          <button onClick={newChat} style={styles.newChatBtn}><span>+</span> New Chat</button>
          <div style={styles.historyLabel}>Recent</div>
          <div style={styles.historyList}>
            {chatHistory.length === 0 && <p style={styles.emptyHistory}>No chats yet</p>}
            {chatHistory.map((c) => (
              <div key={c._id} onClick={() => loadChat(c._id)}
                style={{ ...styles.historyItem, ...(chatId === c._id ? styles.historyItemActive : {}) }}>
                <span style={styles.historyIcon}>💬</span>
                <span style={styles.historyTitle}>{c.title}</span>
                <button onClick={(e) => deleteChat(e, c._id)} style={styles.deleteBtn}>✕</button>
              </div>
            ))}
          </div>
          <div style={styles.userSection}>
            <div style={styles.userAvatar}>{user.name[0].toUpperCase()}</div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={styles.userName}>{user.name}</div>
              <div style={styles.userEmail}>{user.email}</div>
            </div>
            <button onClick={() => setTheme(isDark ? "light" : "dark")} style={styles.iconBtn} title="Toggle theme">
              {isDark ? "☀️" : "🌙"}
            </button>
            <button onClick={logout} style={styles.iconBtn} title="Logout">⏻</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        {/* Topbar */}
        <div style={styles.topbar}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={styles.menuBtn}>
            {sidebarOpen ? "←" : "☰"}
          </button>
          <span style={styles.topbarTitle}>
            {chatId ? chatHistory.find((c) => c._id === chatId)?.title || "Chat" : "New Chat"}
          </span>

          {/* ✅ Persona picker in topbar */}
          <div style={{ marginLeft: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPersonas(!showPersonas)} style={styles.personaBtn}>
              <span>{currentPersona.icon}</span>
              <span style={{ fontSize: 13 }}>{currentPersona.label}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
            </button>
            {showPersonas && (
              <div style={styles.personaDropdown}>
                {PERSONAS.map((p) => (
                  <button key={p.id} onClick={() => { setPersona(p.id); setShowPersonas(false); }}
                    style={{ ...styles.personaOption, ...(persona === p.id ? styles.personaOptionActive : {}) }}>
                    <span style={{ fontSize: 16 }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.desc}</div>
                    </div>
                    {persona === p.id && <span style={{ marginLeft: "auto", color: "var(--accent)" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!sidebarOpen && (
            <button onClick={() => setTheme(isDark ? "light" : "dark")} style={styles.menuBtn}>
              {isDark ? "☀️" : "🌙"}
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={styles.messagesArea}>
          {messages.length === 0 && (
            <div style={styles.emptyState} className="fade-up">
              <div style={{ fontSize: 40, marginBottom: 12 }}>{currentPersona.icon}</div>
              <h2 style={styles.emptyTitle}>Hi, {user.name.split(" ")[0]}!</h2>
              <p style={styles.emptySubtitle}>
                {persona === "default" && "Ask me anything — powered by Gemini AI"}
                {persona === "coder" && "Paste your code or ask a tech question"}
                {persona === "teacher" && "Ask me to explain anything simply"}
                {persona === "writer" && "Let's create something amazing together"}
                {persona === "interviewer" && "Let's prepare for your next interview"}
              </p>
              <div style={styles.suggestions}>
                {persona === "default" && ["Explain quantum computing", "Write a Python script", "Plan my week", "Tell me a joke"].map((s) => (
                  <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }} style={styles.suggBtn}>{s}</button>
                ))}
                {persona === "coder" && ["Fix this bug", "Explain Big O notation", "Write a REST API", "Review my code"].map((s) => (
                  <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }} style={styles.suggBtn}>{s}</button>
                ))}
                {persona === "teacher" && ["Explain recursion simply", "What is machine learning?", "How does the internet work?", "Teach me SQL"].map((s) => (
                  <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }} style={styles.suggBtn}>{s}</button>
                ))}
                {persona === "writer" && ["Write a short story", "Help me with my essay", "Write a poem about coding", "Give me writing tips"].map((s) => (
                  <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }} style={styles.suggBtn}>{s}</button>
                ))}
                {persona === "interviewer" && ["Mock interview for React dev", "Review my answer", "Common HR questions", "How to answer weakness question"].map((s) => (
                  <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }} style={styles.suggBtn}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ ...styles.messageRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }} className="fade-up">
              {msg.role === "assistant" && (
                <div style={styles.aiAvatar}>{currentPersona.icon}</div>
              )}
              <div style={{ ...styles.bubble, ...(msg.role === "user" ? styles.userBubble : styles.aiBubble) }}>
                {msg.imagePreview && (
                  <img src={msg.imagePreview} alt="uploaded"
                    style={{ maxWidth: 220, maxHeight: 180, borderRadius: 8, display: "block", marginBottom: msg.content ? 8 : 0 }} />
                )}
                {msg.role === "assistant" ? (
                  <div className="ai-content">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {/* ✅ Blinking cursor while streaming */}
                    {msg.streaming && <span style={styles.cursor}>▋</span>}
                  </div>
                ) : msg.content}
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div style={{ ...styles.messageRow, justifyContent: "flex-start" }}>
              <div style={styles.aiAvatar}>{currentPersona.icon}</div>
              <div style={{ ...styles.bubble, ...styles.aiBubble }}>
                <div style={styles.typingDots}>
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={styles.inputArea}>
          {image && (
            <div style={styles.imagePreviewBar}>
              <img src={image.preview} alt="preview" style={styles.imageThumb} />
              <span style={styles.imageName}>{image.name}</span>
              <button onClick={removeImage} style={styles.removeImgBtn}>✕</button>
            </div>
          )}
          <div style={styles.inputBox}>
            {/* ✅ Image upload */}
            <button onClick={() => fileInputRef.current?.click()} style={styles.attachBtn} title="Upload image">📎</button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageSelect} style={{ display: "none" }} />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(e); }}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "🎙 Listening..." : image ? "Ask about this image..." : `Message ${currentPersona.label}...`}
              rows={1}
              style={{ ...styles.textarea, ...(isListening ? { color: "var(--accent)" } : {}) }}
            />

            {/* ✅ Voice input button */}
            <button onClick={toggleVoice} style={{ ...styles.attachBtn, color: isListening ? "var(--accent)" : "var(--text-muted)" }} title="Voice input">
              {isListening ? "⏹" : "🎙"}
            </button>

            <button onClick={sendMessage} disabled={(!input.trim() && !image) || loading}
              style={{ ...styles.sendBtn, opacity: ((!input.trim() && !image) || loading) ? 0.4 : 1 }}>
              ↑
            </button>
          </div>
          <p style={styles.hint}>Enter to send · Shift+Enter for newline · 📎 image · 🎙 voice</p>
        </div>
      </main>

      <style>{`
        .typing-dot { width:6px;height:6px;border-radius:50%;background:var(--text-secondary);display:inline-block;animation:pulse 1.2s ease-in-out infinite; }
        .typing-dot:nth-child(2){animation-delay:.2s}
        .typing-dot:nth-child(3){animation-delay:.4s}
        textarea:focus{outline:none;}
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}

const styles = {
  layout: { display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" },
  sidebar: { background: "var(--bg-secondary)", borderRight: "1px solid var(--border)", transition: "width 0.25s ease", flexShrink: 0 },
  sidebarInner: { width: 260, height: "100%", display: "flex", flexDirection: "column", padding: "20px 16px" },
  sidebarHeader: { marginBottom: 20 },
  logo: { display: "flex", alignItems: "center", gap: 8 },
  logoText: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px" },
  newChatBtn: { background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", color: "var(--accent)", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, marginBottom: 20, width: "100%" },
  historyLabel: { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 },
  historyList: { flex: 1, overflowY: "auto" },
  emptyHistory: { color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" },
  historyItem: { display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2, color: "var(--text-secondary)", fontSize: 13 },
  historyItemActive: { background: "var(--accent-dim)", color: "var(--text-primary)" },
  historyIcon: { fontSize: 12, flexShrink: 0 },
  historyTitle: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  deleteBtn: { background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, padding: "2px 4px", borderRadius: 4 },
  userSection: { display: "flex", alignItems: "center", gap: 6, padding: "12px 8px", borderTop: "1px solid var(--border)", marginTop: 8 },
  userAvatar: { width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff", flexShrink: 0 },
  userName: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  userEmail: { fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  iconBtn: { background: "none", border: "none", fontSize: 15, padding: 4, flexShrink: 0, lineHeight: 1, cursor: "pointer" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topbar: { display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg)" },
  menuBtn: { background: "none", border: "none", color: "var(--text-secondary)", fontSize: 18, padding: "4px 8px", borderRadius: 6 },
  topbarTitle: { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  personaBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "6px 12px", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" },
  personaDropdown: { position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 6, minWidth: 220, zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" },
  personaOption: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", background: "none", cursor: "pointer", textAlign: "left" },
  personaOptionActive: { background: "var(--accent-dim)" },
  messagesArea: { flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center", padding: "60px 20px" },
  emptyTitle: { fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.5px" },
  emptySubtitle: { color: "var(--text-secondary)", fontSize: 15, marginBottom: 28 },
  suggestions: { display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 480 },
  suggBtn: { background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 20, padding: "8px 16px", fontSize: 13, cursor: "pointer" },
  messageRow: { display: "flex", alignItems: "flex-end", gap: 10 },
  aiAvatar: { width: 28, height: 28, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 },
  bubble: { maxWidth: "70%", padding: "12px 16px", borderRadius: 16, fontSize: 15, lineHeight: 1.65 },
  userBubble: { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 },
  aiBubble: { background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)", borderBottomLeftRadius: 4 },
  cursor: { display: "inline-block", animation: "blink 1s infinite", marginLeft: 2, color: "var(--accent)" },
  typingDots: { display: "flex", gap: 5, padding: "2px 0" },
  inputArea: { padding: "12px 20px 20px", borderTop: "1px solid var(--border)", background: "var(--bg)" },
  imagePreviewBar: { display: "flex", alignItems: "center", gap: 10, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", marginBottom: 8 },
  imageThumb: { width: 36, height: 36, objectFit: "cover", borderRadius: 6, flexShrink: 0 },
  imageName: { flex: 1, fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  removeImgBtn: { background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: "2px 6px" },
  inputBox: { display: "flex", alignItems: "flex-end", gap: 8, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "8px 8px 8px 12px" },
  attachBtn: { background: "none", border: "none", fontSize: 18, padding: "4px 6px", borderRadius: 8, color: "var(--text-secondary)", flexShrink: 0, lineHeight: 1, cursor: "pointer" },
  textarea: { flex: 1, background: "none", border: "none", color: "var(--text-primary)", fontSize: 15, resize: "none", outline: "none", lineHeight: 1.6, maxHeight: 160, paddingTop: 4, paddingBottom: 4 },
  sendBtn: { width: 36, height: 36, borderRadius: 10, background: "var(--accent)", border: "none", color: "#fff", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: "bold", lineHeight: 1 },
  hint: { fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 8 },
};
