import { useState, useRef, useEffect } from "react";
import api from "../services/api";
import { renderMarkdown } from "../utils/markdown";
import "./PublicChat.css";

// Website assistant for visitors. Talk only: it answers about the company and services
// from the backend, which holds the company information. No sign-in, no private data.
const GREETING = "Hi! I'm the ACC assistant.";
const SUGGESTIONS = [
  { q: "What services do you offer?", label: "Our services", hint: "What we build", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1" },
  { q: "How much does it cost to build a 5 marla house?", label: "Get a cost estimate", hint: "Rough build cost", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { q: "I want to build a house", label: "Start a project", hint: "Tell us your plan", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" },
  { q: "Contact us", label: "Contact the team", hint: "Talk to a person", icon: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" },
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

const BotAvatar = () => (
  <span className="pc-avatar" aria-hidden="true"><CraneIcon /></span>
);

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

  // Keep the newest message in view. On the welcome screen (only the greeting) stay at the
  // top so the header and welcome card are not scrolled out of sight.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = messages.length <= 1 ? 0 : el.scrollHeight;
  }, [messages, open, sending]);
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const grow = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 110) + "px";
  };

  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || sending) return;

    const history = messages
      .slice(-10)
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", text: m.text }));

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
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

  const showWelcome = messages.length === 1 && !sending;
  const showHello = !open && !helloHidden;

  return (
    <div className="pc-root">
      {open && (
        <div className="pc-panel" role="dialog" aria-label="Chat with the ACC assistant">
          <div className="pc-head">
            <div className="pc-head-info">
              <span className="pc-head-ic" aria-hidden="true"><CraneIcon /></span>
              <div className="pc-head-text">
                <strong>ACC Assistant</strong>
                <span><i className="pc-dot" /> Online now &middot; replies instantly</span>
              </div>
            </div>
            <button className="pc-close" onClick={() => setOpen(false)} aria-label="Close chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div className="pc-messages" ref={listRef}>
            {showWelcome ? (
              <div className="pc-welcome">
                <span className="pc-welcome-badge" aria-hidden="true"><CraneIcon /></span>
                <h3 className="pc-welcome-title">Let's build together</h3>
                <p className="pc-welcome-sub">{GREETING}</p>
                <div className="pc-cards">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.q} className="pc-card" onClick={() => send(s.q)}>
                      <span className="pc-card-ic" aria-hidden="true">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
                      </span>
                      <span className="pc-card-body">
                        <span className="pc-card-label">{s.label}</span>
                        <span className="pc-card-hint">{s.hint}</span>
                      </span>
                      <svg className="pc-card-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pc-thread">
                {messages.map((m, i) => (
                  <div key={i} className={`pc-row ${m.role === "user" ? "user" : "bot"}`}>
                    {m.role !== "user" && <BotAvatar />}
                    {m.role === "user" ? (
                      <div className="pc-msg user">{m.text}</div>
                    ) : m.error ? (
                      <div className="pc-msg bot error">{m.text}</div>
                    ) : (
                      <div className="pc-msg bot" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="pc-row bot">
                    <BotAvatar />
                    <div className="pc-msg bot pc-typing" aria-label="Assistant is typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pc-input">
            <div className="pc-input-inner">
              <textarea
                ref={inputRef}
                rows={1}
                placeholder="Ask about our services..."
                value={input}
                maxLength={1000}
                onChange={(e) => { setInput(e.target.value); grow(e.target); }}
                onKeyDown={onKeyDown}
              />
              <button className="pc-send" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send message">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
            <div className="pc-foot">AI assistant &middot; for anything important, please contact our team.</div>
          </div>
        </div>
      )}

      {showHello && (
        <div className="pc-hello">
          <button className="pc-hello-x" onClick={hideHello} aria-label="Dismiss">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <strong>Let's construct together</strong>
          <span>Ask me anything about building with ACC.</span>
        </div>
      )}

      <button className={`pc-bubble ${open ? "is-open" : ""}`} onClick={() => (open ? setOpen(false) : openChat())} aria-label={open ? "Close chat" : "Chat with us"}>
        {!open && <span className="pc-ring" aria-hidden="true" />}
        {!open && <span className="pc-bubble-dot" aria-hidden="true" />}
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
