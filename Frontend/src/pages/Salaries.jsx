import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { salaryService } from "../services/salaryService";
import { rupees } from "../utils/format";
import "./Salaries.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const rateLabel = (l) =>
  l.sourceType === "Monthly" ? `${rupees(l.rate)} /month` : l.sourceType === "Contract" ? `${rupees(l.rate)} contract` : `${rupees(l.rate)} /day`;

const SECTIONS = [
  { type: "Monthly", title: "MONTHLY STAFF" },
  { type: "Contract", title: "CONTRACT" },
  { type: "Daily", title: "DAILY WORKERS" },
];

function Salaries() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  // A single Manage permission covers both paying and reverting.
  const canManage = can("Salaries", "Manage");
  const canPay = canManage;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState("all"); // all / paid / pending
  const [search, setSearch] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null); // line
  const [finalAmount, setFinalAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirmUndo, setConfirmUndo] = useState(null); // line
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (text, type = "success") => { setToast({ text, type }); setTimeout(() => setToast(null), 2600); };

  const load = async () => {
    setLoading(true);
    try { setData(await salaryService.getPeriod(year, month, 0)); }
    catch { showToast("Could not load payroll.", "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [year, month]);

  const shiftMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; } if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  };
  const goThisMonth = () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); };
  const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  // Flatten every employee's lines, tagging each with its employee.
  const lines = useMemo(() => {
    return (data?.employees || []).flatMap((e) =>
      e.lines.map((l) => ({ ...l, employeeID: e.employeeID, employeeName: e.employeeName, designation: e.designation }))
    );
  }, [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines.filter((l) => {
      if (statusFilter === "paid" && !l.isPaid) return false;
      if (statusFilter === "pending" && l.isPaid) return false;
      // Search matches employee name, designation, or project.
      if (q) {
        const hay = `${l.employeeName} ${l.designation} ${l.projectName || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [lines, statusFilter, search]);

  const openPay = (line) => { setPayModal(line); setFinalAmount(String(line.calculatedAmount ?? 0)); setNote(""); };

  const confirmPay = async () => {
    setBusy(true);
    try {
      const updated = await salaryService.pay({
        employeeID: payModal.employeeID, year, month,
        sourceType: payModal.sourceType, assignmentID: payModal.assignmentID ?? null,
        paidAmount: Number(finalAmount) || 0, note: note.trim() || null,
      });
      setData(updated); setPayModal(null); showToast("Payment recorded.");
    } catch { showToast("Could not record payment.", "error"); }
    finally { setBusy(false); }
  };

  const doUndo = async () => {
    setBusy(true);
    try {
      const updated = await salaryService.revert(confirmUndo.paymentID);
      setData(updated); setConfirmUndo(null); showToast("Payment reverted.", "warn");
    } catch { showToast("Could not revert.", "error"); }
    finally { setBusy(false); }
  };

  const openPayslip = (line) => navigate(`/dashboard/salaries/payslip/${line.employeeID}?year=${year}&month=${month}`);

  const renderCard = (line, i) => (
    <div key={`${line.employeeID}-${line.sourceType}-${line.assignmentID ?? "m"}-${i}`} className={`sal-card ${line.isPaid ? "paid" : "pending"}`}>
      <div className="sal-card-head">
        <div className="sal-avatar">{(line.employeeName || "?").charAt(0).toUpperCase()}</div>
        <div className="sal-who">
          <div className="sal-name">{line.employeeName}</div>
          <div className="sal-desig">{line.designation}</div>
        </div>
        <span className={`sal-badge ${line.isPaid ? "paid" : "pending"}`}>{line.isPaid ? "PAID" : "PENDING"}</span>
      </div>

      <div className="sal-card-body">
        <div className="sal-c-top">
          <span className="sal-c-project">{line.sourceType === "Monthly" ? "Company Payroll" : line.projectName}</span>
          <span className="sal-c-amt">{rupees(line.isPaid ? line.paidAmount : line.calculatedAmount)}</span>
        </div>
        <div className="sal-c-meta">
          <span className={`sal-type ${line.sourceType.toLowerCase()}`}>{line.sourceType}</span>
          <span className="sal-rate">{rateLabel(line)}</span>
          {line.sourceType === "Daily" && <span className="sal-att">{line.presentDays} P / {line.absentDays} A</span>}
        </div>
        {line.isPaid && Number(line.paidAmount) !== Number(line.calculatedAmount) && (
          <div className="sal-override">Calculated: {rupees(line.calculatedAmount)} → Paid: {rupees(line.paidAmount)}</div>
        )}
        {line.note && <div className="sal-line-note">“{line.note}”</div>}
      </div>

      <div className="sal-c-actions">
        {line.isPaid
          ? (canManage && <button className="sal-undo" onClick={() => setConfirmUndo(line)}>Undo</button>)
          : (canPay && <button className="sal-pay" onClick={() => openPay(line)}>Pay</button>)}
        <button className="sal-payslip" onClick={() => openPayslip(line)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          Payslip
        </button>
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Salaries & Payroll">
      {loading ? (
        <div className="sal-empty"><div className="sal-spinner" /><p>Loading payroll...</p></div>
      ) : (
        <>
          {/* Stat cards (clickable status filter) */}
          <div className="sal-stats">
            <button className={`sal-stat ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>
              <span className="sal-stat-ic blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></span>
              <div><div className="sal-stat-val">{rupees(data.totalPayroll)}</div><div className="sal-stat-lbl">Total Payroll</div></div>
            </button>
            <button className={`sal-stat ${statusFilter === "paid" ? "active" : ""}`} onClick={() => setStatusFilter("paid")}>
              <span className="sal-stat-ic green"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              <div><div className="sal-stat-val">{rupees(data.paid)}</div><div className="sal-stat-lbl">Paid</div></div>
            </button>
            <button className={`sal-stat ${statusFilter === "pending" ? "active" : ""}`} onClick={() => setStatusFilter("pending")}>
              <span className="sal-stat-ic purple"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span>
              <div><div className="sal-stat-val">{rupees(data.pending)}</div><div className="sal-stat-lbl">Pending</div></div>
            </button>
          </div>

          {/* Toolbar: search + month + project filter */}
          <div className="sal-toolbar">
            <div className="sal-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Search name, role or project..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="sal-month-nav">
              <button className="sal-mn-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
              <div className="sal-month">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                {MONTHS[month - 1]} {year}
              </div>
              <button className="sal-mn-btn" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
              <button className={`sal-thismonth ${isThisMonth ? "active" : ""}`} onClick={goThisMonth}>This Month</button>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="sal-empty"><h3>Nothing to show</h3><p>No salaries match this month/filter. Assign workers and mark attendance to see payroll here.</p></div>
          ) : (
            SECTIONS.map((sec) => {
              const items = visible.filter((l) => l.sourceType === sec.type);
              if (items.length === 0) return null;
              return (
                <div key={sec.type} className="sal-section">
                  <div className="sal-section-title">{sec.title} <span>{items.length}</span></div>
                  <div className="sal-grid">{items.map(renderCard)}</div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* Pay modal */}
      {payModal && (
        <div className="sal-overlay" onClick={(e) => e.target.classList.contains("sal-overlay") && setPayModal(null)}>
          <div className="sal-modal">
            <h3>Pay Salary</h3>
            <p className="sal-modal-sub">{payModal.employeeName} · {payModal.sourceType === "Monthly" ? "Company Payroll" : payModal.projectName}</p>
            <div className="sal-calc">
              <div>
                <div className="sal-calc-lbl">System Calculated</div>
                <div className="sal-calc-sub">
                  {payModal.sourceType === "Daily"
                    ? `${payModal.presentDays} present days × ${rupees(payModal.rate)}/day`
                    : payModal.sourceType === "Contract" ? "Contract amount" : "Monthly salary"}
                </div>
              </div>
              <div className="sal-calc-amt">{rupees(payModal.calculatedAmount)}</div>
            </div>
            <label className="sal-modal-label">Final Amount to Pay (Rs.) <span>*</span></label>
            <input type="number" min="0" step="any" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} autoFocus />
            <label className="sal-modal-label">Payment Note</label>
            <input type="text" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note." />
            <div className="sal-modal-actions">
              <button className="sal-modal-cancel" onClick={() => setPayModal(null)} disabled={busy}>Cancel</button>
              <button className="sal-modal-ok" onClick={confirmPay} disabled={busy}>{busy ? "Saving..." : "Confirm Payment"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Undo confirm */}
      {confirmUndo && (
        <div className="sal-overlay" onClick={(e) => e.target.classList.contains("sal-overlay") && setConfirmUndo(null)}>
          <div className="sal-confirm">
            <div className="sal-confirm-ic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg></div>
            <h3>Revert this payment?</h3>
            <p>This will move the salary back to <strong>Pending</strong> and remove the paid record. You can pay it again afterwards.</p>
            <div className="sal-modal-actions">
              <button className="sal-modal-cancel" onClick={() => setConfirmUndo(null)} disabled={busy}>Cancel</button>
              <button className="sal-confirm-undo" onClick={doUndo} disabled={busy}>{busy ? "..." : "Yes, Revert"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`sal-toast sal-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default Salaries;
