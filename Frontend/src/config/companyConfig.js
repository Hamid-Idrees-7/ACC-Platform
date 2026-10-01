// Company settings shared by the pages: defaults, the currency list, weekly off days.

export const DEFAULT_COMPANY = {
  companyName: "Anonymous Construction & Co.",
  currencyCode: "PKR",
  currencySymbol: "Rs.",
  currencyWord: "rupees",
  invoicePrefix: "INV",
  defaultTaxPercent: 0,
};

export const DEFAULT_CALENDAR = { weeklyOffDays: ["Sunday"], holidays: [] };

// The currencies the admin can choose from (the server accepts the same codes).
export const CURRENCIES = [
  { code: "PKR", symbol: "Rs.", word: "rupees", name: "Pakistani Rupee" },
  { code: "USD", symbol: "$", word: "dollars", name: "US Dollar" },
  { code: "GBP", symbol: "£", word: "pounds", name: "British Pound" },
  { code: "EUR", symbol: "€", word: "euros", name: "Euro" },
  { code: "AED", symbol: "AED", word: "dirhams", name: "UAE Dirham" },
  { code: "SAR", symbol: "SAR", word: "riyals", name: "Saudi Riyal" },
];

// In the order JavaScript's getDay() numbers them (0 = Sunday).
export const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// "YYYY-MM-DD" in local time for a Date or a date string.
const isoOf = (date) => {
  if (!date) return "";
  if (typeof date === "string") return date.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

// Why the company is closed on a date, or null on a working day:
//   { kind: "holiday", name: "Eid ul Adha" }  or  { kind: "weekly", name: "Sunday" }
// A holiday wins when both apply.
export const offDayOf = (calendar, date) => {
  const iso = isoOf(date);
  if (!iso || !calendar) return null;
  const holiday = (calendar.holidays || []).find(
    (h) => iso >= isoOf(h.startDate) && iso <= isoOf(h.endDate)
  );
  if (holiday) return { kind: "holiday", name: holiday.name };
  const day = WEEK_DAYS[new Date(`${iso}T00:00:00`).getDay()];
  if ((calendar.weeklyOffDays || []).includes(day)) return { kind: "weekly", name: day };
  return null;
};

// Initials for a letterhead without a logo, eg "Anonymous Construction Co." gives "ACC".
export const companyInitials = (name) =>
  (name || "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 3).map((w) => w[0]).join("").toUpperCase() || "CO";
