import { Component } from "react";
import "./ErrorBoundary.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const inDashboard = window.location.pathname.startsWith("/dashboard");
    return (
      <main className="erb" role="alert">
        <div className="erb-card">
          <div className="erb-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </div>
          <h1>Something went wrong</h1>
          <p>This page ran into a problem and couldn't be shown. Your saved data is safe. Reload the page to try again.</p>
          <div className="erb-actions">
            <button type="button" className="erb-btn erb-btn-primary" onClick={() => window.location.reload()}>Reload page</button>
            <a className="erb-btn" href={inDashboard ? "/dashboard" : "/"}>{inDashboard ? "Go to dashboard" : "Go to homepage"}</a>
          </div>
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;
