import { useState, useEffect } from "react";
import "./UserFormModal.css";

// Validation helpers
const isValidPhone = (phone) => {
  const raw = phone.trim().replace(/[\s-]/g, "");
  const normalized = raw.startsWith("+92") ? "0" + raw.slice(3) : raw;
  return /^0\d{10}$/.test(normalized);
};
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const emptyForm = {
  fullName: "", username: "", password: "", email: "",
  role: "", phone: "", secondaryPhone: "",
};

function UserFormModal({ mode, initialData, existingRoles = [], onClose, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setForm({
        fullName: initialData.fullName || "",
        username: initialData.username || "",
        password: "",
        email: initialData.email || "",
        role: initialData.role || "",
        phone: initialData.phone || "",
        secondaryPhone: initialData.secondaryPhone || "",
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

    if (!form.username.trim()) e.username = "Username is required.";
    else if (form.username.trim().length < 3) e.username = "Username must be at least 3 characters.";
    else if (/\s/.test(form.username.trim())) e.username = "Username cannot contain spaces.";

    // Password: required on create, optional on edit
    if (mode !== "edit") {
      if (!form.password) e.password = "Password is required.";
      else if (form.password.length < 5) e.password = "Password must be at least 5 characters.";
    } else if (form.password && form.password.length < 5) {
      e.password = "Password must be at least 5 characters.";
    }

    if (!form.email.trim()) e.email = "Email is required.";
    else if (!isValidEmail(form.email)) e.email = "Enter a valid email address.";

    if (!form.role.trim()) e.role = "Role is required.";

    if (form.phone.trim() && !isValidPhone(form.phone))
      e.phone = "Enter 11 digits, starting with 0 or +92.";

    if (form.secondaryPhone.trim() && !isValidPhone(form.secondaryPhone))
      e.secondaryPhone = "Enter a valid phone (0 or +92, 11 digits).";

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
        username: form.username.trim(),
        password: form.password || null,
        email: form.email.trim(),
        role: form.role.trim(),
        phone: form.phone.trim() || null,
        secondaryPhone: form.secondaryPhone.trim() || null,
        isActive: initialData?.isActive ?? true,
      });
    } catch (err) {
      setServerError(err.response?.data?.message || "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="ufm-overlay" onClick={(e) => e.target.classList.contains("ufm-overlay") && onClose()}>
      <div className="ufm-modal">
        <div className="ufm-head">
          <div>
            <h3>{mode === "edit" ? "Edit User" : "Add New User"}</h3>
            <p>{mode === "edit" ? "Update this user's account details" : "Create a login account for a staff member"}</p>
          </div>
          <button className="ufm-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {serverError && <div className="ufm-server-error">{serverError}</div>}

        <div className="ufm-body">
          {/* Hidden fields to absorb browser autofill */}
          <input type="text" style={{ display: "none" }} autoComplete="username" />
          <input type="password" style={{ display: "none" }} autoComplete="new-password" />

          <div className="ufm-grid">
            <div className="ufm-field">
              <label>Full Name <span className="req">*</span></label>
              <input type="text" maxLength={100} value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} className={errors.fullName ? "err" : ""} placeholder="User full name" autoComplete="new-user-field" />
              {errors.fullName && <span className="ufm-err">{errors.fullName}</span>}
            </div>
            <div className="ufm-field">
              <label>Role <span className="req">*</span></label>
              <input type="text" maxLength={50} value={form.role} onChange={(e) => setField("role", e.target.value)} className={errors.role ? "err" : ""} placeholder="e.g. Manager, Accountant" autoComplete="off" list="role-list" />
              <datalist id="role-list">
                {existingRoles.map((r) => <option key={r} value={r} />)}
              </datalist>
              {errors.role ? <span className="ufm-err">{errors.role}</span> : <span className="ufm-hint">Type a role (existing ones will suggest)</span>}
            </div>
            <div className="ufm-field">
              <label>Username <span className="req">*</span></label>
              <input type="text" maxLength={50} value={form.username} onChange={(e) => setField("username", e.target.value)} className={errors.username ? "err" : ""} placeholder="Login username" autoComplete="new-user-field" />
              {errors.username ? <span className="ufm-err">{errors.username}</span> : <span className="ufm-hint">Used to log in (no spaces)</span>}
            </div>
            <div className="ufm-field">
              <label>Password {mode !== "edit" && <span className="req">*</span>}</label>
              <div className="ufm-password-wrap">
                <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setField("password", e.target.value)} className={errors.password ? "err" : ""} placeholder={mode === "edit" ? "Leave blank to keep current" : "Set a password"} autoComplete="new-password" />
                <button type="button" className="ufm-eye" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
              {errors.password ? <span className="ufm-err">{errors.password}</span> : <span className="ufm-hint">{mode === "edit" ? "Only fill to change it" : "At least 5 characters"}</span>}
            </div>
            <div className="ufm-field">
              <label>Email <span className="req">*</span></label>
              <input type="email" maxLength={100} value={form.email} onChange={(e) => setField("email", e.target.value)} className={errors.email ? "err" : ""} placeholder="name@company.com" autoComplete="new-user-field" />
              {errors.email && <span className="ufm-err">{errors.email}</span>}
            </div>
            <div className="ufm-field">
              <label>Phone</label>
              <input type="text" maxLength={15} value={form.phone} onChange={(e) => setField("phone", e.target.value)} className={errors.phone ? "err" : ""} placeholder="Optional" autoComplete="new-user-field" />
              {errors.phone ? <span className="ufm-err">{errors.phone}</span> : <span className="ufm-hint">11 digits (optional)</span>}
            </div>
            <div className="ufm-field ufm-field-full">
              <label>Secondary Phone</label>
              <input type="text" maxLength={15} value={form.secondaryPhone} onChange={(e) => setField("secondaryPhone", e.target.value)} className={errors.secondaryPhone ? "err" : ""} placeholder="Optional" autoComplete="new-user-field" />
              {errors.secondaryPhone && <span className="ufm-err">{errors.secondaryPhone}</span>}
            </div>
          </div>
        </div>

        <div className="ufm-actions">
          <button className="ufm-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="ufm-save" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Add User"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserFormModal;
