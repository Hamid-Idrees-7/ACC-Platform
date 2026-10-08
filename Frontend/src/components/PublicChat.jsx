import { useState, useRef, useEffect } from "react";
import api from "../services/api";
import "./PublicChat.css";

// Website assistant for visitors. Talk only: it answers about the company and services
// from the backend, which holds the company information. No sign-in, no private data.
const GREETING = "Hi! I'm the ACC assistant. Ask me about our services, projects, or how we build.";
const SUGGESTIONS = [
  "What services do you offer?",
  "I want to build a house",
  "Contact us",
];

// The chat is kept in sessionStorage, so it survives a page change or refresh in the same tab,
// and clears on its own when the browser tab is closed. Reads and writes are guarded in case
// storage is blocked (private windows), so the chat always works either way.
const MSG_KEY = "acc-pc-messages";
const OPEN_KEY = "acc-pc-open";
const HELLO_KEY = "acc-pc-hello-hidden";
const load = (key, fallback) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
};

// A tower crane that gently sways, so the bubble feels alive without being distracting.
function CraneIcon() {
  return (
    <svg className="pc-crane" width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="29" x2="16" y2="29" />
      <line x1="12" y1="29" x2="12" y2="8" />
      <line x1="12" y1="4" x2="12" y2="9" />
      <line x1="5" y1="9" x2="29" y2="9" />
      <line x1="12" y1="4" x2="27" y2="9" />
      <line x1="12" y1="4" x2="6" y2="9" />
      <g className="pc-crane-hook">
        <line x1="24" y1="9" x2="24" y2="15" />
        <path d="M22.5 15 q0 2.2 1.5 2.2 q1.5 0 1.5 -1.1" />
      </g>
    </svg>
  );
}

function PublicChat() {
  const [open, setOpen] = useState(() => load(OPEN_KEY, false));
  const [messages, setMessages] = useState(() => load(MSG_KEY, [{ role: "assistant", text: GREETING }]));
  const [helloHidden, setHelloHidden] = useState(() => load(HELLO_KEY, false));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { save(MSG_KEY, messages); }, [messages]);
  useEffect(() => { save(OPEN_KEY, open); }, [open]);

  // Keep the newest message in view, and focus the box when the chat opens.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || sending) return;

    const history = messages
      .slice(-10)
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", text: m.text }));

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);

    // One quiet retry: the very first call after a cold start can fail to connect, so we try
    // again before showing anything. A 4xx (eg rate limit) is not retried.
    const ask = async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await api.post("/ai/chat", { message: text, history });
        } catch (e) {
          const status = e?.response?.status;
          const retryable = !status || status >= 500;
          if (attempt < 2 && retryable) {
            await new Promise((r) => setTimeout(r, 700));
            continue;
          }
          throw e;
        }
      }
    };

    try {
      const res = await ask();
      setMessages((prev) => [...prev, { role: "assistant", text: res.data.reply }]);
    } catch (err) {
      const msg = err?.response?.data?.message || "Sorry, I couldn't reply just now. Please try again, or use the contact form.";
      setMessages((prev) => [...prev, { role: "assistant", text: msg, error: true }]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const openChat = () => {
    setHelloHidden(true);
    save(HELLO_KEY, true);
    setOpen(true);
  };
  const hideHello = () => { setHelloHidden(true); save(HELLO_KEY, true); };

  const showSuggestions = messages.length === 1 && !sending;
  const showHello = !open && !helloHidden;

  return (
    <div className="pc-root">
      {open && (
        <div className="pc-panel" role="dialog" aria-label="Chat with the ACC assistant">
          <div className="pc-head">
            <div className="pc-head-info">
              <span className="pc-head-ic" aria-hidden="true"><CraneIcon /></span>
              <div>
                <strong>ACC Assistant</strong>
                <span><i className="pc-dot" /> Online now</span>
              </div>
            </div>
            <button className="pc-close" onClick={() => setOpen(false)} aria-label="Close chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div className="pc-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`pc-msg ${m.role === "user" ? "user" : "bot"} ${m.error ? "error" : ""}`}>
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="pc-msg bot pc-typing" aria-label="Assistant is typing">
                <span></span><span></span><span></span>
              </div>
            )}
            {showSuggestions && (
              <div className="pc-suggestions">
                {SUGGESTIONS.map((q) => (
                  <button key={q} className="pc-chip" onClick={() => send(q)}>{q}</button>
                ))}
              </div>
            )}
          </div>

          <div className="pc-input">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Ask about our services..."
              value={input}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="pc-send" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send message">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </div>
          <div className="pc-foot">AI assistant. For anything important, please contact our team.</div>
        </div>
      )}

      {showHello && (
        <div className="pc-hello">
          <button className="pc-hello-x" onClick={hideHello} aria-label="Dismiss">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <strong>Let's construct together</strong>
        </div>
      )}

      <button className={`pc-bubble ${open ? "is-open" : ""}`} onClick={() => (open ? setOpen(false) : openChat())} aria-label={open ? "Close chat" : "Chat with us"}>
        {!open && <span className="pc-ring" aria-hidden="true" />}
        {open ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        ) : (
          <CraneIcon />
        )}
      </button>
    </div>
  );
}

export default PublicChat;
