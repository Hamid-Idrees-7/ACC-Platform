import { useState, useRef, useEffect, useCallback } from "react";
import DashboardLayout from "../components/DashboardLayout";
import ModalOverlay from "../components/ModalOverlay";
import { usePermissions } from "../context/PermissionContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { NO_ACCESS_TITLE, NO_ACCESS_TEXT } from "../utils/errors";
import "./AiAssistant.css";

const GREETING = "Hi! I'm your ACC assistant. Ask me about your projects, stock, attendance, billing, payroll, team and more. I only show what your access allows.";

const SUGGESTIONS = [
  { q: "Which projects are in progress?", hint: "Status and progress", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1" },
  { q: "What materials are low on stock?", hint: "What to reorder", icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01l8.73-5.05 M12 22.08V12" },
  { q: "Show today's attendance", hint: "Who's on site today", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0 0.01 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
  { q: "Any new website messages?", hint: "Customer inquiries", icon: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6" },
];

const freshChat = () => [{ role: "assistant", text: GREETING }];

const AVATAR = (
  <div className="aia-avatar" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M19 15l.7 1.8L21.5 17.5 19.7 18.2 19 20l-.7-1.8L16.5 17.5 18.3 16.8 19 15z" />
    </svg>
  </div>
);

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Inline markdown: code, bold, italic. Input is already HTML escaped.
const inlineMd = (s) =>
  s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

// A small, safe markdown renderer for the assistant's replies (bold, lists, headings).
// Everything is escaped first, so only our own tags end up in the output.
const renderMarkdown = (text) => {
  const lines = escapeHtml(text || "").split(/\r?\n/);
  const out = [];
  let list = null;
  const closeList = () => {
    if (list) { out.push(`</${list}>`); list = null; }
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { closeList(); continue; }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    const heading = line.match(/^\s*#{1,4}\s+(.*)$/);
    if (bullet) {
      if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inlineMd(bullet[1])}</li>`);
    } else if (numbered) {
      if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inlineMd(numbered[1])}</li>`);
    } else if (heading) {
      closeList();
      out.push(`<h4>${inlineMd(heading[1])}</h4>`);
    } else {
      closeList();
      out.push(`<p>${inlineMd(line.trim())}</p>`);
    }
  }
  closeList();
  return out.join("");
};

// Groups the history into Today / Yesterday / Previous 7 days / Older.
const groupConversations = (list) => {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;
  const groups = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const c of list) {
    const t = new Date(c.updatedAt).getTime();
    if (t >= startToday) groups[0].items.push(c);
    else if (t >= startToday - day) groups[1].items.push(c);
    else if (t >= startToday - 7 * day) groups[2].items.push(c);
    else groups[3].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
};

function AiAssistant() {
  const { can, isAdmin } = usePermissions();
  const { user } = useAuth();
  const allowed = isAdmin || can("AI", "View");
  const firstName = (user?.fullName || "").trim().split(" ")[0];

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState(freshChat);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentId, setCurrentId] = useState(null);

  const currentIdRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const setCurrent = (id) => {
    currentIdRef.current = id;
    setCurrentId(id);
  };

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get("/ai/conversations");
      setConversations(res.data || []);
    } catch {
      // History is optional. If it isn't available, the chat still works.
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    (async () => {
      try {
        const res = await api.get("/ai/conversations");
        if (active) setConversations(res.data || []);
      } catch {
        // History is optional. If it isn't available, the chat still works.
      }
    })();
    return () => { active = false; };
  }, [allowed]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const grow = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  if (!allowed) {
    return (
      <DashboardLayout title="AI Assistant">
        <div className="aia-noaccess">
          <h2>{NO_ACCESS_TITLE}</h2>
          <p>{NO_ACCESS_TEXT}</p>
        </div>
      </DashboardLayout>
    );
  }

  const persist = async (allMessages) => {
    const title = (allMessages.find((m) => m.role === "user")?.text || "").slice(0, 120);
    const payload = { title, messages: allMessages.map((m) => ({ role: m.role, text: m.text })) };
    try {
      if (currentIdRef.current == null) {
        const res = await api.post("/ai/conversations", payload);
        setCurrent(res.data.id);
      } else {
        await api.put(`/ai/conversations/${currentIdRef.current}`, payload);
      }
      loadConversations();
    } catch {
      // Saving history failed (eg not set up yet). The chat itself is unaffected.
    }
  };

  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || sending) return;

    const history = messages.slice(-10).map((m) => ({ role: m.role === "assistant" ? "model" : "user", text: m.text }));
    const base = [...messages, { role: "user", text }];
    setMessages(base);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setSending(true);

    const ask = async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await api.post("/ai/assistant", { message: text, history });
        } catch (e) {
          const status = e?.response?.status;
          if (attempt < 2 && (!status || status >= 500)) {
            await new Promise((r) => setTimeout(r, 700));
            continue;
          }
          throw e;
        }
      }
    };

    try {
      const res = await ask();
      const full = [...base, { role: "assistant", text: res.data.reply }];
      setMessages(full);
      persist(full);
    } catch (err) {
      const msg = err?.response?.data?.message || "Sorry, I couldn't reply just now. Please try again.";
      setMessages([...base, { role: "assistant", text: msg, error: true }]);
    } finally {
      setSending(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const newChat = () => {
    setCurrent(null);
    setMessages(freshChat());
    setInput("");
    setSidebarOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const openConversation = async (id) => {
    if (sending) return;
    try {
      const res = await api.get(`/ai/conversations/${id}`);
      const loaded = res.data.messages || [];
      setCurrent(id);
      setMessages(loaded.length ? loaded : freshChat());
      setSidebarOpen(false);
    } catch {
      // Could not load that conversation.
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/ai/conversations/${confirmDelete.id}`);
      if (currentIdRef.current === confirmDelete.id) newChat();
      setConfirmDelete(null);
      loadConversations();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const groups = groupConversations(conversations);
  const isEmpty = messages.length <= 1 && !sending;

  return (
    <DashboardLayout title="AI Assistant">
      <div className="aia-shell">
        {sidebarOpen && <div className="aia-scrim" onClick={() => setSidebarOpen(false)} />}

        <aside className={`aia-side ${sidebarOpen ? "open" : ""}`}>
          <div className="aia-side-head">
            <div className="aia-brand">
              <span className="aia-brand-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" /></svg>
              </span>
              <span className="aia-brand-text">ACC Assistant</span>
            </div>
            <button className="aia-side-close" onClick={() => setSidebarOpen(false)} aria-label="Close history">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <button className="aia-newbtn" onClick={newChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            New chat
          </button>

          <div className="aia-side-list">
            {groups.length === 0 ? (
              <div className="aia-side-empty">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                <span>Your chats will show up here.</span>
              </div>
            ) : (
              groups.map((g) => (
                <div className="aia-side-group" key={g.label}>
                  <div className="aia-side-grouplabel">{g.label}</div>
                  {g.items.map((c) => (
                    <div key={c.id} className={`aia-side-item ${currentId === c.id ? "active" : ""}`}>
                      <button className="aia-side-open" onClick={() => openConversation(c.id)} title={c.title}>
                        <svg className="aia-side-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        <span className="aia-side-name">{c.title}</span>
                      </button>
                      <button className="aia-side-del" onClick={() => setConfirmDelete(c)} aria-label="Delete chat">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="aia-main">
          <div className="aia-bar">
            <button className="aia-hist-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open history">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            <span className="aia-status"><span className="aia-dot" /> Online</span>
            <span className="aia-scope">Answers from your data, within your access</span>
            <button className="aia-newbtn-sm" onClick={newChat} aria-label="New chat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>

          <div className="aia-messages" ref={listRef}>
            {isEmpty ? (
              <div className="aia-hero">
                <div className="aia-hero-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" /><path d="M19 15l.7 1.8L21.5 17.5 19.7 18.2 19 20l-.7-1.8L16.5 17.5 18.3 16.8 19 15z" /></svg>
                </div>
                <h2 className="aia-hero-title">{firstName ? `How can I help, ${firstName}?` : "How can I help?"}</h2>
                <p className="aia-hero-sub">Ask about projects, stock, attendance, billing, payroll and your team. I only show what your access allows.</p>
                <div className="aia-cards">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.q} className="aia-card" onClick={() => send(s.q)}>
                      <span className="aia-card-ic" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
                      </span>
                      <span className="aia-card-body">
                        <span className="aia-card-q">{s.q}</span>
                        <span className="aia-card-hint">{s.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="aia-thread">
                {messages.map((m, i) => (
                  <div key={i} className={`aia-row ${m.role === "user" ? "user" : "bot"}`}>
                    {m.role !== "user" && AVATAR}
                    {m.role === "user" ? (
                      <div className="aia-msg user">{m.text}</div>
                    ) : m.error ? (
                      <div className="aia-msg bot error">{m.text}</div>
                    ) : (
                      <div className="aia-msg bot" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="aia-row bot">
                    {AVATAR}
                    <div className="aia-msg bot aia-typing"><span></span><span></span><span></span></div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="aia-composer">
            <div className="aia-composer-inner">
              <textarea
                ref={inputRef}
                rows={1}
                placeholder="Ask about your projects, stock, attendance, billing..."
                value={input}
                maxLength={1000}
                onChange={(e) => { setInput(e.target.value); grow(e.target); }}
                onKeyDown={onKeyDown}
              />
              <button className="aia-send" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
            <p className="aia-foot">AI can make mistakes. Check important figures in the relevant section.</p>
          </div>
        </section>
      </div>

      {confirmDelete && (
        <ModalOverlay className="aia-confirm-overlay" onClose={() => setConfirmDelete(null)}>
          <div className="aia-confirm">
            <div className="aia-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </div>
            <h3>Delete this chat?</h3>
            <p><strong>{confirmDelete.title}</strong> will be permanently deleted. This cannot be undone.</p>
            <div className="aia-confirm-actions">
              <button className="aia-confirm-cancel" data-close onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="aia-confirm-delete" onClick={doDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </DashboardLayout>
  );
}

export default AiAssistant;
