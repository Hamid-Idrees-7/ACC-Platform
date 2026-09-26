import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import DatePicker from "../components/DatePicker";
import { usePermissions } from "../context/PermissionContext";
import { billingService } from "../services/billingService";
import { rupees, amountInWords, formatQty } from "../utils/format";
import { formatDateShort } from "../utils/dates";
import "./ProjectBilling.css";

const fmtDate = (d) => formatDateShort(d, "—");

const todayISO = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

const METHODS = ["Cash", "Cheque", "Bank Transfer"];
const emptyItem = () => ({ description: "", quantity: "1", rate: "", phaseID: null, expenseID: null });

// An invoice line that bills a recoverable project expense back to the client
// Quantity and rate are fixed to the expense amount (the server enforces this too)
const expenseItem = (e) => ({
  description: `Reimbursement: ${e.description}`.slice(0, 200),
  quantity: "1",
  rate: String(e.amount),
  phaseID: e.phaseID ?? null,
  expenseID: e.expenseID,
});

const errorText = (err, fallback) => {
  if (err?.response?.status === 403) return "You don't have permission for this action.";
  return err?.response?.data?.message || fallback;
};

function ProjectBilling() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can("Billing", "Manage");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(null);       
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  // Invoice form modal (create or edit)
  const [invModal, setInvModal] = useState(null);       
  const [form, setForm] = useState(null);               
  const [phasePick, setPhasePick] = useState("");
  const [expensePick, setExpensePick] = useState("");
  const [formError, setFormError] = useState("");

  // Payment modal
  const [payModal, setPayModal] = useState(null);       
  const [payForm, setPayForm] = useState(null);         

  // Delete confirms
  const [delInvoice, setDelInvoice] = useState(null);   
  const [delPayment, setDelPayment] = useState(null);   

  const showToast = (text, type = "success") => { setToast({ text, type }); setTimeout(() => setToast(null), 2600); };

  // The first load shows the spinner. Reloads after a change ({ quiet: true }) keep the
  // page on screen, so it never jumps back to the top.
  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      setData(await billingService.getProject(projectId));
      setError(false);
    } catch {
      if (quiet) showToast("Could not refresh. Please reload the page.", "error");
      else setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [projectId]);

  // Invoice form 
  // prefill: optional list of recoverable expenses to start the invoice with.
  const openCreate = (prefill = []) => {
    setInvModal({ mode: "create", ownExpenses: [] });
    setForm({
      issueDate: todayISO(),
      dueDate: "",
      items: prefill.length > 0 ? prefill.map(expenseItem) : [emptyItem()],
      taxAmount: "",
      notes: "",
    });
    setPhasePick("");
    setExpensePick("");
    setFormError("");
  };

  const openEdit = (inv) => {
    // Expense lines already on this invoice. If one is removed while editing it can be added
    // back, since until the invoice is saved it is still billed here, not pending.
    const ownExpenses = (inv.items || [])
      .filter((i) => i.expenseID)
      .map((i) => ({ expenseID: i.expenseID, description: i.description.replace(/^Reimbursement:\s*/, ""), amount: i.amount, phaseID: i.phaseID ?? null }));
    setInvModal({ mode: "edit", invoiceId: inv.invoiceID, invoiceNumber: inv.invoiceNumber, ownExpenses });
    setForm({
      issueDate: inv.issueDate ? inv.issueDate.substring(0, 10) : todayISO(),
      dueDate: inv.dueDate ? inv.dueDate.substring(0, 10) : "",
      items: (inv.items || []).map((i) => ({
        description: i.description,
        quantity: String(i.quantity),
        rate: String(i.rate),
        phaseID: i.phaseID ?? null,
        expenseID: i.expenseID ?? null,
      })),
      taxAmount: inv.taxAmount ? String(inv.taxAmount) : "",
      notes: inv.notes || "",
    });
    setPhasePick("");
    setExpensePick("");
    setFormError("");
  };

  const closeInvModal = () => { setInvModal(null); setForm(null); setFormError(""); };

  const setItem = (idx, key, val) => {
    setForm((f) => {
      const items = f.items.map((it, i) => (i === idx ? { ...it, [key]: val } : it));
      return { ...f, items };
    });
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const addPhaseLine = (phaseId) => {
    const phase = (data.phases || []).find((p) => String(p.phaseID) === String(phaseId));
    if (!phase) return;
    setForm((f) => ({
      ...f,
      items: [...f.items.filter((it) => it.description || it.rate), { description: phase.name, quantity: "1", rate: "", phaseID: phase.phaseID }],
    }));
    setPhasePick("");
  };

  // Recoverable expenses that can still be added to this invoice.
  const expenseOptions = useMemo(() => {
    if (!form || !invModal || !data) return [];
    const used = new Set(form.items.filter((it) => it.expenseID).map((it) => it.expenseID));
    const pool = [...(invModal.ownExpenses || []), ...(data.pendingReimbursements || [])];
    const seen = new Set();
    return pool.filter((e) => {
      if (used.has(e.expenseID) || seen.has(e.expenseID)) return false;
      seen.add(e.expenseID);
      return true;
    });
  }, [form, invModal, data]);

  const addExpenseLine = (expenseId) => {
    const exp = expenseOptions.find((e) => String(e.expenseID) === String(expenseId));
    if (!exp) return;
    setForm((f) => ({
      ...f,
      items: [...f.items.filter((it) => it.expenseID || it.description || it.rate), expenseItem(exp)],
    }));
    setExpensePick("");
  };

  const formTotals = useMemo(() => {
    if (!form) return { subtotal: 0, tax: 0, total: 0 };
    const subtotal = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0);
    const tax = Number(form.taxAmount) || 0;
    return { subtotal, tax, total: subtotal + tax };
  }, [form]);

  const canSubmitInvoice = form && form.items.some((it) => it.description.trim() && Number(it.rate) > 0);

  const submitInvoice = async () => {
    setBusy(true);
    setFormError("");
    try {
      const payload = {
        projectID: Number(projectId),
        issueDate: form.issueDate || todayISO(),
        dueDate: form.dueDate || null,
        taxAmount: Number(form.taxAmount) || 0,
        notes: form.notes.trim() || null,
        items: form.items
          .filter((it) => it.expenseID || it.description.trim() || Number(it.rate) !== 0)
          .map((it) => ({
            description: it.description.trim(),
            quantity: Number(it.quantity) || 1,
            rate: Number(it.rate) || 0,
            phaseID: it.phaseID ?? null,
            expenseID: it.expenseID ?? null,
          })),
      };
      if (invModal.mode === "edit") {
        await billingService.updateInvoice(invModal.invoiceId, payload);
        showToast("Invoice updated.");
      } else {
        await billingService.createInvoice(payload);
        showToast("Invoice created.");
      }
      closeInvModal();
      await load({ quiet: true });
    } catch (err) {
      setFormError(errorText(err, "Could not save the invoice."));
    } finally {
      setBusy(false);
    }
  };

  // Payment 
  const openPay = (inv) => {
    setPayModal(inv);
    setPayForm({ amount: String(inv.due > 0 ? inv.due : ""), paymentDate: todayISO(), method: "Cash", reference: "" });
  };
  const closePay = () => { setPayModal(null); setPayForm(null); };

  const submitPayment = async () => {
    setBusy(true);
    try {
      await billingService.recordPayment({
        invoiceID: payModal.invoiceID,
        amount: Number(payForm.amount) || 0,
        paymentDate: payForm.paymentDate || todayISO(),
        method: payForm.method,
        reference: payForm.reference.trim() || null,
      });
      showToast("Payment recorded.");
      closePay();
      await load({ quiet: true });
    } catch {
      showToast("Could not record payment.", "error");
    } finally {
      setBusy(false);
    }
  };

  // Deletes
  const doDeleteInvoice = async () => {
    setBusy(true);
    try {
      await billingService.deleteInvoice(delInvoice.invoiceID);
      showToast("Invoice deleted.", "warn");
      setDelInvoice(null);
      await load({ quiet: true });
    } catch {
      showToast("Could not delete invoice.", "error");
    } finally {
      setBusy(false);
    }
  };

  const doDeletePayment = async () => {
    setBusy(true);
    try {
      await billingService.deletePayment(delPayment.payment.paymentID);
      showToast("Payment removed.", "warn");
      setDelPayment(null);
      await load({ quiet: true });
    } catch {
      showToast("Could not remove payment.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <DashboardLayout title="Project Billing"><div className="pbl-empty"><div className="pbl-spinner" /><p>Loading...</p></div></DashboardLayout>;
  }
  if (error || !data) {
    return (
      <DashboardLayout title="Project Billing">
        <button className="pbl-back" onClick={() => navigate("/dashboard/billing")}>← Back to Billing</button>
        <div className="pbl-empty"><h3>Project not found</h3><p>This project may have been removed.</p></div>
      </DashboardLayout>
    );
  }

  // Only work billed against the budget fills the bar; reimbursed expenses are outside the price.
  const contractInvoiced = data.contractInvoiced ?? data.totalInvoiced;
  const pct = data.budget > 0 ? Math.min(100, Math.round((contractInvoiced / data.budget) * 100)) : 0;
  const pending = data.pendingReimbursements || [];
  const pendingTotal = pending.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <DashboardLayout title="Project Billing">
      <div className="pbl-topbar">
        <button className="pbl-back" onClick={() => navigate("/dashboard/billing")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back to Billing
        </button>
        {canManage && (
          <button className="pbl-new" onClick={() => openCreate()}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Invoice
          </button>
        )}
      </div>

      {/* Project header */}
      <div className="pbl-header">
        <div className="pbl-head-main">
          <h2>{data.title}</h2>
          <div className="pbl-head-meta">
            <span>{data.clientName}</span>
            {data.clientPhone && <span>· {data.clientPhone}</span>}
            {data.location && <span>· {data.location}</span>}
          </div>
        </div>
        <div className="pbl-metrics">
          <div className="pbl-metric">
            <span className="pbl-metric-lbl">Budget</span>
            <span className="pbl-metric-val">{rupees(data.budget)}</span>
          </div>
          <div className="pbl-metric">
            <span className="pbl-metric-lbl">Invoiced</span>
            <span className="pbl-metric-val">{rupees(data.totalInvoiced)}</span>
            {data.reimbursementInvoiced > 0 && <span className="pbl-metric-sub">incl. {rupees(data.reimbursementInvoiced)} expenses</span>}
          </div>
          <div className="pbl-metric">
            <span className="pbl-metric-lbl">Received</span>
            <span className="pbl-metric-val green">{rupees(data.received)}</span>
          </div>
          <div className="pbl-metric">
            <span className="pbl-metric-lbl">Remaining</span>
            <span className={`pbl-metric-val ${data.outstanding > 0 ? "amber" : ""}`}>{rupees(data.outstanding)}</span>
          </div>
        </div>
      </div>

      {/* Billed-of-budget bar */}
      <div className="pbl-budgetbar">
        <div className="pbl-budgetbar-top">
          <span>Billed of Budget</span>
          <span className="pbl-budgetbar-pct">{data.percentInvoiced}%</span>
        </div>
        <div className="pbl-bar"><span style={{ width: `${pct}%` }} className={pct >= 100 ? "full" : ""} /></div>
        {data.reimbursementInvoiced > 0 && (
          <p className="pbl-budgetbar-note">Reimbursed project expenses ({rupees(data.reimbursementInvoiced)}) are billed on top of the budget and are not counted here.</p>
        )}
      </div>

      {/* Recoverable expenses waiting to be billed */}
      {pending.length > 0 && (
        <div className="pbl-reimb">
          <div className="pbl-reimb-text">
            <strong>{pending.length} recoverable expense{pending.length === 1 ? "" : "s"} not billed yet · {rupees(pendingTotal)}</strong>
            <span>{pending.slice(0, 3).map((e) => e.description).join(", ")}{pending.length > 3 ? ` and ${pending.length - 3} more` : ""}</span>
          </div>
          {canManage && (
            <button className="pbl-reimb-btn" onClick={() => openCreate(pending)}>Bill to client</button>
          )}
        </div>
      )}

      {/* Invoice list */}
      {(!data.invoices || data.invoices.length === 0) ? (
        <div className="pbl-empty">
          <h3>No invoices yet</h3>
          <p>Create the first invoice to bill {data.clientName} toward the project budget.</p>
          {canManage && <button className="pbl-new pbl-new-lg" onClick={() => openCreate()}>+ New Invoice</button>}
        </div>
      ) : (
        <div className="pbl-list">
          {data.invoices.map((inv) => {
            const open = expanded === inv.invoiceID;
            const st = (inv.status || "Unpaid").toLowerCase();
            return (
              <div key={inv.invoiceID} className={`pbl-inv ${st}`}>
                <button className="pbl-inv-head" onClick={() => setExpanded(open ? null : inv.invoiceID)}>
                  <div className="pbl-inv-id">
                    <span className="pbl-inv-num">{inv.invoiceNumber}</span>
                    <span className={`pbl-status ${st}`}>{inv.status}</span>
                  </div>
                  <div className="pbl-inv-dates">
                    <span>Issued {fmtDate(inv.issueDate)}</span>
                    {inv.dueDate && <span className={st === "overdue" ? "pbl-due-red" : ""}>Due {fmtDate(inv.dueDate)}</span>}
                  </div>
                  <div className="pbl-inv-amts">
                    <div className="pbl-inv-amt">
                      <span className="pbl-inv-amt-lbl">Total</span>
                      <span className="pbl-inv-amt-val">{rupees(inv.total)}</span>
                    </div>
                    <div className="pbl-inv-amt">
                      <span className="pbl-inv-amt-lbl">Due</span>
                      <span className={`pbl-inv-amt-val ${inv.due > 0 ? "amber" : "green"}`}>{rupees(inv.due)}</span>
                    </div>
                  </div>
                  <svg className={`pbl-chev ${open ? "up" : ""}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>

                {open && (
                  <div className="pbl-inv-body">
                    {/* Line items */}
                    <table className="pbl-items">
                      <thead>
                        <tr><th>Description</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr>
                      </thead>
                      <tbody>
                        {inv.items.map((it) => (
                          <tr key={it.itemID}>
                            <td>{it.description}{it.expenseID && <span className="pbl-reimb-tag">Reimbursement</span>}</td>
                            <td className="r">{formatQty(it.quantity)}</td>
                            <td className="r">{rupees(it.rate)}</td>
                            <td className="r">{rupees(it.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="pbl-inv-totals">
                      <div className="pbl-tot-row"><span>Subtotal</span><strong>{rupees(inv.subtotal)}</strong></div>
                      {inv.taxAmount > 0 && <div className="pbl-tot-row"><span>Tax</span><strong>{rupees(inv.taxAmount)}</strong></div>}
                      <div className="pbl-tot-row big"><span>Total</span><strong>{rupees(inv.total)}</strong></div>
                      <div className="pbl-tot-words">{amountInWords(inv.total)}</div>
                      <div className="pbl-tot-row"><span>Paid</span><strong className="green">{rupees(inv.paid)}</strong></div>
                      <div className="pbl-tot-row"><span>Remaining</span><strong className={inv.due > 0 ? "amber" : "green"}>{rupees(inv.due)}</strong></div>
                    </div>

                    {inv.notes && <div className="pbl-inv-notes"><strong>Notes:</strong> {inv.notes}</div>}

                    {/* Payments ledger */}
                    {inv.payments && inv.payments.length > 0 && (
                      <div className="pbl-payments">
                        <div className="pbl-payments-title">Payments</div>
                        {inv.payments.map((p) => (
                          <div key={p.paymentID} className="pbl-pay-row">
                            <div className="pbl-pay-main">
                              <span className="pbl-pay-amt">{rupees(p.amount)}</span>
                              <span className={`pbl-pay-method ${p.method.replace(/\s/g, "").toLowerCase()}`}>{p.method}</span>
                              {p.reference && <span className="pbl-pay-ref">#{p.reference}</span>}
                            </div>
                            <div className="pbl-pay-side">
                              <span className="pbl-pay-date">{fmtDate(p.paymentDate)}</span>
                              {canManage && (
                                <button className="pbl-pay-del" onClick={() => setDelPayment({ payment: p, invoice: inv })} title="Remove payment">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pbl-inv-actions">
                      <button className="pbl-act print" onClick={() => navigate(`/dashboard/billing/invoice/${inv.invoiceID}/print`)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                        Print
                      </button>
                      {canManage && inv.due > 0 && (
                        <button className="pbl-act pay" onClick={() => openPay(inv)}>Record Payment</button>
                      )}
                      {canManage && (
                        <button className="pbl-act edit" onClick={() => openEdit(inv)}>Edit</button>
                      )}
                      {canManage && (
                        <button className="pbl-act del" onClick={() => setDelInvoice(inv)}>Delete</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/*  Invoice form modal  */}
      {invModal && form && (
        <div className="pbl-overlay" onClick={(e) => e.target.classList.contains("pbl-overlay") && closeInvModal()}>
          <div className="pbl-modal pbl-modal-lg">
            <div className="pbl-modal-head">
              <h3>{invModal.mode === "edit" ? `Edit ${invModal.invoiceNumber}` : "New Invoice"}</h3>
              <button className="pbl-x" onClick={closeInvModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="pbl-modal-body">
              {/* Dates */}
              <div className="pbl-form-row">
                <div className="pbl-field">
                  <label>Issue Date <span>*</span></label>
                  <DatePicker value={form.issueDate} onChange={(v) => setForm((f) => ({ ...f, issueDate: v }))} allowClear={false} />
                </div>
                <div className="pbl-field">
                  <label>Due Date</label>
                  <DatePicker value={form.dueDate} onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))} placeholder="Optional" />
                </div>
              </div>

              {/* Phase quick-fill */}
              {data.phases && data.phases.length > 0 && (
                <div className="pbl-phasefill">
                  <label>Quick-fill from a project phase</label>
                  <select value={phasePick} onChange={(e) => { setPhasePick(e.target.value); if (e.target.value) addPhaseLine(e.target.value); }}>
                    <option value="">+ Add a phase as a line…</option>
                    {data.phases.map((ph) => <option key={ph.phaseID} value={ph.phaseID}>{ph.name}</option>)}
                  </select>
                  <p className="pbl-phasefill-hint">Adds the phase as a line — then enter the price you're billing the client for it.</p>
                </div>
              )}

              {/* Recoverable expense quick-fill */}
              {expenseOptions.length > 0 && (
                <div className="pbl-phasefill pbl-expfill">
                  <label>Add a recoverable expense</label>
                  <select value={expensePick} onChange={(e) => { setExpensePick(e.target.value); if (e.target.value) addExpenseLine(e.target.value); }}>
                    <option value="">+ Bill an expense paid on the client's behalf…</option>
                    {expenseOptions.map((e) => (
                      <option key={e.expenseID} value={e.expenseID}>{e.description} — {rupees(e.amount)}</option>
                    ))}
                  </select>
                  <p className="pbl-phasefill-hint">Adds the expense at its exact amount. It is billed on top of the budget.</p>
                </div>
              )}

              {/* Line items */}
              <div className="pbl-items-edit">
                <div className="pbl-items-head">
                  <span className="col-desc">Description</span>
                  <span className="col-qty">Qty</span>
                  <span className="col-rate">Rate (Rs.)</span>
                  <span className="col-amt">Amount</span>
                  <span className="col-x" />
                </div>
                {form.items.map((it, idx) => {
                  const amt = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
                  const isExpense = !!it.expenseID;
                  return (
                    <div className={`pbl-item-row ${isExpense ? "expense" : ""}`} key={idx}>
                      <input className="col-desc" type="text" maxLength={200} placeholder="e.g. Foundation milestone" value={it.description} onChange={(e) => setItem(idx, "description", e.target.value)} title={isExpense ? "Reimbursement of a recoverable project expense" : undefined} />
                      <input className="col-qty" type="number" min="0" step="any" value={it.quantity} readOnly={isExpense} onChange={(e) => setItem(idx, "quantity", e.target.value)} />
                      <input className="col-rate" type="number" min="0" step="any" placeholder="0" value={it.rate} readOnly={isExpense} onChange={(e) => setItem(idx, "rate", e.target.value)} />
                      <span className="col-amt pbl-item-amt">{rupees(amt)}</span>
                      <button className="col-x pbl-item-x" onClick={() => removeItem(idx)} disabled={form.items.length === 1} title="Remove line">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  );
                })}
                <button className="pbl-additem" onClick={addItem}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Add line
                </button>
              </div>

              {/* Tax + notes + totals */}
              <div className="pbl-form-row">
                <div className="pbl-field">
                  <label>Tax Amount (Rs.)</label>
                  <input type="number" min="0" step="any" placeholder="Leave 0 if none" value={form.taxAmount} onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))} />
                </div>
                <div className="pbl-field">
                  <label>Notes</label>
                  <input type="text" maxLength={255} placeholder="Optional" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              <div className="pbl-form-totals">
                <div className="pbl-ft-row"><span>Subtotal</span><strong>{rupees(formTotals.subtotal)}</strong></div>
                <div className="pbl-ft-row"><span>Tax</span><strong>{rupees(formTotals.tax)}</strong></div>
                <div className="pbl-ft-row big"><span>Total</span><strong>{rupees(formTotals.total)}</strong></div>
                {formTotals.total > 0 && <div className="pbl-ft-words">{amountInWords(formTotals.total)}</div>}
              </div>

              {formError && <div className="pbl-form-error">{formError}</div>}
            </div>

            <div className="pbl-modal-actions">
              <button className="pbl-btn-cancel" onClick={closeInvModal} disabled={busy}>Cancel</button>
              <button className="pbl-btn-ok" onClick={submitInvoice} disabled={busy || !canSubmitInvoice}>
                {busy ? "Saving..." : invModal.mode === "edit" ? "Save Changes" : "Create Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payModal && payForm && (
        <div className="pbl-overlay" onClick={(e) => e.target.classList.contains("pbl-overlay") && closePay()}>
          <div className="pbl-modal">
            <div className="pbl-modal-head">
              <h3>Record Payment</h3>
              <button className="pbl-x" onClick={closePay}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="pbl-modal-body">
              <div className="pbl-pay-summary">
                <span>{payModal.invoiceNumber}</span>
                <div><span className="pbl-pay-due-lbl">Remaining due</span><strong>{rupees(payModal.due)}</strong></div>
              </div>

              <label className="pbl-modal-label">Amount (Rs.) <span>*</span></label>
              <input type="number" min="0" step="any" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} autoFocus />
              {payForm.amount !== "" && Number(payForm.amount) > 0 && <div className="pbl-words">= {amountInWords(payForm.amount)}</div>}

              <div className="pbl-form-row">
                <div className="pbl-field">
                  <label>Payment Date</label>
                  <DatePicker value={payForm.paymentDate} onChange={(v) => setPayForm((f) => ({ ...f, paymentDate: v }))} allowClear={false} />
                </div>
                <div className="pbl-field">
                  <label>Method</label>
                  <select value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}>
                    {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <label className="pbl-modal-label">Reference {payForm.method !== "Cash" ? "" : "(optional)"}</label>
              <input type="text" maxLength={255} placeholder={payForm.method === "Cheque" ? "Cheque number" : payForm.method === "Bank Transfer" ? "Transaction ID" : "Optional reference"} value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="pbl-modal-actions">
              <button className="pbl-btn-cancel" onClick={closePay} disabled={busy}>Cancel</button>
              <button className="pbl-btn-ok" onClick={submitPayment} disabled={busy || !(Number(payForm.amount) > 0)}>{busy ? "Saving..." : "Record Payment"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete invoice confirm */}
      {delInvoice && (
        <div className="pbl-overlay" onClick={(e) => e.target.classList.contains("pbl-overlay") && setDelInvoice(null)}>
          <div className="pbl-confirm">
            <div className="pbl-confirm-ic">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </div>
            <h3>Delete {delInvoice.invoiceNumber}?</h3>
            <p>This removes the invoice, its {delInvoice.items.length} line item{delInvoice.items.length === 1 ? "" : "s"} and all recorded payments. This cannot be undone.</p>
            <div className="pbl-modal-actions">
              <button className="pbl-btn-cancel" onClick={() => setDelInvoice(null)} disabled={busy}>Cancel</button>
              <button className="pbl-btn-danger" onClick={doDeleteInvoice} disabled={busy}>{busy ? "..." : "Yes, Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete payment confirm */}
      {delPayment && (
        <div className="pbl-overlay" onClick={(e) => e.target.classList.contains("pbl-overlay") && setDelPayment(null)}>
          <div className="pbl-confirm">
            <div className="pbl-confirm-ic">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </div>
            <h3>Remove this payment?</h3>
            <p>{rupees(delPayment.payment.amount)} ({delPayment.payment.method}) will be removed from {delPayment.invoice.invoiceNumber}. The balance due will increase again.</p>
            <div className="pbl-modal-actions">
              <button className="pbl-btn-cancel" onClick={() => setDelPayment(null)} disabled={busy}>Cancel</button>
              <button className="pbl-btn-danger" onClick={doDeletePayment} disabled={busy}>{busy ? "..." : "Yes, Remove"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`pbl-toast pbl-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default ProjectBilling;
