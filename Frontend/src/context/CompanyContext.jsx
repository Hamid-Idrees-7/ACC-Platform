import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { companyService } from "../services/companyService";
import { calendarService } from "../services/calendarService";
import { setCurrency } from "../utils/format";

// Settings > Company and Settings > Calendar: the company's name, currency, default tax,
// weekly off days and holidays, read by every signed-in page.
// Cached in the browser (without the logo, to keep storage small) so the right currency
// shows straight away, then refreshed from the server.

const CompanyContext = createContext();

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

const cacheKey = (user) => `acc-company-${user.userID}-${user.username}`;

const readCache = (user) => {
  const empty = { company: DEFAULT_COMPANY, calendar: DEFAULT_CALENDAR };
  if (!user) return empty;
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey(user)) || "null");
    if (!saved) return empty;
    return {
      company: { ...DEFAULT_COMPANY, ...(saved.company || {}) },
      calendar: { ...DEFAULT_CALENDAR, ...(saved.calendar || {}) },
    };
  } catch {
    return empty;
  }
};

const writeCache = (user, company, calendar) => {
  try {
    // eslint-disable-next-line no-unused-vars
    const { logo, ...rest } = company;
    localStorage.setItem(cacheKey(user), JSON.stringify({ company: rest, calendar }));
  } catch {
    // storage full or blocked: the server copy still works
  }
};

export function CompanyProvider({ children }) {
  const { user } = useAuth();
  const identity = user ? `${user.userID}:${user.username}` : "guest";

  const [state, setState] = useState(() => ({ identity, ...readCache(user) }));
  // Goes up only when the server copy changes the currency after pages have drawn,
  // so the open page redraws once (see SignedInBoundary in App.jsx).
  const [companyVersion, setCompanyVersion] = useState(0);

  // A different person signed in: use their cached copy in this same render.
  let current = state;
  if (state.identity !== identity) {
    current = { identity, ...readCache(user) };
    setState(current);
  }
  const { company, calendar } = current;

  // Money helpers read the currency from a module setting; keep it in step.
  setCurrency({ symbol: company.currencySymbol, word: company.currencyWord });

  const stateRef = useRef(current);
  stateRef.current = current;

  // Only touches the data if it still belongs to the same person; keeps the cache in step.
  const update = useCallback((id, change) => {
    setState((s) => {
      if (s.identity !== id) return s;
      const next = { ...s, ...change };
      if (user) writeCache(user, next.company, next.calendar);
      return next;
    });
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    const id = identity;
    const [co, cal] = await Promise.allSettled([companyService.get(), calendarService.get()]);
    const change = {};
    if (co.status === "fulfilled") change.company = { ...DEFAULT_COMPANY, ...co.value };
    if (cal.status === "fulfilled") change.calendar = { ...DEFAULT_CALENDAR, ...cal.value };
    // offline or signed out: keep the cached copy
    if (!change.company && !change.calendar) return;
    const before = stateRef.current.company;
    update(id, change);
    if (change.company && before.currencyCode !== change.company.currencyCode) setCompanyVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  useEffect(() => { load(); }, [load]);

  // After the admin saves Settings > Company or changes Settings > Calendar.
  const applySaved = useCallback((saved) => update(identity, { company: { ...DEFAULT_COMPANY, ...saved } }), [update, identity]);
  const applyCalendar = useCallback((cal) => update(identity, { calendar: { ...DEFAULT_CALENDAR, ...cal } }), [update, identity]);

  return (
    <CompanyContext.Provider value={{ company, calendar, companyVersion, reloadCompany: load, applySaved, applyCalendar }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}

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
