import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import "./UnderConstruction.css";

function UnderConstruction({ title }) {
  const navigate = useNavigate();

  return (
    <DashboardLayout title={title}>
      <div className="uc-wrap">
        <div className="uc-card">
          <div className="uc-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <h2>Coming Soon</h2>
          <p>The <strong>{title}</strong> module is currently under development. We're building it carefully to give you a complete, polished experience.</p>
          <button className="uc-back" onClick={() => navigate("/dashboard")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            Back to Dashboard
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default UnderConstruction;
