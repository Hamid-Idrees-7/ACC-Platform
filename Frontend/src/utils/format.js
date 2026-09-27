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
