import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./DashboardLayout.css";

const navSections = [
  {
    title: "Main",
    items: [{ id: "dashboard", label: "Dashboard", path: "/dashboard", icon: "grid" }],
  },
  {
    title: "Management",
    items: [
      { id: "users", label: "Users", path: "/dashboard/users", icon: "users" },
      { id: "clients", label: "Clients", path: "/dashboard/clients", icon: "user-plus" },
      { id: "employees", label: "Employees", path: "/dashboard/employees", icon: "user" },
      { id: "materials", label: "Materials", path: "/dashboard/materials", icon: "box" },
      { id: "assignments", label: "Assignments", path: "/dashboard/assignments", icon: "calendar" },
      { id: "projects", label: "Projects", path: "/dashboard/projects", icon: "building" },
    ],
  },
  {
    title: "Operations",
    items: [
      { id: "attendance", label: "Attendance", path: "/dashboard/attendance", icon: "clipboard" },
      { id: "salaries", label: "Salaries", path: "/dashboard/salaries", icon: "card" },
      { id: "billing", label: "Billing & Invoices", path: "/dashboard/billing", icon: "dollar" },
      { id: "notifications", label: "Notifications", path: "/dashboard/notifications", icon: "bell" },
    ],
  },
  {
    title: "Account",
    items: [
      { id: "settings", label: "Settings", path: "/dashboard/settings", icon: "settings" },
    ],
  },
];

function Icon({ name }) {
  const icons = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    "user-plus": <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    box: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    building: <><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></>,
    clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></>,
    card: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
    dollar: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.grid}
    </svg>
  );
}

function DashboardLayout({ title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const isActive = (path) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const go = (path) => {
    setSidebarOpen(false);
    navigate(path);
  };

  const displayName = user?.fullName || user?.username || "User";
  const initials = displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const role = user?.role || "User";
  const photo = user?.profilePicture || null;

  return (
    <div className="dash-layout">
      {sidebarOpen && <div className="dash-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <aside className={`dash-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="dash-logo">
          <span className="dash-logo-mark">ACC</span>
          <span className="dash-logo-divider" />
          <span className="dash-logo-text">Admin<br />Portal</span>
        </div>

        <nav className="dash-nav">
          {navSections.map((section, idx) => (
            <div className="dash-nav-section" key={section.title}>
              <div className="dash-nav-title">{section.title}</div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className={`dash-nav-item ${isActive(item.path) ? "active" : ""}`}
                  onClick={() => go(item.path)}
                >
                  <span className="dash-nav-icon"><Icon name={item.icon} /></span>
                  {item.label}
                </button>
              ))}
              {/* Logout sits inside the last (Account) section - no separate gap */}
              {idx === navSections.length - 1 && (
                <button className="dash-nav-item dash-nav-logout" onClick={handleLogout}>
                  <span className="dash-nav-icon"><Icon name="logout" /></span>
                  Logout
                </button>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* MAIN */}
      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-header-left">
            <button className="dash-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <Icon name="menu" />
            </button>
            <h1 className="dash-title">{title}</h1>
          </div>

          <div className="dash-header-right">
            <button className="dash-bell" onClick={() => navigate("/dashboard/notifications")}>
              <Icon name="bell" />
              <span className="dash-bell-count">0</span>
            </button>

            <div className="dash-profile">
              <button className="dash-profile-btn" onClick={() => navigate("/dashboard/profile")} title="View profile">
                {photo ? (
                  <img src={photo} alt="" className="dash-avatar-img" />
                ) : (
                  <span className="dash-avatar">{initials}</span>
                )}
                <span className="dash-profile-info">
                  <strong>{displayName}</strong>
                  <span>{role}</span>
                </span>
              </button>
            </div>
          </div>
        </header>

        <main className="dash-content">{children}</main>
      </div>
    </div>
  );
}

export default DashboardLayout;
