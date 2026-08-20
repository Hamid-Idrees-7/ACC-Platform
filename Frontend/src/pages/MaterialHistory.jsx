import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
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

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all"); // all | restock | issue

  useEffect(() => {
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
    load();
  }, [id]);

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
            <div className="mhist-stat-label">Total Issued</div>
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
            return (
              <div key={t.transactionID} className={`mhist-row ${isIssue ? "issue" : "restock"}`}>
                <div className={`mhist-row-icon ${isIssue ? "issue" : "restock"}`}>{isIssue ? "−" : "+"}</div>
                <div className="mhist-row-main">
                  <div className="mhist-row-title">{t.type} {formatQty(t.quantity)} {data.unit}</div>
                  <div className="mhist-row-meta">
                    {isIssue && t.projectName && <>Project: <strong>{t.projectName}</strong> · </>}
                    Rate: {rupees(t.rate)} / {data.unit}
                  </div>
                  {t.note && <div className="mhist-row-note">{t.note}</div>}
                  <div className="mhist-row-date">{fmtDateTime(t.createdAt)}</div>
                </div>
                <div className="mhist-row-amount">{rupees(t.amount)}</div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}

export default MaterialHistory;
