// Shared form checks. The server runs the same rules; these give the message
// straight away, under the field that needs fixing.

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// Pakistani phone as typed: 0300-1234567 or +92 300 1234567 (11 digits once normalised).
export const isPkPhone = (v) => {
  const raw = v.trim().replace(/[\s-]/g, "");
  const normalized = raw.startsWith("+92") ? "0" + raw.slice(3) : raw;
  return /^0\d{10}$/.test(normalized);
};

// Any landline or mobile: digits with spaces, dashes, brackets and a leading +, 7 to 15 digits.
export const isPhone = (v) => {
  const digits = v.replace(/\D/g, "").length;
  return /^\+?[0-9\s()-]+$/.test(v.trim()) && digits >= 7 && digits <= 15;
};

export const isWebsite = (v) =>
  /^(https?:\/\/)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(\/\S*)?$/i.test(v.trim());

// A persons or places name: starts with a letter; letters, spaces, dots, apostrophes, dashes.
export const isName = (v) => /^\p{L}[\p{L}\s.'-]*$/u.test(v.trim());

export const hasLetter = (v) => /\p{L}/u.test(v);

// NTN: 7 digits (1234567 or 1234567-8), or a 13-digit CNIC (12345-1234567-1).
export const isNtn = (v) => /^(\d{7}(-\d)?|\d{5}-?\d{7}-?\d)$/.test(v.trim());

// STRN: 13 digits, dashes and spaces allowed (17-00-3764-523-19).
export const isStrn = (v) => /^[0-9\s-]+$/.test(v.trim()) && v.replace(/\D/g, "").length === 13;

// IBAN with the ISO 13616 mod-97 check. Pakistani IBANs are 24 characters.
export const isIban = (value) => {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("PK") && iban.length !== 24) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of moved) {
    const part = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of part) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
};

// Brings the first field with a problem into view and puts the cursor in it.
export const focusField = (id) => {
  const el = typeof document !== "undefined" && document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => el.focus({ preventScroll: true }), 250);
};
