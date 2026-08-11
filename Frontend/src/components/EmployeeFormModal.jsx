import { useState, useEffect } from "react";
import DatePicker from "./DatePicker";
import "./EmployeeFormModal.css";

// Validation helpers
const isValidPhone = (phone) => {
  const raw = phone.trim().replace(/[\s-]/g, "");
  const normalized = raw.startsWith("+92") ? "0" + raw.slice(3) : raw;
  return /^0\d{10}$/.test(normalized);
};
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const isValidCNIC = (cnic) => /^\d{13}$/.test(cnic.replace(/-/g, ""));

const emptyForm = {
  fullName: "", phone: "", secondaryPhone: "", cnic: "",
  email: "", address: "", city: "", designation: "", joiningDate: "",
};

function EmployeeFormModal({ mode, initialData, existingDesignations = [], onClose, onSave }) {
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
        address: initialData.address || "",
        city: initialData.city || "",
        designation: initialData.designation || "",
        joiningDate: initialData.joiningDate ? initialData.joiningDate.split("T")[0] : "",
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

    if (form.cnic.trim() && !isValidCNIC(form.cnic))
      e.cnic = "CNIC must be 13 digits.";

    if (form.email.trim() && !isValidEmail(form.email))
      e.email = "Enter a valid email address.";

    if (!form.designation.trim()) e.designation = "Designation is required.";

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
        cnic: form.cnic.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        designation: form.designation.trim(),
        joiningDate: form.joiningDate || null,
        status: initialData?.status || "Active",
      });
    } catch (err) {
      setServerError(err.response?.data?.message || "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="efm-overlay" onClick={(e) => e.target.classList.contains("efm-overlay") && onClose()}>
      <div className="efm-modal">
        <div className="efm-head">
          <div>
            <h3>{mode === "edit" ? "Edit Employee" : "Add New Employee"}</h3>
            <p>Enter the employee's details and designation</p>
          </div>
          <button className="efm-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {serverError && <div className="efm-server-error">{serverError}</div>}

        <div className="efm-body">
          {/* Hidden fields to absorb browser autofill */}
          <input type="text" style={{ display: "none" }} autoComplete="username" />
          <input type="password" style={{ display: "none" }} autoComplete="new-password" />

          <div className="efm-grid">
            <div className="efm-field">
              <label>Full Name <span className="req">*</span></label>
              <input type="text" maxLength={50} value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} className={errors.fullName ? "err" : ""} placeholder="Employee's full name" autoComplete="new-emp-field" />
              {errors.fullName && <span className="efm-err">{errors.fullName}</span>}
            </div>
            <div className="efm-field">
              <label>Phone <span className="req">*</span></label>
              <input type="text" maxLength={15} value={form.phone} onChange={(e) => setField("phone", e.target.value)} className={errors.phone ? "err" : ""} placeholder="+92 300 0000000" autoComplete="new-emp-field" />
              {errors.phone ? <span className="efm-err">{errors.phone}</span> : <span className="efm-hint">11 digits, starting with 0 or +92</span>}
            </div>
            <div className="efm-field">
              <label>Designation <span className="req">*</span></label>
              <input type="text" maxLength={50} value={form.designation} onChange={(e) => setField("designation", e.target.value)} className={errors.designation ? "err" : ""} placeholder="e.g. Site Engineer, Mason" autoComplete="off" list="designation-list" />
              <datalist id="designation-list">
                {existingDesignations.map((d) => <option key={d} value={d} />)}
              </datalist>
              {errors.designation ? <span className="efm-err">{errors.designation}</span> : <span className="efm-hint">Type a role (existing ones will suggest)</span>}
            </div>
            <div className="efm-field">
              <label>Joining Date</label>
              <DatePicker value={form.joiningDate} onChange={(v) => setField("joiningDate", v)} placeholder="Select joining date" />
            </div>
            <div className="efm-field">
              <label>Secondary Phone</label>
              <input type="text" maxLength={15} value={form.secondaryPhone} onChange={(e) => setField("secondaryPhone", e.target.value)} className={errors.secondaryPhone ? "err" : ""} placeholder="Optional" autoComplete="new-emp-field" />
              {errors.secondaryPhone && <span className="efm-err">{errors.secondaryPhone}</span>}
            </div>
            <div className="efm-field">
              <label>CNIC</label>
              <input type="text" maxLength={15} value={form.cnic} onChange={(e) => setField("cnic", e.target.value)} className={errors.cnic ? "err" : ""} placeholder="ID card number" autoComplete="new-emp-field" />
              {errors.cnic ? <span className="efm-err">{errors.cnic}</span> : <span className="efm-hint">13 digits (optional)</span>}
            </div>
            <div className="efm-field">
              <label>Email</label>
              <input type="email" maxLength={100} value={form.email} onChange={(e) => setField("email", e.target.value)} className={errors.email ? "err" : ""} placeholder="Optional" autoComplete="new-emp-field" />
              {errors.email && <span className="efm-err">{errors.email}</span>}
            </div>
            <div className="efm-field">
              <label>City</label>
              <input type="text" maxLength={50} value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Optional" autoComplete="new-emp-field" />
            </div>
            <div className="efm-field efm-field-full">
              <label>Address</label>
              <input type="text" maxLength={255} value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Optional" autoComplete="new-emp-field" />
            </div>
          </div>
        </div>

        <div className="efm-actions">
          <button className="efm-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="efm-save" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Add Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmployeeFormModal;
