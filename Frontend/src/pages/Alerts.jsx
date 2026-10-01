import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Toast, { useToast } from "../components/Toast";
import { usePermissions } from "../context/PermissionContext";
import { alertService } from "../services/alertService";
import { formatDateTime } from "../utils/dates";
import { useLiveRefresh } from "../hooks/useLive";
import { ALERT_GROUPS, ALERT_SEVERITY } from "../config/alertConfig";
import "./Alerts.css";
import { SkeletonRows } from "../components/Skeleton";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";

const GROUP_ICONS = {
  Money: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
  "Stock and requests": <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
  Projects: <><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></>,
  Team: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  Security: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
};

const severityClass = (severity) => `al-sev-${(severity || "Info").toLowerCase()}`;

function Alerts() {
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Open");
  const [group, setGroup] = useState("All");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [resolving, setResolving] = useState(null);
  const [toast, showToast] = useToast(3000);
  const tabRef = useRef(tab);

  useEffect(() => {
    tabRef.current = tab;
    let cancelled = false;
    const fetchAlerts = async () => {
      try {
        const data = await alertService.getAll(tab);
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
        setError("");
      } catch {
        if (!cancelled) setError("Could not load alerts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAlerts();
    return () => { cancelled = true; };
  }, [tab]);

  const refresh = async () => {
    const status = tabRef.current;
    try {
      const data = await alertService.getAll(status);
      if (tabRef.current === status) setItems(Array.isArray(data) ? data : []);
    } catch {
      return;
    }
  };

  useLiveRefresh(["alerts", "alert-rules", "permissions"], refresh);

  const switchTab = (next) => {
    if (next === tab) return;
    setTab(next);
    setGroup("All");
    setLoading(true);
    setError("");
  };

  const groups = ALERT_GROUPS.filter((g) => items.some((a) => a.group === g));
  const activeGroup = group !== "All" && groups.includes(group) ? group : "All";
  const shown = activeGroup === "All" ? items : items.filter((a) => a.group === activeGroup);
  const paging = usePagination(shown, { resetKey: `${tab}|${activeGroup}` });

  const open = (a) => {
    if (a.link) navigate(a.link);
  };

  const resolve = async (a) => {
    setResolving(a.alertID);
    try {
      await alertService.resolve(a.alertID);
      setItems((prev) => prev.filter((x) => x.alertID !== a.alertID));
      window.dispatchEvent(new Event("alerts-updated"));
      showToast("Alert marked as resolved.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not resolve this alert.", "error");
    } finally {
      setResolving(null);
    }
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      const summary = await alertService.checkNow();
      await refresh();
      window.dispatchEvent(new Event("alerts-updated"));
      const count = summary?.open ?? 0;
      showToast(count === 0 ? "Checked. Everything looks fine." : `Checked. ${count} open alert${count === 1 ? "" : "s"}.`);
    } catch {
      showToast("Could not run the check. Please try again.", "error");
    } finally {
      setChecking(false);
    }
  };

  return (
    <DashboardLayout title="Alerts">
      <div className="al-head">
        <div>
          <h2>Alerts</h2>
          <p>Problems the system found that need attention. An alert moves to Resolved by itself once the problem is fixed.</p>
        </div>
        {isAdmin && (
          <div className="al-head-actions">
            <button type="button" className="al-btn" onClick={checkNow} disabled={checking}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={checking ? "al-spin" : ""}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
              {checking ? "Checking..." : "Check now"}
            </button>
            <Link className="al-btn" to="/dashboard/settings?tab=alerts">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
              Alert rules
            </Link>
          </div>
        )}
      </div>

      <div className="al-tabs" role="tablist">
        {["Open", "Resolved"].map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => switchTab(t)}>
            {t}
            {t === "Open" && tab === "Open" && !loading && items.length > 0 && <span className="al-tab-count">{items.length}</span>}
          </button>
        ))}
      </div>

      {groups.length > 1 && (
        <div className="al-filters" aria-label="Filter by area">
          {["All", ...groups].map((g) => (
            <button key={g} type="button" className={activeGroup === g ? "active" : ""} aria-pressed={activeGroup === g} onClick={() => setGroup(g)}>
              {g}
              <span>{g === "All" ? items.length : items.filter((a) => a.group === g).length}</span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="al-error">{error}</div>}

      {loading ? (
        <SkeletonRows count={5} />
      ) : shown.length === 0 ? (
        <div className="al-empty">
          <div className={`al-empty-icon ${tab === "Open" ? "ok" : ""}`}>
            {tab === "Open" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            )}
          </div>
          <h3>{tab === "Open" ? "All clear" : "Nothing resolved yet"}</h3>
          <p>{tab === "Open" ? "No open alerts right now. When the system finds a problem it shows up here and the Alerts button gets an orange dot." : "Alerts resolved in the last 30 days appear here."}</p>
        </div>
      ) : (
        <>
          <div className="al-list">
            {paging.pageItems.map((a) => {
              const severity = ALERT_SEVERITY[a.severity] || ALERT_SEVERITY.Info;
              const resolved = a.status === "Resolved";
              return (
                <article
                  key={a.alertID}
                  className={`al-item ${severityClass(a.severity)} ${resolved ? "resolved" : ""} ${a.link ? "al-link" : ""}`}
                  role={a.link ? "link" : undefined}
                  tabIndex={a.link ? 0 : undefined}
                  onClick={a.link ? () => open(a) : undefined}
                  onKeyDown={a.link ? (e) => { if (e.key === "Enter") open(a); } : undefined}
                >
                  <div className="al-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{GROUP_ICONS[a.group] || GROUP_ICONS.Projects}</svg>
                  </div>
                  <div className="al-body">
                    <div className="al-meta">
                      {resolved ? <span className="al-badge al-badge-done">Resolved</span> : <span className="al-badge">{severity.label}</span>}
                      <span className="al-group">{a.group}</span>
                      <time className="al-time" dateTime={resolved ? a.resolvedAt : a.createdAt}>
                        {resolved ? `Resolved ${formatDateTime(a.resolvedAt)}` : `Since ${formatDateTime(a.createdAt)}`}
                      </time>
                    </div>
                    <strong className="al-title">{a.title}</strong>
                    <p className="al-message">{a.message}</p>
                    {(a.link || a.canResolve) && (
                      <div className="al-actions">
                        {a.link && (
                          <span className="al-open">
                            Open
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                          </span>
                        )}
                        {a.canResolve && (
                          <button
                            type="button"
                            className="al-resolve"
                            disabled={resolving === a.alertID}
                            onClick={(e) => { e.stopPropagation(); resolve(a); }}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {resolving === a.alertID ? "Saving..." : "It was me, mark resolved"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination {...paging} label="alerts" />
        </>
      )}

      <Toast toast={toast} />
    </DashboardLayout>
  );
}

export default Alerts;
