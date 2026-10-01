// Number and money helpers.
// Two number systems, chosen per user in Settings > Appearance:
//   pk   = Pakistani: Lac / Crore (Rs. 3.83 Cr, "20 lac 42 thousand rupees")
//   intl = International: Thousand / Million / Billion (Rs. 38.3M, "2 million 42 thousand rupees")
// The currency (Rs., $, £ ...) is the company's, set by the admin in Settings > Company.
// Amounts are only labelled with it, never converted.
// PreferencesContext calls setNumberSystem() and CompanyContext calls setCurrency().

let system = "pk";
let currency = { symbol: "Rs.", word: "rupees" };

export const setNumberSystem = (value) => {
  system = value === "intl" ? "intl" : "pk";
};

export const getNumberSystem = () => system;

export const setCurrency = ({ symbol, word } = {}) => {
  currency = { symbol: symbol || "Rs.", word: word || "rupees" };
};

// The symbol on its own, for form labels, eg "Amount (Rs.)".
export const currencySymbol = () => currency.symbol;

// Puts the symbol in front: "Rs. 500" and "AED 500" (word-like symbols get a space),
// "$500" and "-$500" for signs.
const withSymbol = (text) => {
  const { symbol } = currency;
  if (/^[A-Za-z]/.test(symbol)) return `${symbol} ${text}`;
  return text.startsWith("-") ? `-${symbol}${text.slice(1)}` : `${symbol}${text}`;
};

export const formatNum = (n) => (Number(n) || 0).toLocaleString("en-US");

// Quantities trim trailing zeros (30, 2.5) and stay readable.
export const formatQty = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

// Full amount, eg "Rs. 255,000"
export const money = (n) => withSymbol(formatNum(Math.round(Number(n) || 0)));

// Full amount with the digit grouping of the chosen system:
// Pakistani "Rs. 20,42,093", International "Rs. 2,042,093".
export const moneyGrouped = (n) =>
  withSymbol(Math.round(Number(n) || 0).toLocaleString(system === "intl" ? "en-US" : "en-IN"));

// Short amount for large totals.
// Pakistani "Rs. 3.83 Cr" / "Rs. 76.5 Lac", International "Rs. 38.30M" / "Rs. 765K".
export const moneyShort = (n) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (system === "intl") {
    if (abs >= 1e9) return withSymbol(`${(v / 1e9).toFixed(2)}B`);
    if (abs >= 1e6) return withSymbol(`${(v / 1e6).toFixed(2)}M`);
    if (abs >= 1e5) return withSymbol(`${Math.round(v / 1e3)}K`);
    return withSymbol(formatNum(Math.round(v)));
  }
  if (abs >= 10000000) return withSymbol(`${(v / 10000000).toFixed(2)} Cr`);
  if (abs >= 100000) return withSymbol(`${(v / 100000).toFixed(1)} Lac`);
  return withSymbol(formatNum(Math.round(v)));
};

// Very compact amount for small tags (wages), eg "Rs. 2.5K", "Rs. 1.20 Lac" / "Rs. 120K".
export const moneyCompact = (n) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (system === "intl") {
    if (abs >= 1e9) return withSymbol(`${(v / 1e9).toFixed(2)}B`);
    if (abs >= 1e6) return withSymbol(`${(v / 1e6).toFixed(2)}M`);
    if (abs >= 1000) return withSymbol(`${(v / 1000).toFixed(1)}K`);
    return withSymbol(`${Math.round(v)}`);
  }
  if (abs >= 10000000) return withSymbol(`${(v / 10000000).toFixed(2)} Cr`);
  if (abs >= 100000) return withSymbol(`${(v / 100000).toFixed(2)} Lac`);
  if (abs >= 1000) return withSymbol(`${(v / 1000).toFixed(1)}K`);
  return withSymbol(`${Math.round(v)}`);
};

// A whole number spelled out in the chosen system, eg "20 lac 42 thousand 93"
// or "2 million 42 thousand 93" (used for quantities too).
export const numberInWords = (n) => {
  const value = Math.round(Number(n) || 0);
  let v = Math.abs(value);
  if (v === 0) return "zero";

  const parts = [];
  const units = system === "intl"
    ? [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"], [100, "hundred"]]
    : [[1e7, "crore"], [1e5, "lac"], [1e3, "thousand"], [100, "hundred"]];

  for (const [size, name] of units) {
    const count = Math.floor(v / size);
    if (count) parts.push(`${count} ${name}`);
    v %= size;
  }
  if (v) parts.push(`${v}`);

  return `${value < 0 ? "minus " : ""}${parts.join(" ")}`;
};

// Amount spelled out with the company currency, eg "20 lac 42 thousand 93 rupees".
export const amountInWords = (n) => `${numberInWords(n)} ${currency.word}`;

// CNIC shown as 35202-1234567-1. Anything that isn't 13 digits is shown as saved.
export const formatCnic = (value) => {
  if (!value) return value;
  const d = String(value).replace(/\D/g, "");
  return d.length === 13 ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}` : value;
};

// Mobile numbers shown as 0300-1234567 (or +92 300 1234567). Landlines stay as saved.
export const formatPhone = (value) => {
  if (!value) return value;
  const raw = String(value).trim();
  const d = raw.replace(/\D/g, "");
  if (/^03\d{9}$/.test(d) && !raw.startsWith("+")) return `${d.slice(0, 4)}-${d.slice(4)}`;
  if (/^923\d{9}$/.test(d)) return `+92 ${d.slice(2, 5)} ${d.slice(5)}`;
  return raw;
};

// Formatting while typing: dashes go in as the digits are entered.
export const typeCnic = (value) => {
  const d = value.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
};

// Only a mobile number starting with 03 gets the dash. +92 and landlines are left alone.
export const typePhone = (value) => {
  if (!/^03[\d\s-]*$/.test(value)) return value;
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4)}`;
};

// onChange helper for the two above. Keeps the cursor after the same digit,
// so editing in the middle of the number doesn't throw it to the end.
export const typed = (event, format) => {
  const input = event.target;
  const raw = input.value;
  const next = format(raw);
  const caret = input.selectionStart;
  if (next !== raw && caret != null && caret < raw.length) {
    const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;
    let pos = 0;
    for (let seen = 0; pos < next.length && seen < digitsBefore; pos++) {
      if (/\d/.test(next[pos])) seen++;
    }
    requestAnimationFrame(() => input.setSelectionRange(pos, pos));
  }
  return next;
};

// Search that also finds numbers typed with or without dashes and spaces,
// and +92 numbers when searched with a leading 0.
const localDigits = (text) => {
  const t = String(text || "").trim();
  const d = t.replace(/\D/g, "");
  return t.startsWith("+92") || (d.length === 12 && d.startsWith("92")) ? `0${d.slice(2)}` : d;
};

export const digitsMatch = (value, query) => {
  const q = localDigits(query);
  return q.length >= 3 && localDigits(value).includes(q);
};
