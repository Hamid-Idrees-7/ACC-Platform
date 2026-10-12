import "./AiActionCard.css";

// A confirmation card the assistant shows in chat before anything changes. The action object
// comes from the backend (kind, title, fields, method, url, payload). On confirm the parent
// calls the real module endpoint, which enforces permission and validation on its own.

const ICONS = {
  add_client: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M19 8v6 M22 11h-6" />,
  edit_client: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
  delete_client: <path d="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
  approve_request: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
  reject_request: <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>,
};

function AiActionCard({ action, state, result, busy, onConfirm, onCancel }) {
  const danger = !!action.danger;
  const done = state === "done";
  const failed = state === "failed";
  const kindClass = danger ? "danger" : action.kind === "approve_request" ? "ok" : "primary";

  return (
    <div className={`aiac ${kindClass} ${done ? "is-done" : ""}`}>
      <div className="aiac-head">
        <span className="aiac-ic" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[action.kind] || ICONS.edit_client}
          </svg>
        </span>
        <div className="aiac-head-text">
          <strong>{action.title}</strong>
          <span>{action.summary}</span>
        </div>
      </div>

      <div className="aiac-fields">
        {action.fields?.map((f, i) => (
          <div className="aiac-row" key={i}>
            <span className="aiac-label">{f.label}</span>
            {f.to != null || f.from != null ? (
              <span className="aiac-change">
                <span className="aiac-from">{f.from}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                <span className="aiac-to">{f.to}</span>
              </span>
            ) : (
              <span className="aiac-value">{f.value}</span>
            )}
          </div>
        ))}
      </div>

      {action.note && !done && <p className="aiac-note">{action.note}</p>}

      {done ? (
        <div className="aiac-result ok">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          <span>{result || "Done."}</span>
        </div>
      ) : (
        <>
          {failed && result && <p className="aiac-error">{result}</p>}
          <div className="aiac-actions">
            <button className="aiac-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className={`aiac-confirm ${danger ? "danger" : ""}`} onClick={onConfirm} disabled={busy}>
              {busy ? "Working..." : (failed ? "Try again" : action.confirmLabel || "Confirm")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default AiActionCard;
