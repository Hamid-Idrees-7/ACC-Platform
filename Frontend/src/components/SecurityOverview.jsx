import { useEffect, useRef } from "react";
import { formatDateTime } from "../utils/dates";
import "./SecurityOverview.css";

// Signed-in devices and sign-in history. Used by Settings > Security (your own account)
// and by Users (an admin looking at someone else's account). Prefix: sov-

// "5 minutes ago", or the date and time when it was more than a day ago.
const timeAgo = (value) => {
  if (!value) return "";
  const ms = Date.now() - new Date(value).getTime();
  if (ms < 60 * 1000) return "just now";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return formatDateTime(value);
};

// "5 minutes ago", or "on 25 Sep 2026, 7:41 AM"
const when = (value) => {
  const text = timeAgo(value);
  return /ago$|^just now$/.test(text) ? text : `on ${text}`;
};

const END_REASONS = {
  SignedOut: "Signed out",
  TimedOut: "Signed out after inactivity",
  SignedOutRemotely: "Signed out from another device",
  PasswordChanged: "Ended by a password change",
  AccountChanged: "Ended by an account change",
  RoleSwitched: "Switched to another demo role",
};

// Label, colour and detail line for one sign-in attempt.
const describeAttempt = (a) => {
  switch (a.result) {
    case "SignedIn":
      if (a.isActive) return { label: "Signed in", tone: "green", detail: a.isCurrent ? "This device" : `Active ${timeAgo(a.lastSeenAt || a.at)}` };
      if (a.endedAt) return { label: "Signed in", tone: "green", detail: `${END_REASONS[a.endReason] || "Signed out"} ${when(a.endedAt)}` };
      return { label: "Signed in", tone: "green", detail: "Session expired" };
    case "WrongPassword":
      return { label: "Wrong password", tone: "red", detail: "Sign-in refused" };
    case "Blocked":
      return { label: "Blocked", tone: "amber", detail: "Too many failed attempts" };
    case "Disabled":
      return { label: "Account disabled", tone: "grey", detail: "Sign-in refused" };
    default:
      return { label: a.result, tone: "grey", detail: "" };
  }
};

export function DeviceIcon({ kind }) {
  return (
    <span className="sov-device" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {kind === "phone" ? (
          <><rect x="6" y="2" width="12" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></>
        ) : kind === "tablet" ? (
          <><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></>
        ) : (
          <><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>
        )}
      </svg>
    </span>
  );
}

const deviceName = (s) => `${s.browser} on ${s.os}`;

// Devices where the account is signed in right now.
// onSignOut(session) shows a "Sign out" button on every device except this one.
export function SessionList({ sessions, onSignOut, busyId, emptyText = "Not signed in on any device." }) {
  if (!sessions.length) return <p className="sov-empty">{emptyText}</p>;
  return (
    <ul className="sov-sessions">
      {sessions.map((s) => (
        <li key={s.id} className={`sov-session ${s.isCurrent ? "current" : ""}`}>
          <DeviceIcon kind={s.deviceKind} />
          <div className="sov-session-main">
            <div className="sov-session-name">
              <strong>{deviceName(s)}</strong>
              {s.isCurrent && <span className="sov-badge">This device</span>}
            </div>
            <div className="sov-meta">
              {s.ipAddress && <span>{s.ipAddress}</span>}
              <span>Signed in {formatDateTime(s.at)}</span>
              <span>{s.isCurrent ? "Active now" : `Active ${timeAgo(s.lastSeenAt || s.at)}`}</span>
            </div>
          </div>
          {onSignOut && !s.isCurrent && (
            <button type="button" className="sov-btn-sm" onClick={() => onSignOut(s)} disabled={busyId === s.id}>
              {busyId === s.id ? "Signing out..." : "Sign out"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// Every sign-in attempt, newest first.
export function ActivityList({ activity, days }) {
  if (!activity.length) return <p className="sov-empty">No sign-ins in the last {days || 30} days.</p>;
  return (
    <ul className="sov-activity">
      {activity.map((a) => {
        const d = describeAttempt(a);
        return (
          <li key={a.id} className="sov-attempt">
            <span className={`sov-pill sov-${d.tone}`}>{d.label}</span>
            <div className="sov-attempt-main">
              <strong>{deviceName(a)}</strong>
              <span className="sov-meta">
                {a.ipAddress && <span>{a.ipAddress}</span>}
                {d.detail && <span>{d.detail}</span>}
              </span>
            </div>
            <time className="sov-when" dateTime={a.at}>{formatDateTime(a.at)}</time>
          </li>
        );
      })}
    </ul>
  );
}

// Confirmation before signing devices out (never the browser's confirm()).
export function ConfirmDialog({ title, text, confirmLabel, busy, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="sov-overlay" onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="sov-confirm" role="alertdialog" aria-modal="true" aria-labelledby="sov-confirm-title">
        <h3 id="sov-confirm-title">{title}</h3>
        <p>{text}</p>
        <div className="sov-confirm-actions">
          <button type="button" className="sov-btn sov-btn-ghost" onClick={onCancel} disabled={busy} ref={cancelRef}>Cancel</button>
          <button type="button" className="sov-btn sov-btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Signing out..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
