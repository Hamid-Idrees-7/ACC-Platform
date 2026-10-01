import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { companyService } from "../services/companyService";
import { calendarService } from "../services/calendarService";
import { setCurrency } from "../utils/format";
import { useLiveRefresh } from "../hooks/useLive";
import { useLoader } from "../hooks/useLoader";
import { DEFAULT_COMPANY, DEFAULT_CALENDAR } from "../config/companyConfig";

// Settings > Company and Settings > Calendar: the company's name, currency, default tax,
// weekly off days and holidays, read by every signed-in page.
// Cached in the browser (without the logo, to keep storage small) so the right currency
// shows straight away, then refreshed from the server.

const CompanyContext = createContext();

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

  // The latest data, for the loader below (it runs after an await).
  const stateRef = useRef(current);
  useEffect(() => {
    stateRef.current = current;
  });

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

  useLoader(load, identity);

  useLiveRefresh(["company", "calendar"], load);

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
