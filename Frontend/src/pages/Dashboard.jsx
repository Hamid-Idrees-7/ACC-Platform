import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionContext";
import DashboardLayout from "../components/DashboardLayout";
import { inquiryService } from "../services/inquiryService";
import { approvalService } from "../services/approvalService";
import { userService } from "../services/userService";
import { employeeService } from "../services/employeeService";
import { projectService } from "../services/projectService";
import { billingService } from "../services/billingService";
import { materialRequestService } from "../services/materialRequestService";
import { moneyShort, amountInWords } from "../utils/format";
import { useCompany } from "../context/CompanyContext";
import "./Dashboard.css";
import { useLiveRefresh } from "../hooks/useLive";

function Dashboard() {
  const { user } = useAuth();
  const { isAdmin, canView, can } = usePermissions();
  const { company } = useCompany();
  const navigate = useNavigate();
  const firstName = (user?.fullName || user?.username || "there").split(" ")[0];

  const [queries, setQueries] = useState([]);
  const [loadingQueries, setLoadingQueries] = useState(true);
  const [approvalCount, setApprovalCount] = useState(0);
  const [matReqCount, setMatReqCount] = useState(0);
  const [metrics, setMetrics] = useState({ users: 0, employees: 0, projects: 0, revenue: 0, loaded: false });

  // Which cards can this user see?
  const showMessages = isAdmin || canView("Messages");
  const showReports = isAdmin || canView("Reports");
  const showAI = isAdmin || canView("AI");
  const showControlUnit = isAdmin;
  const showApprovals = isAdmin || canView("Approvals");
  const showMatRequests = isAdmin || can("MaterialRequests", "View");

  const anyCard = showMessages || showReports || showAI || showControlUnit || showApprovals || showMatRequests;

  const [liveTick, setLiveTick] = useState(0);
  useLiveRefresh(["messages", "approvals", "material-requests", "users", "employees", "projects", "billing"], () => setLiveTick((t) => t + 1));

  useEffect(() => {
    if (!showMessages) return;
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
  }, [showMessages, liveTick]);

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
  }, [showApprovals, liveTick]);

  useEffect(() => {
    if (!showMatRequests) return;
    (async () => {
      try {
        setMatReqCount(await materialRequestService.getPendingCount());
      } catch {
        // silent
      }
    })();
  }, [showMatRequests, liveTick]);

  // Top stat cards (admin only): active users, employees and projects, and revenue (money
  // actually received from clients). Each source loads on its own, and one that fails keeps
  // its last number instead of dropping to 0.
  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const [users, employees, projects, billing] = await Promise.all([
        userService.getAll().catch(() => null),
        employeeService.getAll().catch(() => null),
        projectService.getAll().catch(() => null),
        billingService.getOverview().catch(() => null),
      ]);
      setMetrics((prev) => ({
        users: users ? users.filter((u) => u.isActive).length : prev.users,
        employees: employees ? employees.filter((e) => e.status === "Active").length : prev.employees,
        projects: projects ? projects.filter((p) => p.status === "In Progress").length : prev.projects,
        revenue: billing ? (billing.projects || []).reduce((sum, p) => sum + (p.received || 0), 0) : prev.revenue,
        loaded: prev.loaded || !!(users || employees || projects || billing),
      }));
    };
    load();
  }, [isAdmin, liveTick]);

  const stats = [
    { label: "Active Users", value: metrics.loaded ? String(metrics.users) : "—", icon: "users" },
    { label: "Active Employees", value: metrics.loaded ? String(metrics.employees) : "—", icon: "user" },
    { label: "Active Projects", value: metrics.loaded ? String(metrics.projects) : "—", icon: "building" },
    { label: "Total Revenue", value: metrics.loaded ? moneyShort(metrics.revenue) : "—", words: metrics.loaded ? amountInWords(metrics.revenue) : "", icon: "dollar" },
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
      <div className="dash-welcome">
        <h2>Welcome, <span>{firstName}</span></h2>
        <p>Here's what's happening with {company.companyName} today.</p>
      </div>

      {isAdmin && (
        <div className="dash-stats">
          {stats.map((s) => (
            <div className="dash-stat-card" key={s.label}>
              <div className="dash-stat-icon">{statIcon(s.icon)}</div>
              <div className="dash-stat-value">{s.value}</div>
              {s.words && <div className="dash-stat-words">{s.words}</div>}
              <div className="dash-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action grid: only the cards this user may see */}
      {anyCard ? (
        <div className="dash-grid">
          {showMessages && (
            <button className="dash-mod-card" onClick={() => navigate("/dashboard/queries")}>
              <div className="dash-mod-top">
                <div className="dash-mod-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                </div>
                {!loadingQueries && unreadCount > 0 && <span className="dash-mod-count">{unreadCount}</span>}
              </div>
              <h3>Messages</h3>
              <p>New inquiries from your website</p>
            </button>
          )}

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

          {/* AI card spans both rows */}
          {showAI && (
            <button className="dash-ai-card" onClick={() => navigate("/dashboard/ai")}>
              <div className="dash-ai-glow" />
              <div className="dash-ai-content">
                <div className="dash-ai-top">
                  <div className="dash-ai-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" /><circle cx="8.5" cy="13.5" r="1.5" fill="currentColor" /><circle cx="15.5" cy="13.5" r="1.5" fill="currentColor" /></svg>
                  </div>
                  <span className="dash-ai-badge">Coming Soon</span>
                </div>
                <h3>AI Assistant</h3>
                <p>Chat with your intelligent construction assistant.</p>
              </div>
            </button>
          )}

          {showApprovals && (
            <button className="dash-mod-card" onClick={() => navigate("/dashboard/approvals")}>
              <div className="dash-mod-top">
                <div className="dash-mod-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                </div>
                {approvalCount > 0 && <span className="dash-mod-count">{approvalCount}</span>}
              </div>
              <h3>Pending Approvals</h3>
              <p>Requests waiting for your review</p>
            </button>
          )}

          {/* Material requests from the field */}
          {showMatRequests && (
            <button className="dash-mod-card" onClick={() => navigate("/dashboard/material-requests")}>
              <div className="dash-mod-top">
                <div className="dash-mod-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                </div>
                {matReqCount > 0 && <span className="dash-mod-count">{matReqCount}</span>}
              </div>
              <h3>Material Requests</h3>
              <p>Approve or reject site material requests</p>
            </button>
          )}

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
