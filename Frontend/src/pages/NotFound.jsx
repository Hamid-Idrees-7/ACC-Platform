import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import "./NotFound.css";

function NotFound() {
  const { user } = useAuth();
  usePageTitle("Page not found");

  return (
    <main className="nf">
      <div className="nf-card">
        <span className="nf-code">404</span>
        <h1>Page not found</h1>
        <p>The page you are looking for doesn't exist.</p>
        <div className="nf-actions">
          {user && <Link className="nf-btn nf-btn-primary" to="/dashboard">Go to dashboard</Link>}
          <Link className={`nf-btn ${user ? "" : "nf-btn-primary"}`} to="/">Go to homepage</Link>
        </div>
      </div>
    </main>
  );
}

export default NotFound;
