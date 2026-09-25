import { useEffect, useRef, useState } from "react";
import { DEMO_ROLES, CUSTOM_DEMO_ROLE } from "../config/demoConfig";
import DemoRoleIcon from "./DemoRoleIcon";
import "./DemoBar.css";

// "12:05" style countdown
const formatClock = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

// Slim bar at the top of the dashboard while a visitor explores the live demo:
// role switcher, time left, and an exit button.
// roleLabel: the viewed user's name when the visitor is using View as on their own user.
function DemoBar({ role, roleLabel, endsAt, busy, onSwitch, onExit, onExpire }) {
  const [msLeft, setMsLeft] = useState(() => endsAt - Date.now());
  const [error, setError] = useState("");

  // Keep the latest callback without restarting the timer on every render.
  const expireRef = useRef(onExpire);
  useEffect(() => {
    expireRef.current = onExpire;
  });

  useEffect(() => {
    const tick = () => {
      const left = endsAt - Date.now();
      setMsLeft(left);
      if (left <= 0) expireRef.current();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const handleSwitch = async (key) => {
    if (busy || key === role) return;
    setError("");
    try {
      await onSwitch(key);
    } catch (err) {
      setError(err?.message || "Couldn't switch role.");
      setTimeout(() => setError(""), 4000);
    }
  };

  const warn = msLeft <= 5 * 60 * 1000;
  const critical = msLeft <= 60 * 1000;

  return (
    <div className={`dmb ${role === CUSTOM_DEMO_ROLE.key ? "dmb-has-custom" : ""}`} role="region" aria-label="Live demo controls">
      <div className="dmb-left">
        <span className="dmb-live">
          <span className="dmb-dot" />
          <span className="dmb-live-text">Live demo</span>
        </span>
        <span className="dmb-text">Sample data · private to you</span>
      </div>

      <div className="dmb-roles">
        <span className="dmb-roles-label">Viewing as</span>
        <div className="dmb-seg" role="tablist" aria-label="Switch demo role">
          {role === CUSTOM_DEMO_ROLE.key && (
            <span className="dmb-seg-btn dmb-seg-custom active" role="tab" aria-selected="true" title={CUSTOM_DEMO_ROLE.tagline}>
              <DemoRoleIcon role={CUSTOM_DEMO_ROLE.key} />
              <span className="dmb-seg-name">{roleLabel || CUSTOM_DEMO_ROLE.label}</span>
            </span>
          )}
          {DEMO_ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={r.key === role}
              className={`dmb-seg-btn ${r.key === role ? "active" : ""}`}
              onClick={() => handleSwitch(r.key)}
              disabled={busy}
              title={r.tagline}
            >
              <DemoRoleIcon role={r.key} />
              <span className="dmb-seg-full">{r.label}</span>
              <span className="dmb-seg-short">{r.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dmb-right">
        {error && <span className="dmb-error">{error}</span>}
        <span
          className={`dmb-timer ${warn ? "warn" : ""} ${critical ? "critical" : ""}`}
          title="Time left in your demo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {formatClock(msLeft)}
        </span>
        <button type="button" className="dmb-exit" onClick={onExit} disabled={busy}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Exit demo</span>
        </button>
      </div>
    </div>
  );
}

export default DemoBar;
