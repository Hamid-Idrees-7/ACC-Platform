import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { approvalService } from "../services/approvalService";
import "./Approvals.css";

// Format a datetime like "11 August 2026, 3:45 PM"
const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
};

function Approvals() {
  const { can } = usePermissions();
  const canManage = can("Approvals", "Manage");
  const canDelete = can("Approvals", "Delete");

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Pending"); // Pending | All | Approved | Rejected

  const [detail, setDetail] = useState(null);      // request being viewed
  const [reason, setReason] = useState("");
  const [resolving, setResolving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null); // single delete
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await approvalService.getAll();
      setRequests(data);
    } catch {
      setError("Could not load approval requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    pending: requests.filter((r) => r.status === "Pending").length,
    approved: requests.filter((r) => r.status === "Approved").length,
    rejected: requests.filter((r) => r.status === "Rejected").length,
    all: requests.length,
  }), [requests]);

  const filtered = useMemo(() => {
    if (filter === "All") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const openDetail = (req) => {
    setDetail(req);
    setReason("");
  };

  const handleResolve = async (status) => {
    setResolving(true);
    try {
      await approvalService.resolve(detail.pendingActionID, status, reason.trim() || null);
      showToast(`Request ${status.toLowerCase()}.`, status === "Approved" ? "success" : "error");
      setDetail(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not resolve request.", "error");
    } finally {
      setResolving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await approvalService.delete(id);
      showToast("Request deleted.", "error");
      setConfirmDelete(null);
      setDetail(null);
      load();
    } catch {
      showToast("Could not delete request.", "error");
    }
  };

  const handleDeleteAll = async () => {
    try {
      await approvalService.deleteAll();
      showToast("All requests deleted.", "error");
      setConfirmDeleteAll(false);
      load();
    } catch {
      showToast("Could not delete requests.", "error");
    }
  };

  const statusBadge = (status) => {
    const map = { Pending: "ap-badge-pending", Approved: "ap-badge-approved", Rejected: "ap-badge-rejected" };
    return <span className={`ap-badge ${map[status] || ""}`}>{status}</span>;
  };

  const tabs = [
    { key: "Pending", label: `Pending (${counts.pending})` },
    { key: "Approved", label: `Approved (${counts.approved})` },
    { key: "Rejected", label: `Rejected (${counts.rejected})` },
    { key: "All", label: `All (${counts.all})` },
  ];

  return (
    <DashboardLayout title="Approvals">
      <div className="ap-head">
        <div>
          <h2>Approval Requests</h2>
          <p>Review and resolve action requests from your team.</p>
        </div>
        {requests.length > 0 && canDelete && (
          <button className="ap-delete-all" onClick={() => setConfirmDeleteAll(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            Delete All
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="ap-tabs">
        {tabs.map((t) => (
          <button key={t.key} className={filter === t.key ? "active" : ""} onClick={() => setFilter(t.key)}>{t.label}</button>
        ))}
      </div>

      {error && <div className="ap-error">{error}</div>}

      {loading ? (
        <div className="ap-empty"><div className="ap-spinner" /><p>Loading requests...</p></div>
      ) : filtered.length === 0 ? (
        <div className="ap-empty">
          <div className="ap-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
          </div>
          <h3>No {filter !== "All" ? filter.toLowerCase() : ""} requests</h3>
          <p>Requests that need your approval will appear here.</p>
        </div>
      ) : (
        <div className="ap-list">
          {filtered.map((r) => (
            <div key={r.pendingActionID} className="ap-card" onClick={() => openDetail(r)}>
              <div className="ap-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </div>
              <div className="ap-card-body">
                <div className="ap-card-title">
                  <strong>{r.requestedByName}</strong>
                  <span className="ap-card-role">{r.requestedByRole}</span>
                  {statusBadge(r.status)}
                </div>
                <p className="ap-card-text">
                  Requested to <strong>{r.action}</strong> {r.module.replace(/s$/, "").toLowerCase()}: <strong>{r.targetName}</strong>
                </p>
                <span className="ap-card-time">{formatDateTime(r.createdAt)}</span>
              </div>
              <svg className="ap-card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="ap-overlay" onClick={(e) => e.target.classList.contains("ap-overlay") && setDetail(null)}>
          <div className="ap-detail">
            <button className="ap-detail-close" onClick={() => setDetail(null)} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>

            <div className="ap-detail-head">
              <h3>Approval Request</h3>
              {statusBadge(detail.status)}
            </div>

            <div className="ap-detail-info">
              <div className="ap-detail-row"><span>Requested by</span><strong>{detail.requestedByName} ({detail.requestedByRole})</strong></div>
              <div className="ap-detail-row"><span>Action</span><strong>{detail.action} {detail.module.replace(/s$/, "").toLowerCase()}</strong></div>
              <div className="ap-detail-row"><span>Target</span><strong>{detail.targetName}</strong></div>
              <div className="ap-detail-row"><span>Requested at</span><strong>{formatDateTime(detail.createdAt)}</strong></div>
              {detail.status !== "Pending" && detail.resolvedAt && (
                <div className="ap-detail-row"><span>Resolved at</span><strong>{formatDateTime(detail.resolvedAt)}</strong></div>
              )}
              {detail.reason && (
                <div className="ap-detail-row"><span>Reason</span><strong>{detail.reason}</strong></div>
              )}
            </div>

            {detail.status === "Pending" && canManage && (
              <>
                <div className="ap-reason">
                  <label>Reason <span>(optional)</span></label>
                  <textarea rows="2" placeholder="Add a note for the requester..." value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
                </div>
                <div className="ap-detail-actions">
                  <button className="ap-reject" onClick={() => handleResolve("Rejected")} disabled={resolving}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    Reject
                  </button>
                  <button className="ap-approve" onClick={() => handleResolve("Approved")} disabled={resolving}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Approve
                  </button>
                </div>
              </>
            )}

            {detail.status === "Pending" && !canManage && (
              <div className="ap-view-note">You have view-only access to this request.</div>
            )}

            {detail.status !== "Pending" && canDelete && (
              <div className="ap-detail-actions">
                <button className="ap-detail-delete" onClick={() => setConfirmDelete(detail)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  Delete Request
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm delete single */}
      {confirmDelete && (
        <div className="ap-overlay" onClick={(e) => e.target.classList.contains("ap-overlay") && setConfirmDelete(null)}>
          <div className="ap-confirm">
            <div className="ap-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h3>Delete this request?</h3>
            <p>This request record will be permanently removed.</p>
            <div className="ap-confirm-actions">
              <button className="ap-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="ap-confirm-delete" onClick={() => handleDelete(confirmDelete.pendingActionID)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete all */}
      {confirmDeleteAll && (
        <div className="ap-overlay" onClick={(e) => e.target.classList.contains("ap-overlay") && setConfirmDeleteAll(false)}>
          <div className="ap-confirm">
            <div className="ap-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h3>Delete all requests?</h3>
            <p>All approval request records will be permanently removed. This cannot be undone.</p>
            <div className="ap-confirm-actions">
              <button className="ap-confirm-cancel" onClick={() => setConfirmDeleteAll(false)}>Cancel</button>
              <button className="ap-confirm-delete" onClick={handleDeleteAll}>Delete All</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`ap-toast ap-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default Approvals;
