import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "./Home.css";
import "./Login.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [shake, setShake] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

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

    try {
      const response = await api.post("/auth/login", { username, password });
      login(response.data);
      setSuccess("Login successful. Redirecting to your dashboard...");
      setTimeout(() => navigate("/dashboard"), 800);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid username or password. Please try again.");
      triggerShake();
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <section className="login-section login-page-full">
      <div className="login-wrapper">
        {/* LEFT: Welcome side */}
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

        {/* RIGHT: Form */}
        <div className="login-right">
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
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <span className="forgot-link" onClick={() => setShowForgot(true)} style={{ cursor: "pointer" }}>
                Forgot password?
              </span>
            </div>

            <button type="submit" className={`btn-submit ${loading ? "is-loading" : ""}`} disabled={loading}>
              <span>{loading ? "Signing in..." : "Sign in to dashboard"}</span>
              {!loading && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>

            <div className="login-footer">
              <Link to="/">← Back to website</Link>
            </div>
          </form>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgot && (
        <div className="forgot-modal show" onClick={(e) => e.target.classList.contains("forgot-modal") && setShowForgot(false)}>
          <div className="forgot-modal-box">
            <button type="button" className="forgot-modal-close" onClick={() => setShowForgot(false)} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="forgot-modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3>Forgot your password?</h3>
            <p>
              For security, password resets are handled by your administrator. Please
              contact your system administrator to have your password reset.
            </p>
            <div className="forgot-contact">
              <strong>System Administrator</strong>
              admin@acc.com.pk
            </div>
            <button type="button" className="btn-submit" onClick={() => setShowForgot(false)}>Got it</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default Login;
