import { useState, useEffect, useMemo, useRef } from "react";
import { companyService } from "../services/companyService";
import { useCompany } from "../context/CompanyContext";
import { CURRENCIES } from "../config/companyConfig";
import { formatDateTime } from "../utils/dates";
import { isEmail, isPhone, isWebsite, isName, hasLetter, isNtn, isStrn, isIban, focusField } from "../utils/validation";
import Toast, { useToast } from "./Toast";
import "./CompanySettings.css";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { SkeletonRows } from "./Skeleton";

// Settings > Company (Admin only): company profile, tax numbers, currency, invoice
// defaults and bank details. One form, saved together. Problems show under each field.

const EMPTY = {
  companyName: "", tagline: "", logo: null, address: "", city: "", phone: "", email: "", website: "",
  ntn: "", strn: "",
  currencyCode: "PKR",
  invoicePrefix: "INV", defaultTaxPercent: 0, invoiceTerms: "",
  bankName: "", bankAccountTitle: "", bankAccountNumber: "", bankIBAN: "",
};

// Form order, so the page can jump to the first field with a problem.
const FIELD_ORDER = [
  "logo", "companyName", "tagline", "address", "city", "phone", "email", "website", "ntn", "strn",
  "currencyCode", "invoicePrefix", "defaultTaxPercent", "invoiceTerms",
  "bankName", "bankAccountTitle", "bankAccountNumber", "bankIBAN",
];

const TERMS_MAX = 500;
const LOGO_BOX = { w: 480, h: 240 };        // largest stored logo size (px)
const LOGO_MAX_CHARS = 580_000;             // the server accepts up to 600,000
const LOGO_MAX_FILE = 5 * 1024 * 1024;      // 5 MB before resizing

// Server copy to form values (nulls become empty strings so inputs stay controlled).
const toForm = (s) => {
  const f = { ...EMPTY };
  Object.keys(EMPTY).forEach((k) => {
    if (s[k] !== undefined && s[k] !== null) f[k] = s[k];
  });
  f.logo = s.logo || null;
  return f;
};

// Form values in the shape the server expects.
const toPayload = (f) => ({
  ...f,
  invoicePrefix: f.invoicePrefix.trim().toUpperCase(),
  defaultTaxPercent: f.defaultTaxPercent === "" ? 0 : Number(f.defaultTaxPercent),
  bankIBAN: f.bankIBAN.replace(/\s+/g, "").toUpperCase(),
  logo: f.logo || null,
});

// Every rule the server checks, so mistakes show before saving. Returns { field: message }.
const validate = (f) => {
  const e = {};
  const t = (k) => (f[k] || "").trim();

  if (t("companyName").length < 2) e.companyName = "Enter the company name.";
  else if (!hasLetter(t("companyName"))) e.companyName = "The company name must contain letters.";

  if (t("city") && !isName(t("city"))) e.city = "Enter a valid city name (letters only).";
  if (t("phone") && !isPhone(t("phone"))) e.phone = "Enter a valid phone number, eg 051-1234567 or +92 300 1234567.";
  if (t("email") && !isEmail(t("email"))) e.email = "Enter a valid email address, eg info@company.com.";
  if (t("website") && !isWebsite(t("website"))) e.website = "Enter a valid website, eg www.company.com.";
  if (t("ntn") && !isNtn(t("ntn"))) e.ntn = "Enter a valid NTN: 7 digits (1234567 or 1234567-8), or a 13-digit CNIC.";
  if (t("strn") && !isStrn(t("strn"))) e.strn = "Enter a valid STRN: 13 digits, eg 17-00-3764-523-19.";

  const prefix = t("invoicePrefix").toUpperCase();
  if (!prefix) e.invoicePrefix = "Enter the invoice number prefix, eg INV.";
  else if (!/^[A-Z][A-Z0-9-]{0,9}$/.test(prefix) || prefix.endsWith("-") || prefix.includes("--"))
    e.invoicePrefix = "Use 1 to 10 letters, digits or single dashes, starting with a letter, eg INV.";

  const tax = String(f.defaultTaxPercent).trim();
  if (tax !== "") {
    const n = Number(tax);
    if (Number.isNaN(n) || n < 0 || n > 100) e.defaultTaxPercent = "The default tax must be between 0% and 100%.";
    else if (!/^\d+(\.\d{1,2})?$/.test(tax)) e.defaultTaxPercent = "Use at most 2 decimal places, eg 16 or 17.5.";
  }
  if (t("invoiceTerms").length > TERMS_MAX) e.invoiceTerms = `The invoice terms can be at most ${TERMS_MAX} characters.`;

  // Bank details: all or nothing, so an invoice never shows half of them.
  const anyBank = ["bankName", "bankAccountTitle", "bankAccountNumber", "bankIBAN"].some((k) => t(k));
  if (anyBank) {
    if (!t("bankName")) e.bankName = "Enter the bank name, or clear all the bank details.";
    else if (!hasLetter(t("bankName"))) e.bankName = "Enter a valid bank name.";
    if (!t("bankAccountTitle")) e.bankAccountTitle = "Enter the account title (the name on the account).";
    else if (!hasLetter(t("bankAccountTitle"))) e.bankAccountTitle = "Enter a valid account title.";
    if (!t("bankAccountNumber") && !t("bankIBAN")) e.bankAccountNumber = "Enter the account number or the IBAN.";
  }
  if (t("bankAccountNumber")) {
    const digits = t("bankAccountNumber").replace(/\D/g, "").length;
    if (!/^[0-9\s-]+$/.test(t("bankAccountNumber")) || digits < 6 || digits > 24)
      e.bankAccountNumber = "Enter a valid account number (6 to 24 digits, spaces and dashes allowed).";
  }
  if (t("bankIBAN") && !isIban(t("bankIBAN")))
    e.bankIBAN = "Enter a valid IBAN, eg PK36SCBL0000001123456702 (24 characters for Pakistan).";

  return e;
};

// Resize a picked image so it fits the logo box, keeping transparency (PNG).
const readLogo = (file) =>
  new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      reject(new Error("Choose a PNG, JPG, WebP or SVG image."));
      return;
    }
    if (file.size > LOGO_MAX_FILE) {
      reject(new Error("The image is larger than 5 MB. Choose a smaller file."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("The image could not be read."));
      img.onload = () => {
        const w = img.naturalWidth || LOGO_BOX.w;
        const h = img.naturalHeight || LOGO_BOX.h;
        const scale = Math.min(1, LOGO_BOX.w / w, LOGO_BOX.h / h);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        let url = canvas.toDataURL("image/png");
        if (url.length > LOGO_MAX_CHARS) url = canvas.toDataURL("image/webp", 0.9);
        if (url.length > LOGO_MAX_CHARS) url = canvas.toDataURL("image/jpeg", 0.85);
        if (url.length > LOGO_MAX_CHARS) {
          reject(new Error("The logo is too detailed to store. Try a simpler or smaller image."));
          return;
        }
        resolve(url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

const initialsOf = (name) =>
  (name || "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 3).map((w) => w[0]).join("").toUpperCase() || "CO";

// A small money example in the chosen currency, eg "Rs. 1,250" or "$1,250".
const currencyExample = (c) => (/^[A-Za-z]/.test(c.symbol) ? `${c.symbol} 1,250` : `${c.symbol}1,250`);

function CompanySettings({ onDirtyChange }) {
  const { applySaved } = useCompany();

  const [saved, setSaved] = useState(null);      // last server copy
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, showToast] = useToast(3500);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await companyService.get();
        setSaved(data);
        setForm(toForm(data));
      } catch {
        setLoadError("Could not load the company settings. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dirty = useMemo(
    () => !!saved && JSON.stringify(toPayload(form)) !== JSON.stringify(toPayload(toForm(saved))),
    [form, saved]
  );

  // Let the Settings page know, so it can warn before switching tabs.
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  // Warn before leaving the page, closing or reloading the tab with unsaved changes.
  useUnsavedChanges(dirty);

  // Editing a field clears its message.
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  // The number the next invoice will get with the prefix being edited.
  const nextNumber = useMemo(() => {
    const seq = (saved?.nextInvoiceNumber || "").match(/(\d+)$/)?.[1] || "0001";
    return `${form.invoicePrefix.trim().toUpperCase() || "INV"}-${seq}`;
  }, [form.invoicePrefix, saved]);

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      set("logo", await readLogo(file));
    } catch (err) {
      setErrors((x) => ({ ...x, logo: err.message }));
    }
  };

  const discard = () => {
    setForm(toForm(saved));
    setErrors({});
  };

  // Shows the problems and takes the admin to the first one.
  const showErrors = (errs) => {
    setErrors(errs);
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (first) focusField(`cps-${first}`);
    const count = Object.values(errs).filter(Boolean).length;
    showToast(count > 1 ? `Please fix the ${count} highlighted fields.` : "Please fix the highlighted field.", "error");
  };

  const save = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length) return showErrors(errs);

    setSaving(true);
    try {
      const result = await companyService.save(toPayload(form));
      setSaved(result);
      setForm(toForm(result));
      setErrors({});
      applySaved(result);
      showToast("Company settings saved.");
    } catch (err) {
      const data = err?.response?.data;
      if (data?.field) showErrors({ [data.field]: data.message });
      else showToast(data?.message || "Could not save the company settings. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonRows count={4} />;
  if (loadError) return <div className="st-msg st-msg-error">{loadError}</div>;

  const termsLen = form.invoiceTerms.length;

  // One text field with its label, hint and message.
  const field = (key, label, props = {}, { hint, full, required } = {}) => (
    <div className={`st-field ${full ? "st-field-full" : ""} ${errors[key] ? "has-err" : ""}`}>
      <label htmlFor={`cps-${key}`}>{label}{required && <span className="req"> *</span>}</label>
      <input
        id={`cps-${key}`}
        type="text"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `cps-${key}-err` : undefined}
        {...props}
      />
      {errors[key]
        ? <span className="st-err" id={`cps-${key}-err`}>{errors[key]}</span>
        : hint && <span className="st-hint">{hint}</span>}
    </div>
  );

  return (
    <div className="cps">
      {saved?.isDefault && (
        <div className="cps-note">
          These are the starting values. Check them and press <strong>Save changes</strong> once, so invoices and payslips carry your real company details.
        </div>
      )}

      {/* Company profile */}
      <section className="cps-section">
        <div className="cps-sec-head">
          <h4>Company profile</h4>
          <p>Printed at the top of every invoice and payslip.</p>
        </div>

        <div className="cps-logo-row">
          <div className={`cps-logo ${form.logo ? "has-img" : ""}`}>
            {form.logo ? <img src={form.logo} alt="Company logo" /> : <span>{initialsOf(form.companyName)}</span>}
          </div>
          <div className="cps-logo-side">
            <div className="cps-logo-actions">
              <button type="button" id="cps-logo" className="st-photo-btn" onClick={() => fileRef.current?.click()}>
                {form.logo ? "Change logo" : "Upload logo"}
              </button>
              {form.logo && <button type="button" className="st-photo-remove" onClick={() => set("logo", null)}>Remove</button>}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={pickLogo} hidden />
            </div>
            {errors.logo
              ? <span className="st-err">{errors.logo}</span>
              : <span className="st-hint">PNG, JPG, WebP or SVG, up to 5 MB. A wide logo with a transparent background looks best. Without a logo, the initials are used.</span>}
          </div>
        </div>

        <div className="st-form-grid">
          {field("companyName", "Company name", { maxLength: 100 }, { required: true })}
          {field("tagline", "Tagline", { maxLength: 100, placeholder: "eg Builders & Developers" })}
          {field("address", "Address", { maxLength: 200, placeholder: "Office address" }, { full: true })}
          {field("city", "City", { maxLength: 60 })}
          {field("phone", "Phone", { type: "tel", maxLength: 30, placeholder: "eg 051-1234567" })}
          {field("email", "Email", { type: "email", maxLength: 100, placeholder: "eg info@company.com" })}
          {field("website", "Website", { maxLength: 100, placeholder: "eg www.company.com" })}
        </div>
      </section>

      {/* Tax registration */}
      <section className="cps-section">
        <div className="cps-sec-head">
          <h4>Tax registration</h4>
          <p>Shown on invoices when filled in. With an STRN, invoices are titled "Sales Tax Invoice".</p>
        </div>
        <div className="st-form-grid">
          {field("ntn", "NTN", { maxLength: 15, placeholder: "eg 1234567-8" }, { hint: "National Tax Number: 7 digits, or a 13-digit CNIC." })}
          {field("strn", "STRN", { maxLength: 20, placeholder: "eg 17-00-3764-523-19" }, { hint: "Sales Tax Registration Number: 13 digits." })}
        </div>
      </section>

      {/* Currency */}
      <section className="cps-section">
        <div className="cps-sec-head">
          <h4>Currency</h4>
          <p>The symbol and the word used for every amount in the system. Amounts are not converted.</p>
        </div>
        <div className="cps-cur-grid" role="radiogroup" aria-label="Currency" id="cps-currencyCode">
          {CURRENCIES.map((c) => {
            const active = form.currencyCode === c.code;
            return (
              <button
                key={c.code}
                type="button"
                role="radio"
                aria-checked={active}
                className={`cps-cur ${active ? "active" : ""}`}
                onClick={() => set("currencyCode", c.code)}
              >
                <span className="cps-cur-sym">{c.symbol}</span>
                <span className="cps-cur-text">
                  <strong>{c.name}</strong>
                  <span>{c.code} · {currencyExample(c)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {errors.currencyCode && <span className="st-err">{errors.currencyCode}</span>}
        {saved && form.currencyCode !== saved.currencyCode && (
          <div className="cps-warn">
            Changing the currency only changes how amounts are labelled. Existing figures keep their values, so only switch if your records are kept in the new currency.
          </div>
        )}
      </section>

      {/* Invoices */}
      <section className="cps-section">
        <div className="cps-sec-head">
          <h4>Invoices</h4>
          <p>Numbering, the suggested tax on new invoices, and the note printed at the bottom.</p>
        </div>
        <div className="st-form-grid">
          <div className={`st-field ${errors.invoicePrefix ? "has-err" : ""}`}>
            <label htmlFor="cps-invoicePrefix">Invoice number prefix <span className="req">*</span></label>
            <input
              id="cps-invoicePrefix"
              type="text"
              maxLength={10}
              value={form.invoicePrefix}
              onChange={(e) => set("invoicePrefix", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
              aria-invalid={!!errors.invoicePrefix}
            />
            {errors.invoicePrefix
              ? <span className="st-err">{errors.invoicePrefix}</span>
              : <span className="st-hint">Next invoice: <strong className="cps-next">{nextNumber}</strong>. Numbering carries on from the last invoice.</span>}
          </div>
          <div className={`st-field ${errors.defaultTaxPercent ? "has-err" : ""}`}>
            <label htmlFor="cps-defaultTaxPercent">Default tax (%)</label>
            <input
              id="cps-defaultTaxPercent"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.01"
              value={form.defaultTaxPercent}
              onChange={(e) => set("defaultTaxPercent", e.target.value)}
              aria-invalid={!!errors.defaultTaxPercent}
            />
            {errors.defaultTaxPercent
              ? <span className="st-err">{errors.defaultTaxPercent}</span>
              : <span className="st-hint">Suggested tax on a new invoice, worked out from its work lines. 0 for none.</span>}
          </div>
          <div className={`st-field st-field-full ${errors.invoiceTerms ? "has-err" : ""}`}>
            <div className="st-label-row">
              <label htmlFor="cps-invoiceTerms">Terms / note on invoices</label>
              <span className={`st-counter ${termsLen > TERMS_MAX - 30 ? "warn" : ""}`}>{termsLen}/{TERMS_MAX}</span>
            </div>
            <textarea
              id="cps-invoiceTerms"
              rows={3}
              maxLength={TERMS_MAX}
              placeholder="eg Payment is due within 30 days. Cheques in the name of the company."
              value={form.invoiceTerms}
              onChange={(e) => set("invoiceTerms", e.target.value)}
            />
            {errors.invoiceTerms && <span className="st-err">{errors.invoiceTerms}</span>}
          </div>
        </div>
      </section>

      {/* Bank */}
      <section className="cps-section">
        <div className="cps-sec-head">
          <h4>Bank details</h4>
          <p>Printed on invoices so clients know where to pay. Fill in all of them, or leave them all empty to hide.</p>
        </div>
        <div className="st-form-grid">
          {field("bankName", "Bank name", { maxLength: 100, placeholder: "eg Meezan Bank" })}
          {field("bankAccountTitle", "Account title", { maxLength: 100, placeholder: "The name on the account" })}
          {field("bankAccountNumber", "Account number", { maxLength: 40, inputMode: "numeric" })}
          {field("bankIBAN", "IBAN", {
            maxLength: 40,
            placeholder: "eg PK36ABCD0000000123456789",
            onChange: (e) => set("bankIBAN", e.target.value.toUpperCase()),
          }, { hint: "Pakistani IBANs: 24 characters." })}
        </div>
      </section>

      {saved?.updatedAt && (
        <p className="cps-updated">
          Last saved {formatDateTime(saved.updatedAt)}{saved.updatedBy ? ` by ${saved.updatedBy}` : ""}.
        </p>
      )}

      {/* Save bar: stays at the bottom of the screen while there are changes */}
      <div className={`cps-bar ${dirty ? "show" : ""}`}>
        <span>{dirty ? "You have unsaved changes." : "All changes saved."}</span>
        <div className="cps-bar-actions">
          <button type="button" className="cps-btn-ghost" onClick={discard} disabled={!dirty || saving}>Discard</button>
          <button type="button" className="st-btn-save" onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      <Toast toast={toast} raised />
    </div>
  );
}

export default CompanySettings;
