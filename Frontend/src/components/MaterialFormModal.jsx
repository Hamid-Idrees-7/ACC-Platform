import { useState, useEffect } from "react";
import { formatNum, formatQty, amountInWords } from "../utils/format";
import "./MaterialFormModal.css";

const emptyForm = {
  name: "",
  category: "",
  unit: "",
  lowStockThreshold: "",
  initialStock: "",
  initialRate: "",
};

function MaterialFormModal({ mode, initialData, existingCategories = [], existingUnits = [], onClose, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  const isEdit = mode === "edit";

  useEffect(() => {
    if (isEdit && initialData) {
      setForm({
        name: initialData.name || "",
        category: initialData.category || "",
        unit: initialData.unit || "",
        lowStockThreshold: initialData.lowStockThreshold ?? "",
        initialStock: "",
        initialRate: "",
      });
    }
  }, [isEdit, initialData]);

  const setField = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: "" });
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Material name is required.";
    else if (form.name.trim().length > 100) e.name = "Name is too long (max 100).";

    if (!form.category.trim()) e.category = "Category is required.";
    if (!form.unit.trim()) e.unit = "Unit is required.";

    if (form.lowStockThreshold === "" || Number(form.lowStockThreshold) < 0)
      e.lowStockThreshold = "Enter a valid alert level (0 or more).";

    if (!isEdit) {
      if (form.initialStock !== "" && Number(form.initialStock) < 0)
        e.initialStock = "Cannot be negative.";
      if (form.initialRate !== "" && Number(form.initialRate) < 0)
        e.initialRate = "Cannot be negative.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setServerError("");
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit.trim(),
        lowStockThreshold: Number(form.lowStockThreshold),
        status: initialData?.status || "Active",
      };
      if (!isEdit) {
        payload.initialStock = form.initialStock === "" ? null : Number(form.initialStock);
        payload.initialRate = form.initialRate === "" ? null : Number(form.initialRate);
      }
      await onSave(payload);
    } catch (err) {
      setServerError(err.response?.data?.message || "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="mfm-overlay" onClick={(e) => e.target.classList.contains("mfm-overlay") && onClose()}>
      <div className="mfm-modal">
        <div className="mfm-head">
          <div>
            <h3>{isEdit ? "Edit Material" : "Add New Material"}</h3>
            <p>Item details and stock alert level</p>
          </div>
          <button className="mfm-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {serverError && <div className="mfm-server-error">{serverError}</div>}

        <div className="mfm-body">
          <div className="mfm-grid">
            <div className="mfm-field mfm-field-full">
              <label>Material Name <span className="req">*</span></label>
              <input type="text" maxLength={100} value={form.name} onChange={(e) => setField("name", e.target.value)} className={errors.name ? "err" : ""} placeholder="e.g. Bricks" autoComplete="off" />
              {errors.name && <span className="mfm-err">{errors.name}</span>}
            </div>

            <div className="mfm-field">
              <label>Category <span className="req">*</span></label>
              <input type="text" maxLength={50} value={form.category} onChange={(e) => setField("category", e.target.value)} className={errors.category ? "err" : ""} placeholder="e.g. Steel, Bricks" autoComplete="off" list="mfm-category-list" />
              <datalist id="mfm-category-list">
                {existingCategories.map((c) => <option key={c} value={c} />)}
              </datalist>
              {errors.category ? <span className="mfm-err">{errors.category}</span> : <span className="mfm-hint">Type or pick an existing one</span>}
            </div>

            <div className="mfm-field">
              <label>Unit <span className="req">*</span></label>
              <input type="text" maxLength={20} value={form.unit} onChange={(e) => setField("unit", e.target.value)} className={errors.unit ? "err" : ""} placeholder="e.g. Ton, Piece" autoComplete="off" list="mfm-unit-list" disabled={isEdit} />
              <datalist id="mfm-unit-list">
                {existingUnits.map((u) => <option key={u} value={u} />)}
              </datalist>
              {errors.unit ? <span className="mfm-err">{errors.unit}</span> : <span className="mfm-hint">{isEdit ? "Unit can't change after creation" : "Measurement unit"}</span>}
            </div>

            <div className="mfm-field">
              <label>Low Stock Alert <span className="req">*</span></label>
              <input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => setField("lowStockThreshold", e.target.value)} className={errors.lowStockThreshold ? "err" : ""} placeholder="0" />
              {errors.lowStockThreshold ? <span className="mfm-err">{errors.lowStockThreshold}</span> : form.lowStockThreshold !== "" ? <span className="mfm-num">= {formatNum(form.lowStockThreshold)}{form.unit ? ` ${form.unit}` : ""}</span> : <span className="mfm-hint">Warn when stock reaches this</span>}
            </div>

            {!isEdit && (
              <>
                <div className="mfm-field">
                  <label>Quantity</label>
                  <input type="number" min="0" step="any" value={form.initialStock} onChange={(e) => setField("initialStock", e.target.value)} className={errors.initialStock ? "err" : ""} placeholder="0" />
                  {errors.initialStock ? <span className="mfm-err">{errors.initialStock}</span> : form.initialStock !== "" ? <span className="mfm-num">= {formatQty(form.initialStock)}{form.unit ? ` ${form.unit}` : ""}</span> : <span className="mfm-hint">Stock purchased</span>}
                </div>
                <div className="mfm-field">
                  <label>Buying Price</label>
                  <input type="number" min="0" step="any" value={form.initialRate} onChange={(e) => setField("initialRate", e.target.value)} className={errors.initialRate ? "err" : ""} placeholder="0" />
                  {errors.initialRate ? <span className="mfm-err">{errors.initialRate}</span> : form.initialRate !== "" ? <span className="mfm-num">{amountInWords(form.initialRate)}{form.unit ? ` / ${form.unit}` : ""}</span> : <span className="mfm-hint">Price per unit</span>}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mfm-actions">
          <button className="mfm-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="mfm-save" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Material"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MaterialFormModal;
