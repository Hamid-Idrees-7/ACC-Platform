// Number and currency helpers.
// Two number systems, chosen per user in Settings > Appearance:
//   pk   = Pakistani: Lac / Crore (Rs. 3.83 Cr, "20 lac 42 thousand rupees")
//   intl = International: Thousand / Million / Billion (Rs. 38.3M, "2 million 42 thousand rupees")
// The PreferencesContext calls setNumberSystem() when the user's choice is known.

let system = "pk";

export const setNumberSystem = (value) => {
  system = value === "intl" ? "intl" : "pk";
};

export const getNumberSystem = () => system;

export const formatNum = (n) => (Number(n) || 0).toLocaleString("en-US");

// Quantities trim trailing zeros (30, 2.5) and stay readable.
export const formatQty = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

// Full rupee amount, e.g "Rs. 255,000"
export const rupees = (n) => `Rs. ${formatNum(Math.round(Number(n) || 0))}`;

// Full rupee amount with the digit grouping of the chosen system:
// Pakistani "Rs. 20,42,093", International "Rs. 2,042,093".
export const rupeesPK = (n) =>
  `Rs. ${Math.round(Number(n) || 0).toLocaleString(system === "intl" ? "en-US" : "en-IN")}`;

// Short rupee amount for large totals.
// Pakistani "Rs. 3.83 Cr" / "Rs. 76.5 Lac", International "Rs. 38.30M" / "Rs. 765K".
export const rupeesShort = (n) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (system === "intl") {
    if (abs >= 1e9) return `Rs. ${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `Rs. ${(v / 1e6).toFixed(2)}M`;
    if (abs >= 1e5) return `Rs. ${Math.round(v / 1e3)}K`;
    return `Rs. ${formatNum(Math.round(v))}`;
  }
  if (abs >= 10000000) return `Rs. ${(v / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `Rs. ${(v / 100000).toFixed(1)} Lac`;
  return `Rs. ${formatNum(Math.round(v))}`;
};

// Very compact amount for small tags (wages), e.g. "Rs. 2.5K", "Rs. 1.20 Lac" / "Rs. 120K".
export const rupeesCompact = (n) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (system === "intl") {
    if (abs >= 1e9) return `Rs. ${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `Rs. ${(v / 1e6).toFixed(2)}M`;
    if (abs >= 1000) return `Rs. ${(v / 1000).toFixed(1)}K`;
    return `Rs. ${Math.round(v)}`;
  }
  if (abs >= 10000000) return `Rs. ${(v / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `Rs. ${(v / 100000).toFixed(2)} Lac`;
  if (abs >= 1000) return `Rs. ${(v / 1000).toFixed(1)}K`;
  return `Rs. ${Math.round(v)}`;
};

// Amount spelled out, e.g "20 lac 42 thousand 93 rupees" or "2 million 42 thousand 93 rupees".
export const amountInWords = (n) => {
  const value = Math.round(Number(n) || 0);
  let v = Math.abs(value);
  if (v === 0) return "zero rupees";

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

  return `${value < 0 ? "minus " : ""}${parts.join(" ")} rupees`;
};
