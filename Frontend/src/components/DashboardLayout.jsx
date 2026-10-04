import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionContext";
import { useDashboardTheme, usePreferences } from "../context/PreferencesContext";
import { notificationService } from "../services/notificationService";
import { alertService } from "../services/alertService";
import { demoService } from "../services/demoService";
import { DEMO_ENDED_EVENT, DEMO_NOTE_KEY, getDemoRole } from "../config/demoConfig";
import { NOTIFICATION_POLL_MS, ALERT_BASELINE_KEY } from "../config/notificationConfig";
import { ALERT_SEEN_KEY, ALERT_LIVE_MODULES } from "../config/alertConfig";
import { playNotificationSound, unlockNotificationSound } from "../utils/notificationSound";
import { onLive, isLiveConnected } from "../services/live";
import { useLiveRefresh } from "../hooks/useLive";
import { usePageTitle } from "../hooks/usePageTitle";
import { hasUnsavedChanges, LEAVE_REQUEST_EVENT } from "../hooks/useUnsavedChanges";
import ModalOverlay from "./ModalOverlay";
import DemoBar from "./DemoBar";
import "./DashboardLayout.css";

const DEMO_EXIT_NOTE = "You've left the demo. Thanks for exploring ACC!";
const DEMO_ENDED_NOTE = "Your demo session has ended. Thanks for exploring ACC!";

const readBaseline = (key = ALERT_BASELINE_KEY) => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

const writeBaseline = (value, key = ALERT_BASELINE_KEY) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
};

// Sidebar sections. Each item's "show" says who sees it:
//   always: everyone
//   adminOnly: only Admin
//   module: Admin, or anyone with View permission for that module
const navSections = [
  {
    title: "Main",
    items: [{ id: "dashboard", label: "Dashboard", path: "/dashboard", icon: "grid", show: "always" }],
  },
  {
    title: "Management",
    items: [
      { id: "users", label: "Users", path: "/dashboard/users", icon: "users", show: "adminOnly" },
      { id: "clients", label: "Clients", path: "/dashboard/clients", icon: "user-plus", show: "module", module: "Clients" },
      { id: "employees", label: "Employees", path: "/dashboard/employees", icon: "user", show: "module", module: "Employees" },
      { id: "materials", label: "Materials", path: "/dashboard/materials", icon: "box", show: "module", module: "Materials" },
      { id: "assignments", label: "Assignments", path: "/dashboard/assignments", icon: "calendar", show: "module", module: "Assignments" },
      { id: "projects", label: "Projects", path: "/dashboard/projects", icon: "building", show: "module", module: "Projects" },
    ],
  },
  {
    title: "Operations",
    items: [
      { id: "attendance", label: "Attendance", path: "/dashboard/attendance", icon: "clipboard", show: "module", module: "Attendance" },
      { id: "salaries", label: "Salaries", path: "/dashboard/salaries", icon: "card", show: "module", module: "Salaries" },
      { id: "billing", label: "Billing & Invoices", path: "/dashboard/billing", icon: "dollar", show: "module", module: "Billing" },
      { id: "field", label: "Field View", path: "/dashboard/field", icon: "hardhat", show: "module", module: "Field" },
      { id: "notifications", label: "Notifications", path: "/dashboard/notifications", icon: "bell", show: "always" },
      { id: "alerts", label: "Alerts", path: "/dashboard/alerts", icon: "alert", show: "always" },
    ],
  },
  {
    title: "Account",
    items: [
      { id: "settings", label: "Settings", path: "/dashboard/settings", icon: "settings", show: "always" },
    ],
  },
];

function Icon({ name }) {
  const icons = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
    "check-square": <><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    "user-plus": <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    box: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    building: <><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></>,
    clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></>,
    card: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
    dollar: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    hardhat: <><path d="M2 18a10 10 0 0 1 20 0" /><line x1="1" y1="18" x2="23" y2="18" /><path d="M10 5a2 2 0 0 1 4 0v4" /><path d="M8 9V6" /><path d="M16 9V6" /></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.grid}
    </svg>
  );
}

function DashboardLayout({ title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [leaveTo, setLeaveTo] = useState(null);
  const { user, logout, signOut, login, demoTransition, runDemoTransition } = useAuth();
  const { canView, isAdmin } = usePermissions();
  useDashboardTheme();
  usePageTitle(title);
  const { prefs } = usePreferences();
  const soundOn = prefs.notificationSound !== false;
  const soundRef = useRef(soundOn);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

  // A page's own Back button asking to leave while something is unsaved
  useEffect(() => {
    const ask = (e) => setLeaveTo(() => e.detail);
    window.addEventListener(LEAVE_REQUEST_EVENT, ask);
    return () => window.removeEventListener(LEAVE_REQUEST_EVENT, ask);
  }, []);
  const navigate = useNavigate();
  const location = useLocation();

  // Live demo visitor (null for normal users)
  const demo = user?.demo || null;
  const endingDemo = useRef(false);

  // Ends the visitor's demo: frees their seat (the server deletes their data), signs them
  // out, and returns to the login page with a short note.
  const endDemo = useCallback(async (note) => {
    if (endingDemo.current) return;
    endingDemo.current = true;
    try {
      await demoService.end();
    } catch {
      // The session may already be gone on the server; signing out locally is enough.
    }
    sessionStorage.setItem(DEMO_NOTE_KEY, note);
    logout();
    navigate("/login");
  }, [logout, navigate]);

  // The server says the session is over (time ran out, or it was ended elsewhere).
  useEffect(() => {
    if (!demo) return;
    const onEnded = () => endDemo(DEMO_ENDED_NOTE);
    window.addEventListener(DEMO_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(DEMO_ENDED_EVENT, onEnded);
  }, [demo, endDemo]);

  // Switch between Admin / Manager / Site Engineer inside the same demo.
  const switchDemoRole = async (roleKey) => {
    try {
      await runDemoTransition(roleKey, "Switching to", async () => {
        const data = await demoService.switchRole(roleKey);
        // Change the user and the page in one render. Otherwise the current page (eg
        // Notifications) would briefly open as the new user and could mark their new
        // notifications as read.
        startTransition(() => {
          login(data);
          navigate("/dashboard");
        });
      });
    } catch (err) {
      if (err.response?.status === 401) return;   // session over: handled by the ended event
      throw new Error(err.response?.data?.message || `Couldn't switch to ${getDemoRole(roleKey).label}.`, { cause: err });
    }
  };

  const who = user ? `${user.userID}:${user.username}` : null;

  // Unread count for the bell and the sidebar badge (plays a sound when new alerts arrive).
  useEffect(() => {
    const loadCount = async () => {
      try {
        const { count, alerts } = await notificationService.getUnreadCounts();
        const seen = readBaseline();
        if (seen?.who === who && alerts > seen.alerts && soundRef.current) playNotificationSound();
        writeBaseline({ who, alerts });
        setUnreadCount(count);
      } catch {
        // the badge keeps its last count
      }
    };
    loadCount();

    // Refresh the badge as soon as notifications are marked read.
    const onUpdate = () => loadCount();
    window.addEventListener("notifications-updated", onUpdate);
    const offLive = onLive("notifications", onUpdate);
    const offSync = onLive("resync", onUpdate);
    const timer = setInterval(() => {
      if (!isLiveConnected() && document.visibilityState === "visible") loadCount();
    }, NOTIFICATION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && !isLiveConnected()) loadCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", unlockNotificationSound, { once: true });
    return () => {
      window.removeEventListener("notifications-updated", onUpdate);
      window.removeEventListener("pointerdown", unlockNotificationSound);
      document.removeEventListener("visibilitychange", onVisible);
      offLive();
      offSync();
      clearInterval(timer);
    };
  }, [location.pathname, who]);

  useEffect(() => {
    const loadAlerts = async () => {
      if (!who) return;
      try {
        const { open = 0, latestId = 0 } = await alertService.getSummary();
        const seen = readBaseline(ALERT_SEEN_KEY);
        if (seen?.who === who && latestId > seen.latestId && soundRef.current) playNotificationSound();
        writeBaseline({ who, latestId: Math.max(latestId, seen?.who === who ? seen.latestId : 0) }, ALERT_SEEN_KEY);
        setOpenAlerts(open);
      } catch {
        return;
      }
    };
    loadAlerts();
    const onUpdate = () => loadAlerts();
    window.addEventListener("alerts-updated", onUpdate);
    const timer = setInterval(() => {
      if (!isLiveConnected() && document.visibilityState === "visible") loadAlerts();
    }, NOTIFICATION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && !isLiveConnected()) loadAlerts();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("alerts-updated", onUpdate);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [who]);

  useLiveRefresh(ALERT_LIVE_MODULES, () => window.dispatchEvent(new Event("alerts-updated")), { delay: 250 });

  // The mobile menu closes when the page changes.
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setSidebarOpen(false);
  }

  // The mobile menu closes with the Escape key too.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  const leaveOrAsk = (action) => {
    setSidebarOpen(false);
    if (hasUnsavedChanges()) {
      setLeaveTo(() => action);
      return;
    }
    action();
  };

  const handleLogout = () => leaveOrAsk(logoutNow);

  const logoutNow = () => {
    // A demo visitor logging out also frees their demo seat.
    if (demo) {
      endDemo(DEMO_EXIT_NOTE);
      return;
    }
    // The session also ends on the server, so this token can't be used again.
    signOut({ to: "/" });
    navigate("/");
  };

  const isActive = (path) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const go = (path) => {
    if (path === location.pathname) {
      setSidebarOpen(false);
      return;
    }
    leaveOrAsk(() => navigate(path));
  };

  const canShow = (item) => {
    if (item.show === "always") return true;
    if (item.show === "adminOnly") return isAdmin;
    if (item.show === "module") return isAdmin || canView(item.module);
    return false;
  };

  // Sections with nothing to show are dropped.
  const visibleSections = navSections
    .map((section) => ({ ...section, items: section.items.filter(canShow) }))
    .filter((section) => section.items.length > 0);

  const displayName = user?.fullName || user?.username || "User";
  const initials = displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const role = user?.role || "User";
  const photo = user?.profilePicture || null;

  return (
    <div className="dash-layout">
      {sidebarOpen && <div className="dash-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`dash-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="dash-logo">
          <span className="dash-logo-mark">ACC</span>
          <span className="dash-logo-divider" />
          <span className="dash-logo-text">Admin<br />Portal</span>
          <button className="dash-drawer-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <nav className="dash-nav">
          {visibleSections.map((section, idx) => (
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
                  {item.id === "notifications" && unreadCount > 0 && (
                    <span className="dash-nav-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                  )}
                  {item.id === "alerts" && openAlerts > 0 && <span className="dash-nav-dot" aria-label="Open alerts" />}
                </button>
              ))}
              {/* Logout sits inside the last section, with no gap of its own */}
              {idx === visibleSections.length - 1 && (
                <button className="dash-nav-item dash-nav-logout" onClick={handleLogout}>
                  <span className="dash-nav-icon"><Icon name="logout" /></span>
                  Logout
                </button>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="dash-main">
        {demo && (
          <DemoBar
            role={demo.role}
            roleLabel={demo.label}
            endsAt={demo.endsAt}
            busy={!!demoTransition}
            onSwitch={switchDemoRole}
            onExit={() => endDemo(DEMO_EXIT_NOTE)}
            onExpire={() => endDemo(DEMO_ENDED_NOTE)}
          />
        )}

        <header className="dash-header">
          <div className="dash-header-left">
            <button className="dash-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu" aria-expanded={sidebarOpen}>
              <Icon name="menu" />
            </button>
            <h1 className="dash-title">{title}</h1>
          </div>

          <div className="dash-header-right">
            <button
              type="button"
              className={`dash-alerts ${openAlerts > 0 ? "has-open" : ""} ${isActive("/dashboard/alerts") ? "active" : ""}`}
              onClick={() => go("/dashboard/alerts")}
              aria-label={openAlerts > 0 ? `Alerts: ${openAlerts} open` : "Alerts: none open"}
              title={openAlerts > 0 ? `${openAlerts} open alert${openAlerts === 1 ? "" : "s"}` : "No open alerts"}
            >
              <Icon name="alert" />
              <span className="dash-alerts-label">Alerts</span>
              {openAlerts > 0 && <span className="dash-alerts-dot" aria-hidden="true" />}
            </button>
            <button className="dash-bell" onClick={() => go("/dashboard/notifications")}>
              <Icon name="bell" />
              {unreadCount > 0 && <span className="dash-bell-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>

            <div className="dash-profile">
              <button className="dash-profile-btn" onClick={() => go("/dashboard/profile")} title="View profile">
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

        {/* After a demo role switch the new dashboard fades in as the role card fades out */}
        <main className={`dash-content ${demoTransition?.phase === "out" ? "dash-content-enter" : ""}`}>
          {children}
        </main>

        {leaveTo && (
          <ModalOverlay className="dash-leave-overlay" onClose={() => setLeaveTo(null)} label="Unsaved changes">
            <div className="mdo-confirm">
              <h3>Leave without saving?</h3>
              <p>You have changes on this page that are not saved yet. If you leave now, they will be lost.</p>
              <div className="mdo-confirm-actions">
                <button type="button" className="mdo-keep" data-close onClick={() => setLeaveTo(null)} autoFocus>Stay on this page</button>
                <button type="button" className="mdo-discard" onClick={() => { const action = leaveTo; setLeaveTo(null); action(); }}>Leave</button>
              </div>
            </div>
          </ModalOverlay>
        )}
      </div>
    </div>
  );
}

export default DashboardLayout;
