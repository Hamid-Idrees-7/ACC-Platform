import { useState, useEffect } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { notificationService } from "../services/notificationService";
import "./Notifications.css";

const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
};

// Icon + colour per category
const categoryStyle = (cat) => {
  const map = {
    Login: { icon: "login", cls: "nt-cat-login" },
    Client: { icon: "user", cls: "nt-cat-client" },
    Employee: { icon: "users", cls: "nt-cat-employee" },
    Approval: { icon: "check", cls: "nt-cat-approval" },
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
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
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

  const load = async (type) => {
    setLoading(true);
    setError("");
    try {
      const data = await notificationService.getMine(type);
      setItems(data);
      // Mark all as read on view (only personal counts toward the bell)
      if (type === "Personal" && data.some((n) => !n.isRead)) {
        await notificationService.markAllRead("Personal");
        // Tell the layout to refresh its unread badge immediately
        window.dispatchEvent(new Event("notifications-updated"));
      }
    } catch {
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab]);

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

  return (
    <DashboardLayout title="Notifications">
      <div className="nt-head">
        <div>
          <h2>Notifications</h2>
          <p>Your activity and updates.</p>
        </div>
        {items.length > 0 && (
          <button className="nt-clear" onClick={() => setConfirmDeleteAll(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            Clear All
          </button>
        )}
      </div>

      {/* Tabs: My Activity always; Users Activity only for admins */}
      <div className="nt-tabs">
        <button className={tab === "Personal" ? "active" : ""} onClick={() => setTab("Personal")}>My Activity</button>
        {isAdmin && (
          <button className={tab === "Activity" ? "active" : ""} onClick={() => setTab("Activity")}>Users Activity</button>
        )}
      </div>

      {error && <div className="nt-error">{error}</div>}

      {loading ? (
        <div className="nt-empty"><div className="nt-spinner" /><p>Loading...</p></div>
      ) : items.length === 0 ? (
        <div className="nt-empty">
          <div className="nt-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          </div>
          <h3>Nothing here yet</h3>
          <p>{tab === "Personal" ? "Your activity and updates will appear here." : "Team activity will appear here."}</p>
        </div>
      ) : (
        <div className="nt-list">
          {items.map((n) => {
            const style = categoryStyle(n.category);
            return (
              <div key={n.notificationID} className={`nt-item ${!n.isRead && tab === "Personal" ? "unread" : ""}`}>
                <div className={`nt-icon ${style.cls}`}><CatIcon name={style.icon} /></div>
                <div className="nt-body">
                  <div className="nt-title-row">
                    <strong>{n.title}</strong>
                    <span className="nt-time">{formatDateTime(n.createdAt)}</span>
                  </div>
                  <p className="nt-message">{n.message}</p>
                  {n.reason && <p className="nt-reason">Reason: {n.reason}</p>}
                </div>
                <button className="nt-delete" onClick={() => handleDelete(n.notificationID)} aria-label="Delete">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete all */}
      {confirmDeleteAll && (
        <div className="nt-overlay" onClick={(e) => e.target.classList.contains("nt-overlay") && setConfirmDeleteAll(false)}>
          <div className="nt-confirm">
            <div className="nt-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h3>Clear all notifications?</h3>
            <p>All {tab === "Personal" ? "your" : "team activity"} notifications will be permanently removed.</p>
            <div className="nt-confirm-actions">
              <button className="nt-confirm-cancel" onClick={() => setConfirmDeleteAll(false)}>Cancel</button>
              <button className="nt-confirm-delete" onClick={handleDeleteAll}>Clear All</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`nt-toast nt-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default Notifications;
