import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { materialRequestService } from "../services/materialRequestService";
import { formatQty } from "../utils/format";
import "./MaterialRequests.css";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return isNaN(x) ? "" : `${x.getDate()} ${MON[x.getMonth()]} ${x.getFullYear()}`;
};

const FILTERS = ["Pending", "Approved", "Rejected", "All"];

function MaterialRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("Pending");
  const [busy, setBusy] = useState(null);        // requestID being resolved
  const [rejectModal, setRejectModal] = useState(null); // request
  const [rejectNote, setRejectNote] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (text, type = "success") => { setToast({ text, type }); setTimeout(() => setToast(null), 3200); };

  const load = async () => {
    setLoading(true);
    try {
      setRequests(await materialRequestService.getAll());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    Pending: requests.filter((r) => r.status === "Pending").length,
    Approved: requests.filter((r) => r.status === "Approved").length,
    Rejected: requests.filter((r) => r.status === "Rejected").length,
    All: requests.length,
  }), [requests]);

  const visible = useMemo(() => {
    if (filter === "All") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const approve = async (r) => {
    setBusy(r.requestID);
    try {
      await materialRequestService.approve(r.requestID);
      showToast(`Approved — ${formatQty(r.quantity)} ${r.unit} of ${r.materialName} issued.`);
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not approve.", "error");
    } finally {
      setBusy(null);
    }
  };

  const doReject = async () => {
    setBusy(rejectModal.requestID);
    try {
      await materialRequestService.reject(rejectModal.requestID, rejectNote.trim());
      showToast("Request rejected.", "warn");
      setRejectModal(null);
      setRejectNote("");
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not reject.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardLayout title="Material Requests">
      {loading ? (
        <div className="mrq-empty"><div className="mrq-spinner" /><p>Loading requests...</p></div>
      ) : error ? (
        <div className="mrq-empty"><h3>Could not load</h3><p>You may not have access, or the backend is down.</p></div>
      ) : (
        <>
          <div className="mrq-filters">
            {FILTERS.map((f) => (
              <button key={f} className={`mrq-filter ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f} <span>{counts[f]}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="mrq-empty">
              <h3>Nothing here</h3>
              <p>{filter === "Pending" ? "No pending material requests from the field." : `No ${filter.toLowerCase()} requests.`}</p>
            </div>
          ) : (
            <div className="mrq-list">
              {visible.map((r) => {
                const short = r.status === "Pending" && r.quantity > r.availableStock;
                return (
                  <div key={r.requestID} className={`mrq-card ${r.status.toLowerCase()}`}>
                    <div className="mrq-main">
                      <div className="mrq-head">
                        <span className="mrq-mat">{formatQty(r.quantity)} {r.unit} · {r.materialName}</span>
                        <span className={`mrq-status ${r.status.toLowerCase()}`}>{r.status}</span>
                      </div>
                      <div className="mrq-meta">
                        <span><strong>{r.projectTitle}</strong>{r.phaseName ? ` · ${r.phaseName}` : ""}</span>
                        <span>by {r.requestedByName}</span>
                        <span>{fmtDate(r.createdAt)}</span>
                      </div>
                      {r.note && <div className="mrq-note">"{r.note}"</div>}
                      {r.status === "Pending" && (
                        <div className={`mrq-stock ${short ? "short" : "ok"}`}>
                          In stock: {formatQty(r.availableStock)} {r.unit}{short ? " — not enough to fulfil" : ""}
                        </div>
                      )}
                      {r.status === "Rejected" && r.resolveNote && <div className="mrq-reject">Reason: {r.resolveNote}</div>}
                    </div>

                    {r.status === "Pending" && (
                      <div className="mrq-actions">
                        <button className="mrq-approve" onClick={() => approve(r)} disabled={busy === r.requestID}>
                          {busy === r.requestID ? "..." : "Approve & Issue"}
                        </button>
                        <button className="mrq-reject-btn" onClick={() => { setRejectModal(r); setRejectNote(""); }} disabled={busy === r.requestID}>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {rejectModal && (
        <div className="mrq-overlay" onClick={(e) => e.target.classList.contains("mrq-overlay") && setRejectModal(null)}>
          <div className="mrq-modal">
            <h3>Reject request?</h3>
            <p className="mrq-modal-sub">{formatQty(rejectModal.quantity)} {rejectModal.unit} of {rejectModal.materialName} for {rejectModal.projectTitle}.</p>
            <label className="mrq-label">Reason (optional)</label>
            <input type="text" maxLength={255} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="e.g. order from central store instead" autoFocus />
            <div className="mrq-modal-actions">
              <button className="mrq-modal-cancel" onClick={() => setRejectModal(null)} disabled={busy}>Cancel</button>
              <button className="mrq-modal-danger" onClick={doReject} disabled={busy}>{busy ? "..." : "Reject"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`mrq-toast mrq-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default MaterialRequests;
