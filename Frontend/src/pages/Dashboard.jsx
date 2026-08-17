import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionContext";
import DashboardLayout from "../components/DashboardLayout";
import { inquiryService } from "../services/inquiryService";
import { approvalService } from "../services/approvalService";
import "./Dashboard.css";

function Dashboard() {
  const { user } = useAuth();
  const { isAdmin, canView } = usePermissions();
  const navigate = useNavigate();
  const firstName = (user?.fullName || user?.username || "there").split(" ")[0];

  const [queries, setQueries] = useState([]);
  const [loadingQueries, setLoadingQueries] = useState(true);
  const [approvalCount, setApprovalCount] = useState(0);

  // Which cards can this user see?
  const showMessages = isAdmin || canView("Messages");
  const showReports = isAdmin || canView("Reports");
  const showAI = isAdmin || canView("AI");
  const showControlUnit = isAdmin; // Admin-only
  const showApprovals = isAdmin;   // Admin-only (for now)

  const anyCard = showMessages || showReports || showAI || showControlUnit || showApprovals;

  useEffect(() => {
    if (!showMessages) { setLoadingQueries(false); return; }
    const load = async () => {
      try {
        const data = await inquiryService.getAll();
        setQueries(data);
      } catch {
        // silent
      } finally {
        setLoadingQueries(false);
      }
    };
    load();
  }, [showMessages]);

  // Load pending approval count (Admin only)
  useEffect(() => {
    if (!showApprovals) return;
    const loadCount = async () => {
      try {
        const count = await approvalService.getCount();
        setApprovalCount(count);
      } catch {
        // silent
      }
    };
    loadCount();
  }, [showApprovals]);

  const stats = [
    { label: "Total Users", value: "0", icon: "users" },
    { label: "Active Employees", value: "0", icon: "user" },
    { label: "Active Projects", value: "0", icon: "building" },
    { label: "Total Revenue", value: "Rs. 0", icon: "dollar" },
  ];

  const statIcon = (name) => {
    const i = {
      users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
      user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
      building: <><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></>,
      dollar: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    };
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{i[name]}</svg>;
  };

  const unreadCount = queries.filter((q) => !q.isRead).length;

  return (
    <DashboardLayout title="Dashboard">
      {/* Welcome banner */}
      <div className="dash-welcome">
        <h2>Welcome back, <span>{firstName}</span></h2>
        <p>Here's what's happening with Anonymous Construction Co. today.</p>
      </div>

      {/* Stat cards - Admin only */}
      {isAdmin && (
        <div className="dash-stats">
          {stats.map((s) => (
            <div className="dash-stat-card" key={s.label}>
              <div className="dash-stat-icon">{statIcon(s.icon)}</div>
              <div className="dash-stat-value">{s.value}</div>
              <div className="dash-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action grid: only the cards this user may see */}
      {anyCard ? (
        <div className="dash-grid">
          {/* Messages */}
          {showMessages && (
            <button className="dash-mod-card" onClick={() => navigate("/dashboard/queries")}>
              <div className="dash-mod-top">
                <div className="dash-mod-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                </div>
                <span className="dash-mod-count">{loadingQueries ? 0 : unreadCount}</span>
              </div>
              <h3>Messages</h3>
              <p>New inquiries from your website</p>
            </button>
          )}

          {/* Control Unit - Admin only */}
          {showControlUnit && (
            <button className="dash-mod-card" onClick={() => navigate("/dashboard/control-unit")}>
              <div className="dash-mod-top">
                <div className="dash-mod-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
              </div>
              <h3>Control Unit</h3>
              <p>Manage user access and permissions</p>
            </button>
          )}

          {/* AI card - special, spans both rows */}
          {showAI && (
            <button className="dash-ai-card" onClick={() => navigate("/dashboard/ai")}>
              <div className="dash-ai-glow" />
              <div className="dash-ai-content">
                <div className="dash-ai-badge">Coming Soon</div>
                <div className="dash-ai-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" /><circle cx="8.5" cy="13.5" r="1.5" fill="currentColor" /><circle cx="15.5" cy="13.5" r="1.5" fill="currentColor" /></svg>
                </div>
                <h3>AI Assistant</h3>
                <p>Chat with your intelligent construction assistant. Ask questions, get insights, and manage work — like having an expert on call.</p>
                <span className="dash-ai-link">Explore <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></span>
              </div>
            </button>
          )}

          {/* Approvals - Admin only */}
          {showApprovals && (
            <button className="dash-mod-card" onClick={() => navigate("/dashboard/approvals")}>
              <div className="dash-mod-top">
                <div className="dash-mod-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                </div>
                <span className="dash-mod-count">{approvalCount}</span>
              </div>
              <h3>Pending Approvals</h3>
              <p>Requests waiting for your review</p>
            </button>
          )}

          {/* Reports */}
          {showReports && (
            <button className="dash-mod-card" onClick={() => navigate("/dashboard/reports")}>
              <div className="dash-mod-top">
                <div className="dash-mod-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                </div>
              </div>
              <h3>Reports</h3>
              <p>Business insights and analytics</p>
            </button>
          )}
        </div>
      ) : (
        <div className="dash-no-modules">
          <div className="dash-no-modules-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
          </div>
          <h3>Your workspace is ready</h3>
          <p>Modules you have access to will appear here. Use the sidebar to get started.</p>
        </div>
      )}
    </DashboardLayout>
  );
}

export default Dashboard;
