import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import "./Dashboard.css";

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = (user?.fullName || user?.username || "there").split(" ")[0];

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

  return (
    <DashboardLayout title="Dashboard">
      {/* Welcome banner */}
      <div className="dash-welcome">
        <h2>Welcome back, <span>{firstName}</span></h2>
        <p>Here's what's happening with Anonymous Construction Co. today.</p>
      </div>

      {/* Stat cards */}
      <div className="dash-stats">
        {stats.map((s) => (
          <div className="dash-stat-card" key={s.label}>
            <div className="dash-stat-icon">{statIcon(s.icon)}</div>
            <div className="dash-stat-value">{s.value}</div>
            <div className="dash-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bottom grid: Queries (left) + Approvals/Control (right) */}
      <div className="dash-bottom">
        {/* QUERIES */}
        <div className="dash-queries">
          <div className="dash-queries-head">
            <div className="dash-queries-title">
              <div className="dash-queries-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </div>
              <div>
                <h3>Recent Queries</h3>
                <p>Latest messages from your website</p>
              </div>
            </div>
          </div>

          <div className="dash-queries-empty">
            <div className="dash-queries-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </div>
            <h4>No queries yet</h4>
            <p>Messages from your website contact form will appear here</p>
          </div>

          <button className="dash-queries-viewall" onClick={() => navigate("/dashboard/queries")}>
            View all queries →
          </button>
        </div>

        {/* RIGHT: Approvals + Control Unit */}
        <div className="dash-side-cards">
          <button className="dash-action-card" onClick={() => navigate("/dashboard/approvals")}>
            <div className="dash-action-top">
              <div className="dash-action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
              </div>
              <span className="dash-action-count">0</span>
            </div>
            <h3>Pending Approvals</h3>
            <p>Requests waiting for your review</p>
          </button>

          <button className="dash-action-card" onClick={() => navigate("/dashboard/control-unit")}>
            <div className="dash-action-top">
              <div className="dash-action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
            </div>
            <h3>Control Unit</h3>
            <p>Manage user access and permissions</p>
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;
