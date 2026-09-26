import { useState, useEffect, useMemo } from "react";
import DatePicker, { formatDate } from "./DatePicker";
import { usePermissions } from "../context/PermissionContext";
import { projectExpenseService } from "../services/projectExpenseService";
import { rupees, amountInWords } from "../utils/format";
import "./ProjectExpenses.css";

// Example text per category, so the description field shows what fits.
const HINTS = {
  "Land & Plot": "e.g. Plot purchase balance payment",
  "Transfer & Registry Fees": "e.g. Plot transfer fee",
  "Taxes & Govt Duties": "e.g. Advance tax on property purchase",
  "Possession & Society Charges": "e.g. Possession charges",
  "Approvals & NOC": "e.g. Building map approval fee",
  "Utility Connections": "e.g. Electricity meter connection",
  "Equipment Rent": "e.g. Excavator rent (3 days)",
  Transport: "e.g. Debris removal trips",
  Subcontractor: "e.g. Steel fixing subcontract",
  "Site Running": "e.g. Site water and security",
  Other: "Describe what this expense was for",
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const todayISO = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

const errorText = (err, fallback) => {
  if (err?.response?.status === 403) return "You don't have permission for this action.";
  return err?.response?.data?.message || fallback;
};

const emptyForm = () => ({
  category: "",
  description: "",
  amount: "",
  expenseDate: todayISO(),
  phaseID: "",
  paidTo: "",
  reference: "",
  isRecoverable: false,
});

// The Project Expenses section on a projects page: one-off costs such as plot fees,
// transfer fees, taxes and possession charges. Company costs add to the project cost;
// recoverable ones are billed back to the client from Billing.
function ProjectExpenses({ projectId, readOnly = false, onChanged }) {
  const { can } = usePermissions();
  const canView = can("Expenses", "View");
  const canAdd = can("Expenses", "Add") && !readOnly;
  const canEdit = can("Expenses", "Edit") && !readOnly;
  const canDelete = can("Expenses", "Delete") && !readOnly;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("all"); // all | company | recoverable

  const [modal, setModal] = useState(null); 
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3200);
  };

  const load = async () => {
    try {
      const res = await projectExpenseService.getForProject(projectId);
      setData(res);
      setLoadError("");
    } catch (err) {
      setLoadError(errorText(err, "Could not load expenses."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    load();
   
  }, [projectId, canView]);

  const afterChange = async () => {
    await load();
    if (onChanged) onChanged();
  };

  const items = data?.items || [];
  const counts = useMemo(() => ({
    all: items.length,
    company: items.filter((e) => !e.isRecoverable).length,
    recoverable: items.filter((e) => e.isRecoverable).length,
  }), [items]);

  const visible = items.filter((e) =>
    filter === "all" ? true : filter === "company" ? !e.isRecoverable : e.isRecoverable
  );

  if (!canView) return null;

  // Form 
  const openAdd = () => {
    setForm(emptyForm());
    setFormError("");
    setModal({ mode: "add" });
  };

  const openEdit = (e) => {
    setForm({
      category: e.category,
      description: e.description,
      amount: String(e.amount),
      expenseDate: e.expenseDate ? e.expenseDate.substring(0, 10) : todayISO(),
      phaseID: e.phaseID ? String(e.phaseID) : "",
      paidTo: e.paidTo || "",
      reference: e.reference || "",
      isRecoverable: !!e.isRecoverable,
    });
    setFormError("");
    setModal({ mode: "edit", expense: e });
  };

  const closeModal = () => {
    if (busy) return;
    setModal(null);
    setFormError("");
  };

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormError("");
  };

  const validate = () => {
    if (!form.category) return "Choose a category.";
    const desc = form.description.trim();
    if (desc.length < 2) return form.category === "Other" ? "Describe what this expense was for." : "Add a short description.";
    const amount = Number(form.amount);
    if (!(amount > 0)) return "Enter an amount greater than zero.";
    if (!form.expenseDate) return "Pick the date the expense was paid.";
    if (form.expenseDate > todayISO()) return "Expense date can't be in the future.";
    return "";
  };

  const save = async () => {
    const problem = validate();
    if (problem) { setFormError(problem); return; }

    const payload = {
      category: form.category,
      description: form.description.trim(),
      amount: Number(form.amount),
      expenseDate: form.expenseDate,
      phaseID: form.phaseID ? Number(form.phaseID) : null,
      paidTo: form.paidTo.trim() || null,
      reference: form.reference.trim() || null,
      isRecoverable: form.isRecoverable,
    };

    setBusy(true);
    setFormError("");
    try {
      if (modal.mode === "edit") {
        await projectExpenseService.update(modal.expense.expenseID, payload);
        showToast("Expense updated.");
      } else {
        await projectExpenseService.create(projectId, payload);
        showToast("Expense added.");
      }
      setModal(null);
      await afterChange();
    } catch (err) {
      setFormError(errorText(err, "Could not save the expense."));
    } finally {
      setBusy(false);
    }
  };

  //  Delete 
  const doDelete = async () => {
    setBusy(true);
    try {
      const res = await projectExpenseService.delete(confirmDel.expenseID);
      setConfirmDel(null);
      if (res?.requiresApproval) {
        showToast(res.message || "Delete request sent for approval.", "info");
      } else {
        showToast("Expense deleted.", "error");
        await afterChange();
      }
    } catch (err) {
      setConfirmDel(null);
      showToast(errorText(err, "Could not delete the expense."), "error");
    } finally {
      setBusy(false);
    }
  };

  const lockedByInvoice = modal?.mode === "edit" && modal.expense?.isInvoiced;
  const categories = data?.categories || [];
  const phases = data?.phases || [];
  const topCategory = (data?.byCategory || [])[0];

  return (
    <div className="pex-card">
      <div className="pex-head">
        <div>
          <h3>Project Expenses</h3>
          <p className="pex-sub">Plot, transfer, taxes, possession and other one-off costs of this project.</p>
        </div>
        <div className="pex-head-right">
          <span className="pex-count">{items.length}</span>
          {canAdd && (
            <button className="pex-add" onClick={openAdd}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Expense
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="pex-state"><div className="pex-spinner" />Loading expenses...</div>
      ) : loadError ? (
        <div className="pex-error">{loadError}</div>
      ) : (
        <>
          {/* Totals */}
          <div className="pex-stats">
            <div className="pex-stat company">
              <span className="pex-stat-lbl">COMPANY COST</span>
              <strong>{rupees(data.companyTotal)}</strong>
              <em>{amountInWords(data.companyTotal)}</em>
              <small>Added to this project's actual cost{topCategory ? ` · most on ${topCategory.label}` : ""}</small>
            </div>
            <div className="pex-stat recoverable">
              <span className="pex-stat-lbl">RECOVERABLE FROM CLIENT</span>
              <strong>{rupees(data.recoverableTotal)}</strong>
              <em>{amountInWords(data.recoverableTotal)}</em>
              <small>
                {rupees(data.recoverableInvoiced)} billed · <b className={data.recoverablePending > 0 ? "pex-pending" : ""}>{rupees(data.recoverablePending)} to bill</b>
              </small>
            </div>
          </div>

          {items.length > 0 && (
            <div className="pex-filters">
              {[
                ["all", "All"],
                ["company", "Company cost"],
                ["recoverable", "Recoverable"],
              ].map(([key, label]) => (
                <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>
                  {label} <span>{counts[key]}</span>
                </button>
              ))}
            </div>
          )}

          {/* List */}
          {items.length === 0 ? (
            <div className="pex-empty">
              <strong>No expenses recorded yet</strong>
              <span>Record plot fees, transfer fees, taxes, possession charges and similar costs here, so this project's profit is real.</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="pex-empty"><span>No {filter === "company" ? "company cost" : "recoverable"} expenses.</span></div>
          ) : (
            <div className="pex-list">
              {visible.map((e) => {
                const d = new Date(e.expenseDate);
                const meta = [
                  e.phaseName,
                  e.paidTo ? `Paid to ${e.paidTo}` : null,
                  e.reference ? `Ref ${e.reference}` : null,
                ].filter(Boolean);
                return (
                  <div key={e.expenseID} className={`pex-row ${e.isRecoverable ? "rec" : ""}`}>
                    <div className="pex-date">
                      <strong>{isNaN(d) ? "—" : d.getDate()}</strong>
                      <span>{isNaN(d) ? "" : `${MON[d.getMonth()]} ${d.getFullYear()}`}</span>
                    </div>
                    <div className="pex-main">
                      <span className="pex-cat">{e.category}</span>
                      <div className="pex-desc">{e.description}</div>
                      <div className="pex-meta">{meta.join(" · ")}</div>
                    </div>
                    <div className="pex-amt">
                      <strong>{rupees(e.amount)}</strong>
                      <em className="pex-amt-words">{amountInWords(e.amount)}</em>
                      {!e.isRecoverable ? (
                        <span className="pex-tag company">Company cost</span>
                      ) : e.isInvoiced ? (
                        <span className="pex-tag billed">Billed · {e.invoiceNumber}</span>
                      ) : (
                        <span className="pex-tag tobill">Recoverable · to bill</span>
                      )}
                    </div>
                    {(canEdit || canDelete) && (
                      <div className="pex-actions">
                        {canEdit && (
                          <button onClick={() => openEdit(e)} aria-label="Edit expense" title="Edit">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="pex-del"
                            onClick={() => setConfirmDel(e)}
                            disabled={e.isInvoiced}
                            aria-label="Delete expense"
                            title={e.isInvoiced ? `Billed on ${e.invoiceNumber} — remove it from that invoice first` : "Delete"}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {data.recoverablePending > 0 && (
            <p className="pex-note">
              Recoverable expenses are billed to the client from <strong>Billing</strong> → this project → New Invoice → "Add a recoverable expense".
            </p>
          )}
        </>
      )}

      {/* Add / edit modal */}
      {modal && (
        <div className="pex-overlay" onClick={(ev) => ev.target.classList.contains("pex-overlay") && closeModal()}>
          <div className="pex-modal" role="dialog" aria-modal="true">
            <h3>{modal.mode === "edit" ? "Edit Expense" : "Add Expense"}</h3>
            <p className="pex-modal-sub">A one-off cost paid for this project.</p>

            {lockedByInvoice && (
              <div className="pex-lock">This expense is billed on <strong>{modal.expense.invoiceNumber}</strong>, so its amount and type are locked. You can still fix the other details.</div>
            )}

            <div className="pex-grid">
              <div className="pex-field">
                <label>Category <span>*</span></label>
                <select value={form.category} onChange={(ev) => set("category", ev.target.value)}>
                  <option value="">Choose a category</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="pex-field">
                <label>Date Paid <span>*</span></label>
                <DatePicker value={form.expenseDate} onChange={(v) => set("expenseDate", v)} allowClear={false} />
              </div>
            </div>

            <div className="pex-field">
              <label>Description <span>*</span></label>
              <input type="text" maxLength={200} value={form.description} placeholder={HINTS[form.category] || "e.g. Plot transfer fee"} onChange={(ev) => set("description", ev.target.value)} />
            </div>

            <div className="pex-grid">
              <div className="pex-field">
                <label>Amount (Rs.) <span>*</span></label>
                <input type="number" min="0" step="any" value={form.amount} disabled={lockedByInvoice} placeholder="0" onChange={(ev) => set("amount", ev.target.value)} />
                {Number(form.amount) > 0 && <div className="pex-words">{amountInWords(form.amount)}</div>}
              </div>
              <div className="pex-field">
                <label>Phase</label>
                <select value={form.phaseID} onChange={(ev) => set("phaseID", ev.target.value)}>
                  <option value="">General (whole project)</option>
                  {phases.map((p) => <option key={p.phaseID} value={p.phaseID}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="pex-grid">
              <div className="pex-field">
                <label>Paid To</label>
                <input type="text" maxLength={100} value={form.paidTo} placeholder="e.g. LDA, Society office" onChange={(ev) => set("paidTo", ev.target.value)} />
              </div>
              <div className="pex-field">
                <label>Reference No.</label>
                <input type="text" maxLength={60} value={form.reference} placeholder="Challan / receipt / cheque no." onChange={(ev) => set("reference", ev.target.value)} />
              </div>
            </div>

            <div className="pex-field">
              <label>Who bears this cost?</label>
              <div className="pex-choice">
                <button
                  type="button"
                  className={!form.isRecoverable ? "active" : ""}
                  disabled={lockedByInvoice}
                  onClick={() => set("isRecoverable", false)}
                >
                  <strong>Company cost</strong>
                  <span>Added to the project cost. Lowers profit.</span>
                </button>
                <button
                  type="button"
                  className={form.isRecoverable ? "active rec" : ""}
                  disabled={lockedByInvoice}
                  onClick={() => set("isRecoverable", true)}
                >
                  <strong>Recoverable from client</strong>
                  <span>Paid on the client's behalf and billed back. Profit stays the same.</span>
                </button>
              </div>
            </div>

            {formError && <div className="pex-form-error">{formError}</div>}

            <div className="pex-modal-actions">
              <button className="pex-btn-cancel" onClick={closeModal} disabled={busy}>Cancel</button>
              <button className="pex-btn-save" onClick={save} disabled={busy}>
                {busy ? "Saving..." : modal.mode === "edit" ? "Save Changes" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="pex-overlay" onClick={(ev) => ev.target.classList.contains("pex-overlay") && !busy && setConfirmDel(null)}>
          <div className="pex-modal pex-confirm" role="dialog" aria-modal="true">
            <h3>Delete this expense?</h3>
            <p>
              <strong>{confirmDel.description}</strong> ({rupees(confirmDel.amount)}, {formatDate(confirmDel.expenseDate)}) will be removed
              {confirmDel.isRecoverable ? "." : " and the project cost will go down by this amount."}
            </p>
            <div className="pex-modal-actions">
              <button className="pex-btn-cancel" onClick={() => setConfirmDel(null)} disabled={busy}>Cancel</button>
              <button className="pex-btn-del" onClick={doDelete} disabled={busy}>{busy ? "..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`pex-toast pex-toast-${toast.type}`}>{toast.text}</div>}
    </div>
  );
}

export default ProjectExpenses;
