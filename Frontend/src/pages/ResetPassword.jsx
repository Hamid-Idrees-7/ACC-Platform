import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "../services/authService";
import { passwordError } from "../utils/password";
import { LOGIN_NOTE_KEY } from "../config/sessionConfig";
import PasswordStrength from "../components/PasswordStrength";
import { usePageTitle } from "../hooks/usePageTitle";
import "./Home.css";
import "./Login.css";
import "./ResetPassword.css";

// The page behind the link in the "Reset your password" email.
function ResetPassword() {
  usePageTitle("Choose a new password");
  const [params] = useSearchParams();
  const code = params.get("code") || "";
  const navigate = useNavigate();

  // checking | ready | invalid
  const [state, setState] = useState(code ? "checking" : "invalid");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    authService.checkResetCode(code)
      .then((res) => {
        if (cancelled) return;
        setUsername(res.username);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("invalid");
      });
    return () => { cancelled = true; };
  }, [code]);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    const pwError = passwordError(password);
    if (pwError) next.password = pwError;
    else if (confirm !== password) next.confirm = "Passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const res = await authService.resetPassword(code, password);
      try {
        sessionStorage.setItem(LOGIN_NOTE_KEY, res.message);
      } catch {
        // storage blocked: the sign-in page shows no message
      }
      navigate("/login", { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data?.field === "code") setState("invalid");
      else setErrors({ password: data?.message || "Could not change the password. Please try again." });
      setBusy(false);
    }
  };

  return (
    <section className="login-page-full rsp">
      <div className="rsp-card">
        {state === "checking" && (
          <div className="rsp-status" role="status">Checking your link...</div>
        )}

        {state === "invalid" && (
          <>
            <div className="rsp-icon rsp-icon-warn" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
            <h1>This link doesn't work any more</h1>
            <p className="rsp-text">Reset link has been expired.</p>
            <Link className="btn-submit rsp-btn" to="/login">Back to sign in</Link>
          </>
        )}

        {state === "ready" && (
          <form onSubmit={submit} noValidate>
            <div className="rsp-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </div>
            <h1>Choose a new password</h1>
            <p className="rsp-text">For the account <strong>{username}</strong>. Every device signed in to it will be signed out.</p>

            {/* Lets password managers save the new password under the right username */}
            <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />

            <div className="form-group">
              <label htmlFor="rsp-password" className="form-label">New password</label>
              <div className="password-wrapper">
                <input
                  id="rsp-password"
                  type={show ? "text" : "password"}
                  className={`form-input ${errors.password ? "rsp-invalid" : ""}`}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                  autoComplete="new-password"
                  maxLength={128}
                  aria-invalid={!!errors.password}
                  aria-describedby="rsp-strength"
                  autoFocus
                />
                <button type="button" className="password-toggle" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>
                  {show ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
              {errors.password && <span className="rsp-err">{errors.password}</span>}
              <PasswordStrength id="rsp-strength" password={password} />
            </div>

            <div className="form-group">
              <label htmlFor="rsp-confirm" className="form-label">Type it again</label>
              <input
                id="rsp-confirm"
                type={show ? "text" : "password"}
                className={`form-input ${errors.confirm ? "rsp-invalid" : ""}`}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setErrors({}); }}
                autoComplete="new-password"
                maxLength={128}
                aria-invalid={!!errors.confirm}
              />
              {errors.confirm && <span className="rsp-err">{errors.confirm}</span>}
            </div>

            <button type="submit" className="btn-submit" disabled={busy}>
              {busy ? "Saving..." : "Save new password"}
            </button>

            <div className="login-footer">
              <Link to="/login">← Back to sign in</Link>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

export default ResetPassword;
