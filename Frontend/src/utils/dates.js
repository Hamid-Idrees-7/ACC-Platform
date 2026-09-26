// Date and time helpers used across the dashboard.
// The style follows the user's choice in Settings > Appearance:
//   dmy-text     26 September 2026  (short: 26 Sep 2026)
//   dmy-numeric  26/09/2026
//   mdy-text     September 26, 2026 (short: Sep 26, 2026)
//   iso          2026-09-26
// and 12-hour (2:20 PM) or 24-hour (14:20) time.
// The PreferencesContext calls setDatePrefs() when the user's choice is known.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let dateStyle = "dmy-text";
let hour12 = true;

export const setDatePrefs = ({ dateFormat, timeFormat } = {}) => {
  dateStyle = ["dmy-text", "dmy-numeric", "mdy-text", "iso"].includes(dateFormat) ? dateFormat : "dmy-text";
  hour12 = timeFormat !== "24h";
};

const pad = (n) => String(n).padStart(2, "0");

const toDate = (value) => {
  if (!value && value !== 0) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d) ? null : d;
};

const render = (d, monthNames) => {
  const day = d.getDate(), m = d.getMonth(), y = d.getFullYear();
  switch (dateStyle) {
    case "dmy-numeric": return `${pad(day)}/${pad(m + 1)}/${y}`;
    case "mdy-text": return `${monthNames[m]} ${day}, ${y}`;
    case "iso": return `${y}-${pad(m + 1)}-${pad(day)}`;
    default: return `${day} ${monthNames[m]} ${y}`;
  }
};

// Full date, eg "26 September 2026". Returns fallback for empty or invalid values.
export const formatDate = (value, fallback = "") => {
  const d = toDate(value);
  return d ? render(d, MONTHS) : fallback;
};

// Compact date for lists and tables, e.g. "26 Sep 2026".
export const formatDateShort = (value, fallback = "") => {
  const d = toDate(value);
  return d ? render(d, SHORT) : fallback;
};

// Day and month only, eg "26 Sep" (or "Sep 26", "26/09", "09-26").
export const formatDayMonth = (value, fallback = "") => {
  const d = toDate(value);
  if (!d) return fallback;
  const day = d.getDate(), m = d.getMonth();
  switch (dateStyle) {
    case "dmy-numeric": return `${pad(day)}/${pad(m + 1)}`;
    case "mdy-text": return `${SHORT[m]} ${day}`;
    case "iso": return `${pad(m + 1)}-${pad(day)}`;
    default: return `${day} ${SHORT[m]}`;
  }
};

// Time of day, eg "2:20 PM" or "14:20".
export const formatTime = (value, fallback = "") => {
  const d = toDate(value);
  if (!d) return fallback;
  const h = d.getHours(), mm = pad(d.getMinutes());
  if (!hour12) return `${pad(h)}:${mm}`;
  return `${h % 12 || 12}:${mm} ${h >= 12 ? "PM" : "AM"}`;
};

// Date and time, eg "26 Sep 2026, 2:20 PM".
export const formatDateTime = (value, fallback = "") => {
  const d = toDate(value);
  return d ? `${render(d, SHORT)}, ${formatTime(d)}` : fallback;
};

// Month and year for period pickers, e.g. "September 2026".
export const formatMonthYear = (year, monthIndex) => `${MONTHS[monthIndex]} ${year}`;

// Today as YYYY-MM-DD in local time (what the date inputs use).
export const todayISO = () => {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
};
