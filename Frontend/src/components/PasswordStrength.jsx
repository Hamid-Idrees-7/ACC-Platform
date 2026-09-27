import { passwordChecks, passwordStrength } from "../utils/password";
import "./PasswordStrength.css";

// Strength bar and rule checklist under a new-password field.
function PasswordStrength({ password = "", id }) {
  const { score, label } = passwordStrength(password);
  const checks = passwordChecks(password);

  return (
    <div className="pws" id={id} aria-live="polite">
      <div className={`pws-bar pws-score-${score}`} aria-hidden="true">
        {[1, 2, 3, 4].map((i) => <span key={i} className={i <= score ? "on" : ""} />)}
      </div>
      <div className="pws-head">
        <span className="pws-title">Password strength</span>
        <span className={`pws-label pws-score-${score}`}>{label || "Not set"}</span>
      </div>
      <ul className="pws-list">
        {checks.map((c) => (
          <li key={c.key} className={c.ok ? "ok" : ""}>
            <span className="pws-dot" aria-hidden="true">
              {c.ok ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : null}
            </span>
            {c.label}
            <span className="sr-only">{c.ok ? " (done)" : " (not yet)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PasswordStrength;
