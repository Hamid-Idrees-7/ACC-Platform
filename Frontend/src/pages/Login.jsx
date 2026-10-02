import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { demoService } from "../services/demoService";
import { DEMO_NOTE_KEY, DEMO_STATUS_KEY, getDemoRole } from "../config/demoConfig";
import { LOGIN_NOTE_KEY } from "../config/sessionConfig";
import "./Home.css";
import "./Login.css";
import { usePageTitle } from "../hooks/usePageTitle";

// Last demo status seen by this browser, or an optimistic default (the demo is on in production).
const readCachedDemoStatus = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(DEMO_STATUS_KEY) || "null");
    if (cached && typeof cached.enabled === "boolean") return cached;
  } catch {
    // Ignore unreadable storage.
  }
  return { enabled: true, available: true, sessionMinutes: 30 };
};

function Login() {
  usePageTitle("Sign in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [shake, setShake] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  // "Forgot password?" swaps the form for the reset link form.
  const [mode, setMode] = useState("signin");
  const [resetLogin, setResetLogin] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSent, setResetSent] = useState("");

  // Live demo ("Login as Visitor"). Shown straight away from the last known status (or an
  // optimistic default) so the page doesn't jump when the server answers.
  const [demoStatus, setDemoStatus] = useState(readCachedDemoStatus);   // { enabled, available, sessionMinutes }
  const [demoBusy, setDemoBusy] = useState(null);       // role key being started
  const [demoNote, setDemoNote] = useState(() => sessionStorage.getItem(DEMO_NOTE_KEY) || "");
  // Why the user was signed out (inactivity, another device, password changed...)
  const [sessionNote, setSessionNote] = useState(() => sessionStorage.getItem(LOGIN_NOTE_KEY) || "");

  const { login, dropSession, runDemoTransition } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // After signing in, go back to the dashboard page that was asked for (if any).
  const requested = location.state?.from;
  const afterLogin = typeof requested === "string" && requested.startsWith("/dashboard") ? requested : "/dashboard";

  // Refresh the status quietly. The visitor option is only hidden when the server says the
  // demo is switched off; if the server can't be reached, the button stays and shows an error on click.
  useEffect(() => {
    demoService.getStatus()
      .then((status) => {
        setDemoStatus(status);
        try {
          localStorage.setItem(DEMO_STATUS_KEY, JSON.stringify(status));
        } catch {
          // Storage unavailable (private mode): the optimistic default is used next time.
        }
      })
      .catch(() => {});
  }, []);

  // A "your demo has ended" or "you were signed out" note is shown once.
  useEffect(() => {
    sessionStorage.removeItem(DEMO_NOTE_KEY);
    sessionStorage.removeItem(LOGIN_NOTE_KEY);
  }, []);

  const startDemo = async (roleKey) => {
    if (demoBusy || loading) return;
    setDemoBusy(roleKey);
    setError("");
    setSuccess("");
    setDemoNote("");
    setSessionNote("");
    // A new demo never carries an older session (or a signed-in account) with it.
    dropSession();
    try {
      await runDemoTransition(roleKey, "Preparing your private demo", async () => {
        const data = await demoService.start(roleKey);
        login(data);
        navigate("/dashboard");
      });
    } catch (err) {
      setError(err.response?.data?.message || "We couldn't start the demo. Please try again.");
      triggerShake();
      setDemoBusy(null);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      setSuccess("");
      triggerShake();
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setSessionNote("");

    try {
      if (localStorage.getItem("token")) dropSession();
      const data = await authService.login(username, password, keepSignedIn);
      login(data, { keepSignedIn });
      setSuccess("Login successful. Redirecting to your dashboard...");
      setTimeout(() => navigate(afterLogin, { replace: true }), 800);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid username or password. Please try again.");
      triggerShake();
      setLoading(false);
    }
  };

  const openForgot = () => {
    setResetLogin(username.trim());
    setResetError("");
    setResetSent("");
    setError("");
    setMode("forgot");
  };

  const backToSignIn = () => {
    setMode("signin");
    setResetError("");
  };

  const sendResetLink = async (e) => {
    e.preventDefault();
    if (!resetLogin.trim()) {
      setResetError("Enter your username or email.");
      triggerShake();
      return;
    }
    setResetBusy(true);
    setResetError("");
    setResetSent("");
    try {
      const res = await authService.forgotPassword(resetLogin.trim());
      setResetSent(res.message);
    } catch (err) {
      setResetError(err.response?.data?.message || "We couldn't send the link. Please try again.");
      triggerShake();
    } finally {
      setResetBusy(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <section className="login-section login-page-full">
      <div className="login-wrapper">
        {/* Left: welcome side */}
        <div className="login-left">
          <div className="login-left-content">
            <span className="login-tag">ACC ERP Portal</span>
            <h2>
              Welcome to your <span>secure workspace</span>
            </h2>
            <p>
              Access tools and information tailored to your role within Anonymous
              Construction Co.'s management system.
            </p>

            <ul className="login-info-list">
              <li className="login-info-item">
                <div className="login-info-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <span>Role-based dashboards for Admin, Manager, and Site Engineer</span>
              </li>
              <li className="login-info-item">
                <div className="login-info-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <span>Secure authentication with encrypted password storage</span>
              </li>
              <li className="login-info-item">
                <div className="login-info-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <span>Profile management with approval-based change requests</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right: form */}
        <div className="login-right">
          {mode === "forgot" ? (
            <>
              <div className="login-form-header">
                <h3>Reset your password</h3>
                <p>Enter your username or email. We'll email you a link to choose a new password.</p>
              </div>

              <form className={shake ? "shake" : ""} onSubmit={sendResetLink} noValidate>
                {resetError && (
                  <div className="login-msg-box login-msg-error" role="alert" style={{ display: "flex" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{resetError}</span>
                  </div>
                )}

                {resetSent && (
                  <div className="login-msg-box login-msg-success" role="status" style={{ display: "flex" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>{resetSent}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="reset-login" className="form-label">Username or email</label>
                  <div className="form-input-wrapper">
                    <input
                      type="text"
                      id="reset-login"
                      className="form-input"
                      placeholder="Username or email"
                      value={resetLogin}
                      onChange={(e) => setResetLogin(e.target.value)}
                      autoComplete="username"
                      maxLength={100}
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" className={`btn-submit ${resetBusy ? "is-loading" : ""}`} disabled={resetBusy}>
                  <span>{resetBusy ? "Sending..." : resetSent ? "Send again" : "Send reset link"}</span>
                </button>

                <p className="login-reset-note">
                  Or contact administration.
                </p>

                <div className="login-footer">
                  <button type="button" className="login-text-btn" onClick={backToSignIn}>← Back to sign in</button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="login-form-header">
                <h3>Sign In</h3>
                <p>Use your assigned credentials to access the system</p>
              </div>

              <form className={shake ? "shake" : ""} onSubmit={handleSubmit}>
                {error && (
                  <div className="login-msg-box login-msg-error" style={{ display: "flex" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="login-msg-box login-msg-success" style={{ display: "flex" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>{success}</span>
                  </div>
                )}

                {sessionNote && !error && !success && (
                  <div className="login-msg-box login-msg-info" role="status" style={{ display: "flex" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>{sessionNote}</span>
                  </div>
                )}

                {demoNote && !sessionNote && !error && !success && (
                  <div className="login-msg-box lgv-msg" style={{ display: "flex" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>{demoNote}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="username" className="form-label">Username</label>
                  <div className="form-input-wrapper">
                    <input
                      type="text"
                      id="username"
                      className="form-input"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">Password</label>
                  <div className="password-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      className="form-input"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Show password">
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="form-options">
                  <label className="remember-me">
                    <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} />
                    <span>Remember me</span>
                  </label>
                  <button type="button" className="forgot-link" onClick={openForgot}>
                    Forgot password?
                  </button>
                </div>

                <button type="submit" className={`btn-submit ${loading ? "is-loading" : ""}`} disabled={loading || !!demoBusy}>
                  <span>{loading ? "Signing in..." : "Sign in to dashboard"}</span>
                  {!loading && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </button>

                {/* Live demo: explore without an account */}
                {demoStatus?.enabled && (
                  <div className="lgv">
                    <div className="lgv-divider"><span>or explore the live demo</span></div>

                    <button
                      type="button"
                      className={`lgv-main ${demoBusy ? "is-busy" : ""}`}
                      onClick={() => startDemo("admin")}
                      disabled={!!demoBusy || loading}
                    >
                      <span className="lgv-main-icon">
                        {demoBusy ? (
                          <span className="lgv-spinner" />
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polygon points="10 8 16 12 10 16 10 8" />
                          </svg>
                        )}
                      </span>
                      <span className="lgv-main-text">
                        <strong>{demoBusy ? `Preparing ${getDemoRole(demoBusy).label} demo...` : "Login as Visitor"}</strong>
                        <small>Full admin view · sample company data · no sign-up</small>
                      </span>
                      <svg className="lgv-main-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>

                    <div className="lgv-alt">
                      <span>or try as</span>
                      <button type="button" onClick={() => startDemo("manager")} disabled={!!demoBusy || loading}>Manager</button>
                      <span className="lgv-sep" aria-hidden="true">·</span>
                      <button type="button" onClick={() => startDemo("engineer")} disabled={!!demoBusy || loading}>Site Engineer</button>
                    </div>

                    <p className={`lgv-note ${demoStatus.available ? "" : "is-full"}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      {demoStatus.available
                        ? `Private to you · resets after ${demoStatus.sessionMinutes} minutes`
                        : "All demo seats are busy right now. Please try again in a few minutes."}
                    </p>
                  </div>
                )}

                <div className="login-footer">
                  <Link to="/">← Back to website</Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

    </section>
  );
}

export default Login;
