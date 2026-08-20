// Number and currency helpers (Pakistani formatting).

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

// Full rupee amount with Pakistani digit grouping, e.g. "Rs. 20,42,093".
export const rupeesPK = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// Short rupee amount for large totals, e.g. "Rs. 3.83 Cr" / "Rs. 76.5 Lac".
export const rupeesShort = (n) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 10000000) return `Rs. ${(v / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `Rs. ${(v / 100000).toFixed(1)} Lac`;
  return `Rs. ${formatNum(Math.round(v))}`;
};

// Amount spelled out, e.g "20 lac 42 thousand 93 rupees"
export const amountInWords = (n) => {
  const value = Math.round(Number(n) || 0);
  let v = Math.abs(value);
  if (v === 0) return "zero rupees";

  const parts = [];
  const crore = Math.floor(v / 10000000); v %= 10000000;
  const lac = Math.floor(v / 100000); v %= 100000;
  const thousand = Math.floor(v / 1000); v %= 1000;
  const hundred = Math.floor(v / 100); v %= 100;

  if (crore) parts.push(`${crore} crore`);
  if (lac) parts.push(`${lac} lac`);
  if (thousand) parts.push(`${thousand} thousand`);
  if (hundred) parts.push(`${hundred} hundred`);
  if (v) parts.push(`${v}`);

  return `${value < 0 ? "minus " : ""}${parts.join(" ")} rupees`;
};
