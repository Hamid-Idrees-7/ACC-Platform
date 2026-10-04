import { useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { inquiryService } from "../services/inquiryService";
import { formatDateTime } from "../utils/dates";
import "./Queries.css";
import { useLiveRefresh } from "../hooks/useLive";
import ModalOverlay from "../components/ModalOverlay";
import { SkeletonRows } from "../components/Skeleton";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";
import { formatPhone } from "../utils/format";
import { useLoader } from "../hooks/useLoader";
import { useToast } from "../components/Toast";

function Queries() {
  const { can } = usePermissions();
  const canDelete = can("Messages", "Delete");

  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // id to delete, or "all"
  const [toast, showToast] = useToast(3000);

  const loadInquiries = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await inquiryService.getAll();
      setInquiries(data);
    } catch {
      setError("Could not load messages. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useLoader(() => loadInquiries());

  useLiveRefresh(["messages"], async () => {
    try {
      setInquiries(await inquiryService.getAll());
    } catch {
      return;
    }
  });

  const openMessage = async (inquiry) => {
    setSelected(inquiry);
    if (!inquiry.isRead) {
      try {
        await inquiryService.markAsRead(inquiry.inquiryID);
        setInquiries((prev) =>
          prev.map((i) => (i.inquiryID === inquiry.inquiryID ? { ...i, isRead: true } : i))
        );
      } catch {
        // not critical, ignore
      }
    }
  };

  const handleDelete = async (id) => {
    try {
      await inquiryService.delete(id);
      setInquiries((prev) => prev.filter((i) => i.inquiryID !== id));
      if (selected?.inquiryID === id) setSelected(null);
      showToast("Message deleted.");
    } catch {
      setError("Could not delete the message.");
    }
    setConfirmDelete(null);
  };

  const handleDeleteAll = async () => {
    try {
      await inquiryService.deleteAll();
      setInquiries([]);
      setSelected(null);
      showToast("All messages deleted.");
    } catch {
      setError("Could not clear messages.");
    }
    setConfirmDelete(null);
  };

  const unreadCount = inquiries.filter((i) => !i.isRead).length;

  const paging = usePagination(inquiries);

  return (
    <DashboardLayout title="Queries">
      <div className="q-header">
        <div className="q-header-info">
          <h2>Customer Messages</h2>
          <p>{inquiries.length} total{unreadCount > 0 ? ` \u00b7 ${unreadCount} unread` : ""}</p>
        </div>
        {inquiries.length > 0 && canDelete && (
          <button className="q-clear-all" onClick={() => setConfirmDelete("all")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            Clear All
          </button>
        )}
      </div>

      {error && <div className="q-error">{error}</div>}

      {loading ? (
        <SkeletonRows count={5} />
      ) : inquiries.length === 0 ? (
        <div className="q-empty">
          <div className="q-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </div>
          <h3>No messages yet</h3>
          <p>Messages from your website contact form will appear here.</p>
        </div>
      ) : (
        <>
          <div className="q-list">
            {paging.pageItems.map((inq) => (
              <div
                key={inq.inquiryID}
                className={`q-card ${!inq.isRead ? "unread" : ""}`}
                onClick={() => openMessage(inq)}
              >
                <div className="q-card-avatar">{inq.name.charAt(0).toUpperCase()}</div>
                <div className="q-card-body">
                  <div className="q-card-top">
                    <span className="q-card-name">
                      {inq.name}
                      {!inq.isRead && <span className="q-unread-dot" />}
                    </span>
                    <span className="q-card-time">{formatDateTime(inq.createdAt)}</span>
                  </div>
                  <div className="q-card-meta">
                    <span className="q-card-phone">{formatPhone(inq.phone)}</span>
                    {inq.service && <span className="q-card-service">{inq.service}</span>}
                  </div>
                  <p className="q-card-preview">{inq.message}</p>
                </div>
                {canDelete && (
                  <button
                    className="q-card-delete"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(inq.inquiryID); }}
                    aria-label="Delete"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <Pagination {...paging} label="messages" />
        </>
      )}

      {/* Message detail modal */}
      {selected && (
        <ModalOverlay className="q-modal-overlay" onClose={() => setSelected(null)}>
          <div className="q-modal">
            <button className="q-modal-close" data-close onClick={() => setSelected(null)} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>

            <div className="q-modal-head">
              <div className="q-modal-avatar">{selected.name.charAt(0).toUpperCase()}</div>
              <div>
                <h3>{selected.name}</h3>
                <span className="q-modal-time">{formatDateTime(selected.createdAt)}</span>
              </div>
            </div>

            <div className="q-modal-details">
              <div className="q-detail-row">
                <span className="q-detail-label">Phone</span>
                <span className="q-detail-value">{formatPhone(selected.phone)}</span>
              </div>
              {selected.email && (
                <div className="q-detail-row">
                  <span className="q-detail-label">Email</span>
                  <span className="q-detail-value">{selected.email}</span>
                </div>
              )}
              {selected.service && (
                <div className="q-detail-row">
                  <span className="q-detail-label">Service</span>
                  <span className="q-detail-value">{selected.service}</span>
                </div>
              )}
            </div>

            <div className="q-modal-message">
              <span className="q-detail-label">Message</span>
              <p>{selected.message}</p>
            </div>

            {canDelete && (
              <div className="q-modal-actions">
                <button className="q-modal-delete" onClick={() => setConfirmDelete(selected.inquiryID)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  Delete Message
                </button>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* Delete toast (bottom-right, red) */}
      {toast && <div className="q-toast">{toast.text}</div>}

      {/* Confirm delete modal */}
      {confirmDelete !== null && (
        <ModalOverlay className="q-modal-overlay" onClose={() => setConfirmDelete(null)}>
          <div className="q-confirm">
            <div className="q-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h3>{confirmDelete === "all" ? "Clear all messages?" : "Delete this message?"}</h3>
            <p>{confirmDelete === "all" ? "This will permanently delete all customer messages." : "This message will be permanently deleted."} This cannot be undone.</p>
            <div className="q-confirm-actions">
              <button className="q-confirm-cancel" data-close onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="q-confirm-delete"
                onClick={() => confirmDelete === "all" ? handleDeleteAll() : handleDelete(confirmDelete)}
              >
                {confirmDelete === "all" ? "Clear All" : "Delete"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </DashboardLayout>
  );
}

export default Queries;
