import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { materialService } from "../services/materialService";
import { formatQty, rupees } from "../utils/format";
import "./MaterialHistory.css";

const fmtDateTime = (iso) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
};

function MaterialHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can("Materials", "Manage");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all"); // all | restock | issue
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await materialService.getHistory(id);
      setData(res);
    } catch {
      setError("Could not load this material's history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleCancel = async (txId) => {
    try {
      await materialService.cancelTransaction(txId);
      setConfirmCancel(null);
      showToast("Transaction cancelled — stock reversed.", "warn");
      load();
    } catch (err) {
      setConfirmCancel(null);
      showToast(err.response?.data?.message || "Could not cancel this transaction.", "error");
    }
  };

  const shown = useMemo(() => {
    if (!data) return [];
    if (tab === "restock") return data.transactions.filter((t) => t.type === "Restock");
    if (tab === "issue") return data.transactions.filter((t) => t.type === "Issue");
    return data.transactions;
  }, [data, tab]);

  if (loading) {
    return (
      <DashboardLayout title="Transaction History">
        <div className="mhist-empty"><div className="mhist-spinner" /><p>Loading history...</p></div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout title="Transaction History">
        <button className="mhist-back" onClick={() => navigate("/dashboard/materials")}>← Back to Materials</button>
        <div className="mhist-error">{error || "Material not found."}</div>
      </DashboardLayout>
    );
  }

  const purchaseCount = data.transactions.filter((t) => t.type === "Restock").length;
  const issueCount = data.transactions.filter((t) => t.type === "Issue").length;

  return (
    <DashboardLayout title="Transaction History">
      <button className="mhist-back" onClick={() => navigate("/dashboard/materials")}>← Back to Materials</button>

      {/* Header banner */}
      <div className="mhist-banner">
        <h2>{data.name}</h2>
        <div className="mhist-banner-meta">
          Unit: <strong>{data.unit}</strong> · <span className="accent">Avg Cost: {rupees(data.avgCost)} / {data.unit}</span> · Current Stock: <strong>{formatQty(data.currentStock)} {data.unit}</strong>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mhist-stats">
        <div className="mhist-stat">
          <div className="mhist-stat-icon plus">+</div>
          <div>
            <div className="mhist-stat-value">{formatQty(data.totalPurchasedQty)} {data.unit}</div>
            <div className="mhist-stat-label">Total Purchased</div>
            <div className="mhist-stat-sub">{rupees(data.totalInvested)} invested</div>
          </div>
        </div>

        <div className="mhist-stat">
          <div className="mhist-stat-icon cost">$</div>
          <div>
            <div className="mhist-stat-value">{rupees(data.avgCost)}</div>
            <div className="mhist-stat-label">Weighted Avg Cost / {data.unit}</div>
            <div className="mhist-stat-sub">Min: {rupees(data.minRate)} · Max: {rupees(data.maxRate)}</div>
          </div>
        </div>

        <div className="mhist-stat">
          <div className="mhist-stat-icon minus">−</div>
          <div>
            <div className="mhist-stat-value">{formatQty(data.totalIssuedQty)} {data.unit}</div>
            <div className="mhist-stat-label">Total Issued (active)</div>
            <div className="mhist-stat-sub">{rupees(data.totalIssuedCost)} issued cost</div>
          </div>
        </div>

        <div className="mhist-stat">
          <div className="mhist-stat-icon count">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          </div>
          <div>
            <div className="mhist-stat-value">{data.totalTransactions}</div>
            <div className="mhist-stat-label">Total Transactions</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mhist-tabs">
        <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>All Transactions <span>{data.totalTransactions}</span></button>
        <button className={tab === "restock" ? "active" : ""} onClick={() => setTab("restock")}>Purchase Ledger <span>{purchaseCount}</span></button>
        <button className={tab === "issue" ? "active" : ""} onClick={() => setTab("issue")}>Issue Ledger <span>{issueCount}</span></button>
      </div>

      {/* Transaction list */}
      {shown.length === 0 ? (
        <div className="mhist-empty"><p>No transactions in this ledger yet.</p></div>
      ) : (
        <div className="mhist-list">
          {shown.map((t) => {
            const isIssue = t.type === "Issue";
            const cancelled = t.isCancelled;
            return (
              <div key={t.transactionID} className={`mhist-row ${isIssue ? "issue" : "restock"} ${cancelled ? "cancelled" : ""}`}>
                <div className={`mhist-row-icon ${cancelled ? "cancelled" : isIssue ? "issue" : "restock"}`}>
                  {cancelled ? "✕" : isIssue ? "−" : "+"}
                </div>
                <div className="mhist-row-main">
                  <div className="mhist-row-title">
                    {t.type} {formatQty(t.quantity)} {data.unit}
                    {cancelled && <span className="mhist-cancel-badge">CANCELLED</span>}
                  </div>
                  <div className="mhist-row-meta">
                    {isIssue && t.projectName && <>Project: <strong>{t.projectName}</strong> · </>}
                    Rate: {rupees(t.rate)} / {data.unit}
                  </div>
                  {t.note && <div className="mhist-row-note">{t.note}</div>}
                  <div className="mhist-row-date">{fmtDateTime(t.createdAt)}</div>
                </div>
                <div className={`mhist-row-amount ${cancelled ? "struck" : ""}`}>{rupees(t.amount)}</div>
                {canManage && (
                  <div className="mhist-row-action">
                    {cancelled ? null : t.locked ? (
                      <span className="mhist-lock" title="Locked — project completed">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      </span>
                    ) : (
                      <button className="mhist-cancel-btn" onClick={() => setConfirmCancel(t)} title="Cancel / reverse">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel confirm */}
      {confirmCancel && (
        <div className="mhist-overlay" onClick={(e) => e.target.classList.contains("mhist-overlay") && setConfirmCancel(null)}>
          <div className="mhist-confirm">
            <div className="mhist-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
            <h3>Cancel this {confirmCancel.type}?</h3>
            <p>{formatQty(confirmCancel.quantity)} {data.unit} of {data.name} will be {confirmCancel.type === "Issue" ? "returned to" : "removed from"} stock.</p>
            <div className="mhist-confirm-warn">Stock will be reversed. This cannot be undone.</div>
            <div className="mhist-confirm-actions">
              <button className="mhist-confirm-keep" onClick={() => setConfirmCancel(null)}>Keep it</button>
              <button className="mhist-confirm-do" onClick={() => handleCancel(confirmCancel.transactionID)}>Yes, Cancel {confirmCancel.type}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`mhist-toast mhist-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default MaterialHistory;
