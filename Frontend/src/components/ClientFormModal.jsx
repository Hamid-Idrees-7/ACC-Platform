import { useState, useEffect } from "react";
import "./ClientFormModal.css";

// Validation helpers
const isValidPhone = (phone) => {
  const raw = phone.trim().replace(/[\s-]/g, "");
  const normalized = raw.startsWith("+92") ? "0" + raw.slice(3) : raw;
  return /^0\d{10}$/.test(normalized);
};
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const isValidCNIC = (cnic) => {
  const digits = cnic.replace(/-/g, "");
  return /^\d{13}$/.test(digits);
};

const emptyForm = {
  fullName: "", phone: "", secondaryPhone: "", cnic: "",
  email: "", city: "", address: "", clientType: "External",
};

function ClientFormModal({ mode, initialData, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setForm({
        fullName: initialData.fullName || "",
        phone: initialData.phone || "",
        secondaryPhone: initialData.secondaryPhone || "",
        cnic: initialData.cnic || "",
        email: initialData.email || "",
        city: initialData.city || "",
        address: initialData.address || "",
        clientType: initialData.clientType || "External",
      });
    }
  }, [mode, initialData]);

  const setField = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: "" });
  };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required.";
    else if (form.fullName.trim().length > 50) e.fullName = "Name is too long (max 50).";

    if (!form.phone.trim()) e.phone = "Phone number is required.";
    else if (!isValidPhone(form.phone)) e.phone = "Enter 11 digits, starting with 0 or +92.";

    if (form.secondaryPhone.trim() && !isValidPhone(form.secondaryPhone))
      e.secondaryPhone = "Enter a valid phone (0 or +92, 11 digits).";

    if (!form.cnic.trim()) e.cnic = "CNIC is required.";
    else if (!isValidCNIC(form.cnic)) e.cnic = "CNIC must be 13 digits.";

    if (form.email.trim() && !isValidEmail(form.email))
      e.email = "Enter a valid email address.";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setServerError("");
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        secondaryPhone: form.secondaryPhone.trim() || null,
        cnic: form.cnic.trim(),
        email: form.email.trim() || null,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        clientType: form.clientType,
        status: initialData?.status || "Active",
      });
    } catch (err) {
      setServerError(err.response?.data?.message || "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="cfm-overlay" onClick={(e) => e.target.classList.contains("cfm-overlay") && onClose()}>
      <div className="cfm-modal">
        <div className="cfm-head">
          <div>
            <h3>{mode === "edit" ? "Edit Client" : "Add New Client"}</h3>
            <p>Add an external client or internal company project</p>
          </div>
          <button className="cfm-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {serverError && <div className="cfm-server-error">{serverError}</div>}

        <div className="cfm-body">
          {/* Hidden fields to absorb browser autofill so it doesn't touch the real inputs */}
          <input type="text" style={{ display: "none" }} autoComplete="username" />
          <input type="password" style={{ display: "none" }} autoComplete="new-password" />
          <div className="cfm-grid">
            <div className="cfm-field">
              <label>Full Name <span className="req">*</span></label>
              <input type="text" maxLength={50} value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} className={errors.fullName ? "err" : ""} placeholder="Client's full name" autoComplete="new-client-field" />
              {errors.fullName && <span className="cfm-err">{errors.fullName}</span>}
            </div>
            <div className="cfm-field">
              <label>Phone <span className="req">*</span></label>
              <input type="text" maxLength={15} value={form.phone} onChange={(e) => setField("phone", e.target.value)} className={errors.phone ? "err" : ""} placeholder="+92 300 0000000" autoComplete="new-client-field" />
              {errors.phone ? <span className="cfm-err">{errors.phone}</span> : <span className="cfm-hint">11 digits, starting with 0 or +92</span>}
            </div>
            <div className="cfm-field">
              <label>Secondary Phone</label>
              <input type="text" maxLength={15} value={form.secondaryPhone} onChange={(e) => setField("secondaryPhone", e.target.value)} className={errors.secondaryPhone ? "err" : ""} placeholder="Optional" autoComplete="new-client-field" />
              {errors.secondaryPhone ? <span className="cfm-err">{errors.secondaryPhone}</span> : <span className="cfm-hint">Alternate contact number</span>}
            </div>
            <div className="cfm-field">
              <label>CNIC <span className="req">*</span></label>
              <input type="text" maxLength={15} value={form.cnic} onChange={(e) => setField("cnic", e.target.value)} className={errors.cnic ? "err" : ""} placeholder="ID card number" autoComplete="new-client-field" />
              {errors.cnic ? <span className="cfm-err">{errors.cnic}</span> : <span className="cfm-hint">13 digits (dashes optional)</span>}
            </div>
            <div className="cfm-field">
              <label>Email</label>
              <input type="email" maxLength={100} value={form.email} onChange={(e) => setField("email", e.target.value)} className={errors.email ? "err" : ""} placeholder="Optional" autoComplete="new-client-field" />
              {errors.email && <span className="cfm-err">{errors.email}</span>}
            </div>
            <div className="cfm-field">
              <label>Client Type <span className="req">*</span></label>
              <select value={form.clientType} onChange={(e) => setField("clientType", e.target.value)}>
                <option value="External">External (Real Client)</option>
                <option value="Internal">Internal (Company Project)</option>
              </select>
              <span className="cfm-hint">Internal = company's own investment project</span>
            </div>
            <div className="cfm-field">
              <label>City</label>
              <input type="text" maxLength={50} value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Optional" autoComplete="new-client-field" />
            </div>
            <div className="cfm-field cfm-field-full">
              <label>Address</label>
              <input type="text" maxLength={255} value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Optional" autoComplete="new-client-field" />
            </div>
          </div>
        </div>

        <div className="cfm-actions">
          <button className="cfm-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="cfm-save" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Add Client"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClientFormModal;
