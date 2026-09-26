import { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { profileService } from "../services/profileService";
import { setNumberSystem } from "../utils/format";
import { setDatePrefs } from "../utils/dates";

// Settings > Appearance: theme, number format, date format and time format.
// Saved on the server (they follow the user to any device) and cached in the browser so
// the dashboard opens in the right theme straight away, without a light flash.

const PreferencesContext = createContext();

export const DEFAULT_PREFS = { theme: "light", numberFormat: "pk", dateFormat: "dmy-text", timeFormat: "12h" };

// The last theme choice (light, dark or system), read by the tiny script in index.html.
export const THEME_BOOT_KEY = "acc-theme";

const cacheKey = (user) => `acc-prefs-${user.userID}-${user.username}`;

const readCache = (user) => {
  if (!user) return DEFAULT_PREFS;
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey(user)) || "null");
    return saved ? { ...DEFAULT_PREFS, ...saved } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};

const writeCache = (user, prefs) => {
  try {
    localStorage.setItem(cacheKey(user), JSON.stringify(prefs));
  } catch {
    // storage full or blocked: the server copy still works
  }
};

// Number and date helpers read module settings, so update them before anything renders.
const applyFormats = (prefs) => {
  setNumberSystem(prefs.numberFormat);
  setDatePrefs(prefs);
};

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const IDLE = { status: "idle", message: "" };

const sameFormats = (a, b) =>
  a.numberFormat === b.numberFormat && a.dateFormat === b.dateFormat && a.timeFormat === b.timeFormat;

export function PreferencesProvider({ children }) {
  const { user } = useAuth();
  const identity = user ? `${user.userID}:${user.username}` : "guest";

  // Whose settings these are, the settings, and the result of the last save (kept here so
  // it survives any redraw of the Settings page).
  const [state, setState] = useState(() => ({ identity, prefs: readCache(user), save: IDLE }));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  // Goes up only when settings from the server change how numbers or dates look, so the
  // open page redraws once. Changes made in Settings never need it (see SignedInBoundary).
  const [formatVersion, setFormatVersion] = useState(0);

  // A different person signed in (login, logout, live demo role switch): switch to their
  // cached settings in this same render, so the first frame already has the right theme.
  let current = state;
  if (state.identity !== identity) {
    current = { identity, prefs: readCache(user), save: IDLE };
    setState(current);
  }
  const { prefs, save: saveState } = current;

  // Number and date helpers read module settings; keep them in step before children render.
  applyFormats(prefs);

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Only touches the settings if they still belong to the same person.
  const setFor = (id, change) => setState((s) => (s.identity === id ? { ...s, ...change } : s));

  // Then fetch the server copy (another device may have changed it).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    profileService.getPreferences()
      .then((server) => {
        if (cancelled) return;
        const merged = { ...DEFAULT_PREFS, ...server };
        writeCache(user, merged);
        const before = prefsRef.current;
        setFor(identity, { prefs: merged });
        if (!sameFormats(before, merged)) setFormatVersion((v) => v + 1);
      })
      .catch(() => {
        // offline or not signed in any more: keep the cached settings
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  // Follow the device when the theme is set to System.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Change one or more settings: applied at once, then saved. Rolls back if saving fails.
  const updatePrefs = useCallback(async (changes) => {
    const previous = prefs;
    const next = { ...prefs, ...changes };
    const id = identity;
    setFor(id, { prefs: next, save: { status: "saving", message: "" } });
    if (user) writeCache(user, next);
    try {
      const saved = await profileService.savePreferences(next);
      const merged = { ...DEFAULT_PREFS, ...saved };
      if (user) writeCache(user, merged);
      setFor(id, { save: { status: "saved", message: "Saved. Your settings follow you to any device." } });
      return merged;
    } catch (err) {
      if (user) writeCache(user, previous);
      setFor(id, {
        prefs: previous,
        save: { status: "error", message: err?.response?.data?.message || "Could not save your settings. Please try again." },
      });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, user, identity]);

  const resolvedTheme = prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;

  return (
    <PreferencesContext.Provider value={{ prefs, updatePrefs, resolvedTheme, formatVersion, saveState }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}

// Used by the dashboard shell: puts the chosen theme on <html> while a dashboard page is
// open, and takes it off again on the public website (which always stays light).
// A change of theme (Settings, the device in System mode, a demo role switch) cross-fades
// instead of flashing, where the browser supports view transitions.
let pendingRemoval = null;

const canCrossFade = () =>
  typeof document !== "undefined" &&
  typeof document.startViewTransition === "function" &&
  !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useDashboardTheme() {
  const { prefs, resolvedTheme } = usePreferences();

  // Layout effect: runs before the browser paints, so no frame shows the wrong theme.
  useLayoutEffect(() => {
    const root = document.documentElement;
    // The dashboard was just redrawn (eg a role switch): keep the theme that is on screen.
    if (pendingRemoval) { cancelAnimationFrame(pendingRemoval); pendingRemoval = null; }

    const shown = root.dataset.theme;
    const apply = () => { root.dataset.theme = resolvedTheme; };
    if (shown && shown !== resolvedTheme && canCrossFade()) document.startViewTransition(apply);
    else apply();

    return () => {
      // Remove on the next frame, unless another dashboard page takes over first.
      pendingRemoval = requestAnimationFrame(() => {
        pendingRemoval = null;
        delete root.dataset.theme;
      });
    };
  }, [resolvedTheme]);

  // Remember the choice itself ("system" too), so index.html can open the next visit
  // in the right theme even if the device switched between light and dark meanwhile.
  useEffect(() => {
    try { localStorage.setItem(THEME_BOOT_KEY, prefs.theme); } catch { /* ignore */ }
  }, [prefs.theme]);
}
