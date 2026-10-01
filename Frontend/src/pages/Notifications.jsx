import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { notificationService } from "../services/notificationService";
import { formatDateTime } from "../utils/dates";
import { useLiveNotifications } from "../hooks/useLive";
import "./Notifications.css";
import ModalOverlay from "../components/ModalOverlay";
import { SkeletonRows } from "../components/Skeleton";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";
import { useLoader } from "../hooks/useLoader";

// Icon and colour for each category
const categoryStyle = (cat) => {
  const map = {
    Login: { icon: "login", cls: "nt-cat-login" },
    Security: { icon: "shield", cls: "nt-cat-security" },
    Project: { icon: "building", cls: "nt-cat-project" },
    Assignment: { icon: "clipboard", cls: "nt-cat-assignment" },
    Material: { icon: "box", cls: "nt-cat-material" },
    Client: { icon: "user", cls: "nt-cat-client" },
    Employee: { icon: "users", cls: "nt-cat-employee" },
    Approval: { icon: "check", cls: "nt-cat-approval" },
    "Material Requests": { icon: "box", cls: "nt-cat-approval" },
    Expense: { icon: "receipt", cls: "nt-cat-expense" },
    Billing: { icon: "dollar", cls: "nt-cat-billing" },
    Salary: { icon: "card", cls: "nt-cat-salary" },
    Message: { icon: "mail", cls: "nt-cat-message" },
    General: { icon: "bell", cls: "nt-cat-general" },
  };
  return map[cat] || map.General;
};

function CatIcon({ name }) {
  const icons = {
    login: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    check: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
    box: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
    receipt: <><path d="M5 2h14v20l-3.5-2-3.5 2-3.5-2L5 22z" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" /></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    building: <><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></>,
    clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></>,
    dollar: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    card: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icons[name] || icons.bell}</svg>;
}

function Notifications() {
  const { isAdmin } = usePermissions();
  const [tab, setTab] = useState("Personal"); // Personal | Activity
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const shownTab = useRef(tab);

  const load = async (type, { quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
      setError("");
    }
    try {
      const data = await notificationService.getMine(type);
      if (shownTab.current !== type) return;
      setItems(data);
      // Opening the tab marks all as read (only personal ones count toward the bell).
      if (type === "Personal" && data.some((n) => !n.isRead)) {
        if (quiet) await new Promise((resolve) => setTimeout(resolve, 1500));
        await notificationService.markAllRead("Personal");
        // Tell the layout to refresh its unread badge immediately
        window.dispatchEvent(new Event("notifications-updated"));
      }
    } catch {
      if (!quiet) setError("Could not load notifications.");
    } finally {
      if (!quiet && shownTab.current === type) setLoading(false);
    }
  };

  useLoader(() => { shownTab.current = tab; load(tab); }, tab);

  useLiveNotifications(({ types, resync }) => {
    if (resync || !types || types.includes(tab)) load(tab, { quiet: true });
  });

  const navigate = useNavigate();
  const open = (n) => {
    if (n.link) navigate(n.link);
  };

  const handleDelete = async (id) => {
    try {
      await notificationService.delete(id);
      setItems((prev) => prev.filter((n) => n.notificationID !== id));
      showToast("Notification deleted.", "error");
    } catch {
      showToast("Could not delete.", "error");
    }
  };

  const handleDeleteAll = async () => {
    try {
      await notificationService.deleteAll(tab);
      setItems([]);
      setConfirmDeleteAll(false);
      showToast("All notifications cleared.", "error");
    } catch {
      showToast("Could not clear notifications.", "error");
    }
  };

  const paging = usePagination(items, { resetKey: tab });

  return (
    <DashboardLayout title="Notifications">
      <div className="nt-head">
        <div>
          <h2>Notifications</h2>
          <p>{tab === "Personal" ? "Things for you: results of your requests, requests waiting for you, and your own changes." : "A log of what other users did. Notification settings don't change this log."}</p>
        </div>
        <div className="nt-head-actions">
          <Link className="nt-settings" to="/dashboard/settings?tab=notifications">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            Settings
          </Link>
          {items.length > 0 && (
            <button className="nt-clear" onClick={() => setConfirmDeleteAll(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Tabs: My Notifications always; Team Activity only for admins */}
      <div className="nt-tabs">
        <button className={tab === "Personal" ? "active" : ""} onClick={() => setTab("Personal")}>My Notifications</button>
        {isAdmin && (
          <button className={tab === "Activity" ? "active" : ""} onClick={() => setTab("Activity")}>Team Activity</button>
        )}
      </div>

      {error && <div className="nt-error">{error}</div>}

      {loading ? (
        <SkeletonRows count={6} />
      ) : items.length === 0 ? (
        <div className="nt-empty">
          <div className="nt-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          </div>
          <h3>Nothing here yet</h3>
          <p>{tab === "Personal" ? "Your notifications will appear here." : "What other users do will appear here."}</p>
        </div>
      ) : (
        <>
          <div className="nt-list">
            {paging.pageItems.map((n) => {
              const style = categoryStyle(n.category);
              return (
                <div
                  key={n.notificationID}
                  className={`nt-item ${!n.isRead && tab === "Personal" ? "unread" : ""} ${n.link ? "nt-link" : ""}`}
                  role={n.link ? "link" : undefined}
                  tabIndex={n.link ? 0 : undefined}
                  onClick={n.link ? () => open(n) : undefined}
                  onKeyDown={n.link ? (e) => { if (e.key === "Enter") open(n); } : undefined}
                >
                  <div className={`nt-icon ${style.cls}`}><CatIcon name={style.icon} /></div>
                  <div className="nt-body">
                    <div className="nt-title-row">
                      <strong>{n.title}</strong>
                      <span className="nt-time">{formatDateTime(n.createdAt)}</span>
                    </div>
                    <p className="nt-message">{n.message}</p>
                    {n.reason && <p className="nt-reason">Reason: {n.reason}</p>}
                    {n.link && (
                      <span className="nt-open">
                        Open
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                      </span>
                    )}
                  </div>
                  <button className="nt-delete" onClick={(e) => { e.stopPropagation(); handleDelete(n.notificationID); }} onKeyDown={(e) => e.stopPropagation()} aria-label="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
          <Pagination {...paging} label="notifications" />
        </>
      )}

      {/* Confirm delete all */}
      {confirmDeleteAll && (
        <ModalOverlay className="nt-overlay" onClose={() => setConfirmDeleteAll(false)}>
          <div className="nt-confirm">
            <div className="nt-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h3>Clear all notifications?</h3>
            <p>All {tab === "Personal" ? "your" : "team activity"} notifications will be permanently removed.</p>
            <div className="nt-confirm-actions">
              <button className="nt-confirm-cancel" data-close onClick={() => setConfirmDeleteAll(false)}>Cancel</button>
              <button className="nt-confirm-delete" onClick={handleDeleteAll}>Clear All</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {toast && <div className={`nt-toast nt-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default Notifications;
