import { useState, useRef } from "react";
import { formatQty, money, amountInWords, currencySymbol } from "../utils/format";
import { projectService } from "../services/projectService";
import "./StockModal.css";
import ModalOverlay from "./ModalOverlay";

function StockModal({ mode, material, projects = [], onClose, onSave }) {
  const isIssue = mode === "issue";
  const [quantity, setQuantity] = useState("");
  const [rate, setRate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [phases, setPhases] = useState([]);
  const [phaseId, setPhaseId] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  const current = Number(material.currentStock) || 0;
  const avgCost = Number(material.avgCost) || 0;
  const qty = Number(quantity) || 0;

  const unitCost = isIssue ? avgCost : Number(rate) || 0;
  const resulting = isIssue ? current - qty : current + qty;
  const total = qty * unitCost;
  const notEnough = isIssue && qty > current;

  // Phases of the project picked last; a slower answer for an earlier pick is ignored.
  const pickedProject = useRef("");
  const onProjectChange = async (pid) => {
    pickedProject.current = pid;
    setProjectId(pid);
    setPhaseId("");
    setPhases([]);
    setErrors((e) => ({ ...e, project: "" }));
    if (pid) {
      try {
        const p = await projectService.getById(pid);
        if (pickedProject.current === pid) setPhases(p.phases || []);
      } catch {
        if (pickedProject.current === pid) setPhases([]);
      }
    }
  };

  const validate = () => {
    const e = {};
    if (quantity === "" || qty <= 0) e.quantity = "Enter a quantity greater than zero.";
    else if (notEnough) e.quantity = `Only ${formatQty(current)} ${material.unit} available.`;

    if (!isIssue && (rate === "" || Number(rate) < 0)) e.rate = "Enter a valid buying price.";
    if (isIssue && !projectId) e.project = "Select a project.";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setServerError("");
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = { quantity: qty, note: note.trim() || null };
      if (isIssue) {
        const proj = projects.find((p) => String(p.projectID) === String(projectId));
        payload.projectName = proj ? proj.title : "";
        payload.projectID = Number(projectId);
        payload.phaseID = phaseId ? Number(phaseId) : null;
      } else {
        payload.rate = Number(rate);
      }
      await onSave(payload);
    } catch (err) {
      setServerError(err.response?.data?.message || "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <ModalOverlay className="stm-overlay" onClose={onClose}>
      <div className={`stm-modal ${isIssue ? "issue" : "restock"}`}>
        <div className="stm-head">
          <div>
            <h3>{isIssue ? "Issue Stock" : "Restock"}</h3>
            <p>{material.name}</p>
          </div>
          <button className="stm-close" data-close onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {serverError && <div className="stm-server-error">{serverError}</div>}

        <div className="stm-body">
          {isIssue && (
            <div className="stm-row">
              <div className="stm-field">
                <label>Project <span className="req">*</span></label>
                <select value={projectId} onChange={(e) => onProjectChange(e.target.value)} className={errors.project ? "err" : ""}>
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => <option key={p.projectID} value={p.projectID}>{p.title}</option>)}
                </select>
                {errors.project && <span className="stm-err">{errors.project}</span>}
              </div>
              <div className="stm-field">
                <label>Phase</label>
                <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} disabled={!projectId || phases.length === 0}>
                  <option value="">{phases.length === 0 ? "No phases" : "-- Whole project --"}</option>
                  {phases.map((ph) => <option key={ph.phaseID} value={ph.phaseID}>{ph.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="stm-row">
            <div className="stm-field">
              <label>Quantity ({material.unit}) <span className="req">*</span></label>
              <input type="number" min="0" step="any" value={quantity} onChange={(e) => { setQuantity(e.target.value); setErrors({ ...errors, quantity: "" }); }} className={errors.quantity ? "err" : ""} placeholder="0" />
              {errors.quantity ? <span className="stm-err">{errors.quantity}</span> : qty > 0 && <span className="stm-hint">= {formatQty(qty)} {material.unit}</span>}
            </div>

            {isIssue ? (
              <div className="stm-field">
                <label>Issue Cost (avg) </label>
                <div className="stm-readonly">{money(avgCost)} / {material.unit}</div>
                <span className="stm-hint">{amountInWords(avgCost)} / {material.unit}</span>
              </div>
            ) : (
              <div className="stm-field">
                <label>Buying Price ({currencySymbol()} / {material.unit}) <span className="req">*</span></label>
                <input type="number" min="0" step="any" value={rate} onChange={(e) => { setRate(e.target.value); setErrors({ ...errors, rate: "" }); }} className={errors.rate ? "err" : ""} placeholder="0" />
                {errors.rate ? <span className="stm-err">{errors.rate}</span> : Number(rate) > 0 && <span className="stm-hint">{amountInWords(rate)} / {material.unit}</span>}
              </div>
            )}
          </div>

          <div className="stm-field">
            <label>Note</label>
            <input type="text" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" autoComplete="off" />
          </div>

          <div className={`stm-preview ${notEnough ? "danger" : ""}`}>
            <div className="stm-preview-row"><span>Current stock</span><strong>{formatQty(current)} {material.unit}</strong></div>
            <div className="stm-preview-row"><span>{isIssue ? "Issuing" : "Adding"}</span><strong>{formatQty(qty)} {material.unit}</strong></div>
            <div className="stm-preview-row stm-preview-total">
              <span>{isIssue ? "Remaining" : "Resulting"}</span>
              <strong>{formatQty(resulting)} {material.unit}</strong>
            </div>
            <div className="stm-preview-amount">
              <div className="stm-preview-row">
                <span>Total Amount</span>
                <strong className="accent">{money(total)}</strong>
              </div>
              {total > 0 && <div className="stm-preview-words">({amountInWords(total)})</div>}
            </div>
            {notEnough && <div className="stm-preview-warn">Not enough stock — only {formatQty(current)} {material.unit} available.</div>}
          </div>
        </div>

        <div className="stm-actions">
          <button className="stm-cancel" data-close onClick={onClose} disabled={saving}>Cancel</button>
          <button className={`stm-save ${isIssue ? "issue" : "restock"}`} onClick={handleSubmit} disabled={saving || notEnough}>
            {saving ? "Saving..." : isIssue ? "Issue Stock" : "Restock"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

export default StockModal;
