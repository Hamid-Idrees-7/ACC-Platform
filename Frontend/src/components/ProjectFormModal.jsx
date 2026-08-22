import { useState, useEffect } from "react";
import DatePicker from "./DatePicker";
import { amountInWords } from "../utils/format";
import "./ProjectFormModal.css";

const emptyForm = {
  title: "",
  clientID: "",
  projectType: "",
  areaSize: "",
  startDate: "",
  expectedEndDate: "",
  budget: "",
  location: "",
  description: "",
  createStandardPhases: true,
};

function ProjectFormModal({ mode, initialData, clients = [], existingTypes = [], onClose, onSave }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (isEdit && initialData) {
      setForm({
        title: initialData.title || "",
        clientID: initialData.clientID || "",
        projectType: initialData.projectType || "",
        areaSize: initialData.areaSize || "",
        startDate: initialData.startDate ? initialData.startDate.split("T")[0] : "",
        expectedEndDate: initialData.expectedEndDate ? initialData.expectedEndDate.split("T")[0] : "",
        budget: initialData.budget ?? "",
        location: initialData.location || "",
        description: initialData.description || "",
        createStandardPhases: false,
      });
    }
  }, [isEdit, initialData]);

  const setField = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: "" });
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Project title is required.";
    if (!form.clientID) e.clientID = "Select a client.";
    if (!form.projectType.trim()) e.projectType = "Project type is required.";
    if (!form.areaSize.trim()) e.areaSize = "Area / size is required.";
    if (form.budget === "" || Number(form.budget) < 0) e.budget = "Enter a valid budget.";
    if (!form.location.trim()) e.location = "Location is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setServerError("");
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        clientID: Number(form.clientID),
        projectType: form.projectType.trim(),
        areaSize: form.areaSize.trim(),
        startDate: form.startDate || null,
        expectedEndDate: form.expectedEndDate || null,
        budget: Number(form.budget),
        location: form.location.trim(),
        description: form.description.trim() || null,
      };
      if (!isEdit) payload.createStandardPhases = form.createStandardPhases;
      await onSave(payload);
    } catch (err) {
      setServerError(err.response?.data?.message || "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="pfm-overlay" onClick={(e) => e.target.classList.contains("pfm-overlay") && onClose()}>
      <div className="pfm-modal">
        <div className="pfm-head">
          <div>
            <h3>{isEdit ? "Edit Project" : "Create New Project"}</h3>
            <p>{isEdit ? "Update project details" : "Add a project — optionally seed standard phases"}</p>
          </div>
          <button className="pfm-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {serverError && <div className="pfm-server-error">{serverError}</div>}

        <div className="pfm-body">
          <div className="pfm-grid">
            <div className="pfm-field pfm-field-full">
              <label>Project Title <span className="req">*</span></label>
              <input type="text" maxLength={100} value={form.title} onChange={(e) => setField("title", e.target.value)} className={errors.title ? "err" : ""} placeholder="Project Name" autoComplete="off" />
              {errors.title && <span className="pfm-err">{errors.title}</span>}
            </div>

            <div className="pfm-field">
              <label>Client <span className="req">*</span></label>
              <select value={form.clientID} onChange={(e) => setField("clientID", e.target.value)} className={errors.clientID ? "err" : ""}>
                <option value="">-- Select Client --</option>
                {clients.map((c) => <option key={c.clientID} value={c.clientID}>{c.fullName}</option>)}
              </select>
              {errors.clientID && <span className="pfm-err">{errors.clientID}</span>}
            </div>

            <div className="pfm-field">
              <label>Project Type <span className="req">*</span></label>
              <input type="text" maxLength={50} value={form.projectType} onChange={(e) => setField("projectType", e.target.value)} className={errors.projectType ? "err" : ""} placeholder="e.g. Residential, Commercial" autoComplete="off" list="pfm-type-list" />
              <datalist id="pfm-type-list">
                {existingTypes.map((t) => <option key={t} value={t} />)}
              </datalist>
              {errors.projectType ? <span className="pfm-err">{errors.projectType}</span> : <span className="pfm-hint">Type or pick an existing one</span>}
            </div>

            <div className="pfm-field">
              <label>Area / Size <span className="req">*</span></label>
              <input type="text" maxLength={50} value={form.areaSize} onChange={(e) => setField("areaSize", e.target.value)} className={errors.areaSize ? "err" : ""} placeholder="e.g. 6 Marla, 2 Kanal" autoComplete="off" />
              {errors.areaSize && <span className="pfm-err">{errors.areaSize}</span>}
            </div>

            <div className="pfm-field">
              <label>Start Date</label>
              <DatePicker value={form.startDate} onChange={(v) => setField("startDate", v)} placeholder="Optional" />
            </div>

            <div className="pfm-field">
              <label>Expected End Date</label>
              <DatePicker value={form.expectedEndDate} onChange={(v) => setField("expectedEndDate", v)} placeholder="Optional" />
            </div>

            <div className="pfm-field">
              <label>Total Budget (Rs.) <span className="req">*</span></label>
              <input type="number" min="0" step="any" value={form.budget} onChange={(e) => setField("budget", e.target.value)} className={errors.budget ? "err" : ""} placeholder="Enter amount" />
              {errors.budget ? <span className="pfm-err">{errors.budget}</span> : form.budget !== "" ? <span className="pfm-num">= {amountInWords(form.budget)}</span> : <span className="pfm-hint">From the client</span>}
            </div>

            <div className="pfm-field pfm-field-full">
              <label>Location / Address <span className="req">*</span></label>
              <input type="text" maxLength={255} value={form.location} onChange={(e) => setField("location", e.target.value)} className={errors.location ? "err" : ""} placeholder="Plot / block / area" autoComplete="off" />
              {errors.location && <span className="pfm-err">{errors.location}</span>}
            </div>

            <div className="pfm-field pfm-field-full">
              <label>Description</label>
              <input type="text" maxLength={500} value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Optional" autoComplete="off" />
            </div>
          </div>

          {!isEdit && (
            <label className="pfm-check">
              <input type="checkbox" checked={form.createStandardPhases} onChange={(e) => setField("createStandardPhases", e.target.checked)} />
              <span>
                <strong>Create standard construction phases automatically</strong>
                <em>Foundation → Grey Structure → Brickwork → Electrical → Plumbing → Plaster → Flooring & Tiles → Finishing (8 phases)</em>
              </span>
            </label>
          )}
        </div>

        <div className="pfm-actions">
          <button className="pfm-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="pfm-save" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProjectFormModal;
