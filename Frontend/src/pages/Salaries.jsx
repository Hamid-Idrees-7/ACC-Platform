import { useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { salaryService } from "../services/salaryService";
import { money, moneyGrouped, amountInWords, currencySymbol } from "../utils/format";
import "./Salaries.css";
import { useLiveRefresh } from "../hooks/useLive";
import ModalOverlay from "../components/ModalOverlay";
import { SkeletonPage } from "../components/Skeleton";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";
import { useLoader } from "../hooks/useLoader";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const rateLabel = (l) =>
  l.sourceType === "Monthly" ? `${money(l.rate)} /month` : l.sourceType === "Contract" ? `${money(l.rate)} contract` : `${money(l.rate)} /day`;

// Paid = nothing left to pay, Part paid = some paid and more is due.
const lineState = (l) => (l.isPaid ? "paid" : l.paidAmount > 0 ? "partial" : "pending");
const STATE_LABEL = { paid: "PAID", partial: "PART PAID", pending: "PENDING" };

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
  const [params] = useSearchParams();
  const askedYear = Number(params.get("year"));
  const askedMonth = Number(params.get("month"));
  const asked = askedYear >= 2000 && askedYear <= 2100 && askedMonth >= 1 && askedMonth <= 12;
  const [year, setYear] = useState(asked ? askedYear : now.getFullYear());
  const [month, setMonth] = useState(asked ? askedMonth : now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState("all"); // all / paid / pending
  const [search, setSearch] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null); 
  const [finalAmount, setFinalAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirmUndo, setConfirmUndo] = useState(null); 
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (text, type = "success") => { setToast({ text, type }); setTimeout(() => setToast(null), 2600); };

  const period = useRef("");

  const load = async () => {
    setLoading(true);
    const asked = `${year}-${month}`;
    try {
      const result = await salaryService.getPeriod(year, month, 0);
      if (period.current === asked) setData(result);
    }
    catch {
      // Never leave another month's payroll on screen under this month's name
      if (period.current === asked) setData(null);
    }
    finally { if (period.current === asked) setLoading(false); }
  };
  useLoader(() => { period.current = `${year}-${month}`; load(); }, `${year}-${month}`);

  useLiveRefresh(["salaries", "attendance", "assignments", "employees", "projects"], async () => {
    const asked = `${year}-${month}`;
    try {
      const result = await salaryService.getPeriod(year, month, 0);
      if (period.current === asked) setData(result);
    } catch {
      return;
    }
  });

  const shiftMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; } if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  };
  const goThisMonth = () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); };
  const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  // One flat list of pay lines, each tagged with its employee.
  const lines = useMemo(() => {
    return (data?.employees || []).flatMap((e) =>
      e.lines.map((l) => ({ ...l, employeeID: e.employeeID, employeeName: e.employeeName, designation: e.designation }))
    );
  }, [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines.filter((l) => {
      if (statusFilter === "paid" && !l.isPaid) return false;
      if (statusFilter === "pending" && !(l.dueAmount > 0)) return false;
      // Search matches employee name, designation, or project.
      if (q) {
        const hay = `${l.employeeName} ${l.designation} ${l.projectName || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [lines, statusFilter, search]);

  // Section order first, so each page keeps the Monthly / Daily / Contract grouping.
  const ordered = useMemo(
    () => SECTIONS.flatMap((sec) => visible.filter((l) => l.sourceType === sec.type)),
    [visible]
  );
  const paging = usePagination(ordered, { resetKey: `${year}-${month}|${statusFilter}|${search}` });

  // Pay and payslips always use the month whose figures are on screen.
  const shownYear = data?.year ?? year;
  const shownMonth = data?.month ?? month;
  const shownKey = `${shownYear}-${shownMonth}`;

  const openPay = (line) => { setPayModal(line); setFinalAmount(String(line.dueAmount ?? 0)); setNote(""); };

  // Anything from 1 rupee up to what is due; the rest stays due for later.
  const amountError = (() => {
    if (!payModal || finalAmount === "") return "";
    const n = Number(finalAmount);
    if (!(n > 0)) return "Enter an amount greater than zero.";
    if (n > Number(payModal.dueAmount)) return `Only ${money(payModal.dueAmount)} is due. Enter that or less.`;
    return "";
  })();

  const confirmPay = async () => {
    if (finalAmount === "" || amountError) return;
    setBusy(true);
    try {
      const updated = await salaryService.pay({
        employeeID: payModal.employeeID, year: shownYear, month: shownMonth,
        sourceType: payModal.sourceType, assignmentID: payModal.assignmentID ?? null,
        paidAmount: Number(finalAmount) || 0, note: note.trim() || null,
      });
      if (period.current === shownKey) setData(updated);
      setPayModal(null); showToast("Payment recorded.");
    } catch (err) { showToast(err.response?.data?.message || "Could not record payment.", "error"); }
    finally { setBusy(false); }
  };

  const doUndo = async () => {
    setBusy(true);
    try {
      const updated = await salaryService.revert(confirmUndo.paymentID);
      if (period.current === shownKey) setData(updated);
      setConfirmUndo(null); showToast("Payment undone.", "warn");
    } catch (err) { showToast(err.response?.data?.message || "Could not undo this payment.", "error"); }
    finally { setBusy(false); }
  };

  const openPayslip = (line) => navigate(`/dashboard/salaries/payslip/${line.employeeID}?year=${shownYear}&month=${shownMonth}`);

  const renderCard = (line, i) => (
    <div key={`${line.employeeID}-${line.sourceType}-${line.assignmentID ?? "m"}-${i}`} className={`sal-card ${lineState(line)}`}>
      <div className="sal-card-head">
        <div className="sal-avatar">{(line.employeeName || "?").charAt(0).toUpperCase()}</div>
        <div className="sal-who">
          <div className="sal-name">{line.employeeName}</div>
          <div className="sal-desig">{line.designation}</div>
        </div>
        <span className={`sal-badge ${lineState(line)}`}>{STATE_LABEL[lineState(line)]}</span>
      </div>

      <div className="sal-card-body">
        <div className="sal-c-top">
          <span className="sal-c-project">{line.sourceType === "Monthly" ? "Company Payroll" : line.projectName}</span>
          <span className="sal-c-amt">{money(line.paidAmount + line.dueAmount)}</span>
        </div>
        <div className="sal-c-meta">
          <span className={`sal-type ${line.sourceType.toLowerCase()}`}>{line.sourceType}</span>
          <span className="sal-rate">{rateLabel(line)}</span>
          {line.sourceType === "Daily" && <span className="sal-att">{line.presentDays} P / {line.absentDays} A</span>}
          {line.sourceType === "Monthly" && line.coveredDays < line.monthDays && (
            <span className="sal-att" title="Salary is earned day by day: these are the days earned so far this month">
              {line.coveredDays} of {line.monthDays} days{isThisMonth ? " so far" : ""}
            </span>
          )}
        </div>
        {line.paidAmount > 0 && line.dueAmount > 0 && (
          <div className="sal-override">Paid {money(line.paidAmount)} · Due {money(line.dueAmount)}</div>
        )}
        {line.paidAmount > line.calculatedAmount && (
          <div className="sal-override">Paid {money(line.paidAmount)}, earned {money(line.calculatedAmount)}</div>
        )}
        {line.note && <div className="sal-line-note">“{line.note}”</div>}
      </div>

      <div className="sal-c-actions">
        {canManage && line.paymentsCount > 0 && (
          <button className="sal-undo" onClick={() => setConfirmUndo(line)} title="Undo the latest payment">Undo</button>
        )}
        {canPay && line.dueAmount > 0 && <button className="sal-pay" onClick={() => openPay(line)}>Pay</button>}
        {canPay && !(line.dueAmount > 0) && line.paymentsCount === 0 && (
          <span className="sal-pay-later" title="Mark attendance and the earned pay shows here">Nothing earned yet</span>
        )}
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
        <SkeletonPage stats={4} rows={6} />
      ) : !data ? (
        <div className="sal-empty">
          <h3>Could not load payroll</h3>
          <p>{MONTHS[month - 1]} {year} could not be loaded. Check your connection and try again.</p>
          <div className="sal-load-actions">
            <button className="sal-thismonth" onClick={() => shiftMonth(-1)}>‹ Previous month</button>
            <button className="sal-pay" onClick={load}>Retry</button>
            <button className="sal-thismonth" onClick={() => shiftMonth(1)}>Next month ›</button>
          </div>
        </div>
      ) : (
        <>
          {/* Stat cards (clickable status filter) */}
          <div className="sal-stats">
            <button className={`sal-stat ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>
              <span className="sal-stat-ic blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></span>
              <div>
                <div className="sal-stat-val">{money(data.totalPayroll)}</div>
                <div className="sal-stat-lbl">Total Payroll</div>
                <div className="sal-stat-exact">{moneyGrouped(data.totalPayroll)} <span className="sal-stat-words">({amountInWords(data.totalPayroll)})</span></div>
              </div>
            </button>
            <button className={`sal-stat ${statusFilter === "paid" ? "active" : ""}`} onClick={() => setStatusFilter("paid")}>
              <span className="sal-stat-ic green"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
              <div>
                <div className="sal-stat-val">{money(data.paid)}</div>
                <div className="sal-stat-lbl">Paid</div>
                <div className="sal-stat-exact">{moneyGrouped(data.paid)} <span className="sal-stat-words">({amountInWords(data.paid)})</span></div>
              </div>
            </button>
            <button className={`sal-stat ${statusFilter === "pending" ? "active" : ""}`} onClick={() => setStatusFilter("pending")}>
              <span className="sal-stat-ic purple"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span>
              <div>
                <div className="sal-stat-val">{money(data.pending)}</div>
                <div className="sal-stat-lbl">Pending</div>
                <div className="sal-stat-exact">{moneyGrouped(data.pending)} <span className="sal-stat-words">({amountInWords(data.pending)})</span></div>
              </div>
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
            <>
              <div>
                {SECTIONS.map((sec) => {
                  const items = paging.pageItems.filter((l) => l.sourceType === sec.type);
                  if (items.length === 0) return null;
                  const total = visible.filter((l) => l.sourceType === sec.type).length;
                  return (
                    <div key={sec.type} className="sal-section">
                      <div className="sal-section-title">{sec.title} <span>{total}</span></div>
                      <div className="sal-grid">{items.map(renderCard)}</div>
                    </div>
                  );
                })}
              </div>
              <Pagination {...paging} label="salaries" />
            </>
          )}
        </>
      )}

      {/* Pay modal */}
      {payModal && (
        <ModalOverlay className="sal-overlay" onClose={() => setPayModal(null)}>
          <div className="sal-modal">
            <h3>Pay Salary</h3>
            <p className="sal-modal-sub">{payModal.employeeName} · {payModal.sourceType === "Monthly" ? "Company Payroll" : payModal.projectName}</p>
            <div className="sal-calc">
              <div>
                <div className="sal-calc-lbl">Due Now</div>
                <div className="sal-calc-sub">
                  {payModal.sourceType === "Daily"
                    ? `${payModal.presentDays} present days × ${money(payModal.rate)}/day`
                    : payModal.sourceType === "Contract" ? "Contract amount"
                    : `Monthly salary, ${payModal.coveredDays} of ${payModal.monthDays} days`}
                  {payModal.paidAmount > 0 && ` = ${money(payModal.calculatedAmount)}, already paid ${money(payModal.paidAmount)}`}
                </div>
              </div>
              <div className="sal-calc-amt">{money(payModal.dueAmount)}</div>
            </div>
            <label className="sal-modal-label">Amount to Pay ({currencySymbol()}) <span>*</span></label>
            <input
              type="number" min="0" step="any" value={finalAmount} autoFocus
              className={amountError ? "err" : ""}
              onChange={(e) => setFinalAmount(e.target.value)}
            />
            {amountError
              ? <div className="sal-amount-err">{amountError}</div>
              : finalAmount !== "" && Number(finalAmount) > 0 && <div className="sal-words">= {amountInWords(finalAmount)}</div>}
            {!amountError && Number(finalAmount) > 0 && Number(finalAmount) < Number(payModal.dueAmount) && (
              <div className="sal-amount-hint">The other {money(payModal.dueAmount - Number(finalAmount))} stays due.</div>
            )}
            <label className="sal-modal-label">Payment Note</label>
            <input type="text" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note." />
            <div className="sal-modal-actions">
              <button className="sal-modal-cancel" data-close onClick={() => setPayModal(null)} disabled={busy}>Cancel</button>
              <button className="sal-modal-ok" onClick={confirmPay} disabled={busy || finalAmount === "" || !!amountError}>{busy ? "Saving..." : "Confirm Payment"}</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Undo confirm */}
      {confirmUndo && (
        <ModalOverlay className="sal-overlay" onClose={() => setConfirmUndo(null)}>
          <div className="sal-confirm">
            <div className="sal-confirm-ic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg></div>
            <h3>Undo this payment?</h3>
            <p>
              This removes the latest payment of <strong>{money(confirmUndo.lastPaidAmount)}</strong> to {confirmUndo.employeeName}.
              That amount becomes due again, and you can pay it later.
            </p>
            <div className="sal-modal-actions">
              <button className="sal-modal-cancel" data-close onClick={() => setConfirmUndo(null)} disabled={busy}>Cancel</button>
              <button className="sal-confirm-undo" onClick={doUndo} disabled={busy}>{busy ? "..." : "Yes, Undo"}</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {toast && <div className={`sal-toast sal-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default Salaries;
