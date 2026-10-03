import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import api from "../services/api";
import { API_BASE_URL } from "../config/apiConfig";
import { tokenExpiresAt } from "../utils/token";
import { DEMO_NOTE_KEY } from "../config/demoConfig";
import {
  LOGIN_NOTE_KEY, SIGNOUT_NOTE_KEY, ACTIVITY_KEY, TAB_KEY, TAB_ALIVE_KEY, TAB_ALIVE_EVERY_MS, TAB_ALIVE_MS,
} from "../config/sessionConfig";
import { ALERT_BASELINE_KEY } from "../config/notificationConfig";

const AuthContext = createContext();

// Demo role transition timing: the role card stays up at least this long,
// then fades out while the new dashboard fades in (1.5s in total).
const TRANSITION_MIN_MS = 700;                                                       // shortest time the card stays up
const TRANSITION_OUT_MS = 300;                                                       // how long the card takes to fade out

// The company details cached for the signed-in person (see CompanyContext) are not left
// behind in the browser after sign-out. Display preferences stay, so the theme is right
// straight away on the next sign-in.
const clearCompanyCache = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("acc-company-"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage blocked: nothing to clear
  }
};

// A message for the sign-in page (shown once, in this tab).
const leaveNote = (note, demo) => {
  try {
    sessionStorage.setItem(demo ? DEMO_NOTE_KEY : LOGIN_NOTE_KEY, note);
  } catch {
    // storage blocked: the sign-in page simply shows no message
  }
};

// True for the first tab opened after the browser was closed (no other tab is open).
const isFirstTab = () => {
  try {
    if (sessionStorage.getItem(TAB_KEY)) return false;
    const lastBeat = Number(localStorage.getItem(TAB_ALIVE_KEY)) || 0;
    return Date.now() - lastBeat > TAB_ALIVE_MS;
  } catch {
    return false;
  }
};

const markTabAlive = () => {
  try {
    sessionStorage.setItem(TAB_KEY, "1");
    localStorage.setItem(TAB_ALIVE_KEY, String(Date.now()));
  } catch {
    // storage blocked
  }
};

// The saved sign-in, read once when the app starts.
// A token that has already expired is cleared straight away, with a note for the sign-in page.
// If the browser was closed since the last visit: without "Remember me" that ends the
// sign-in; with it, the inactivity timer starts again from now.
let startupUser;
const readSavedUser = () => {
  if (startupUser !== undefined) return startupUser;
  const firstTab = isFirstTab();
  markTabAlive();
  startupUser = null;
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    const token = localStorage.getItem("token");
    const expiresAt = tokenExpiresAt(token);
    if (stored && token && expiresAt && expiresAt <= Date.now()) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      clearCompanyCache();
      leaveNote(stored.demo ? "Your demo session has ended. Thanks for exploring ACC!" : "Your session has expired. Please sign in again.", !!stored.demo);
    } else if (stored && token && firstTab && !stored.demo && !stored.keepSignedIn) {
      api.post("/auth/logout", { reason: null }, { timeout: 8000, headers: { Authorization: `Bearer ${token}` } })
        .catch(() => {});
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      clearCompanyCache();
      leaveNote("Session ended. Use \"Remember me\" to stay logged in.", false);
    } else if (stored) {
      if (firstTab && stored.keepSignedIn) localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      startupUser = stored;
    }
  } catch {
    localStorage.removeItem("user");
  }
  return startupUser;
};

// Wraps the app and gives every page the sign-in state.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSavedUser);
  // Where a dashboard page goes after signing out: the home page after Logout, otherwise
  // (null) the sign-in page. Set in the same update as the user, so it is never too late.
  const [exitTo, setExitTo] = useState(null);

  // Live demo role-change transition: { role, title, phase: in | out } or null
  const [demoTransition, setDemoTransition] = useState(null);

  // Heartbeat so a new tab knows the browser is still open.
  useEffect(() => {
    const timer = setInterval(markTabAlive, TAB_ALIVE_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === "visible") markTabAlive(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Other open tabs: signing out (or in) there applies here too.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "token" && !e.newValue) {
        try {
          const note = JSON.parse(localStorage.getItem(SIGNOUT_NOTE_KEY) || "null");
          if (note?.text && Date.now() - note.at < 10000) leaveNote(note.text, note.demo);
        } catch {
          // no note
        }
        setExitTo(null);
        setUser(null);
      } else if (e.key === "user" && e.newValue) {
        try {
          setUser(JSON.parse(e.newValue));
        } catch {
          // ignore a broken value
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // After a successful sign-in: saves the token and the user info.
  // keepSignedIn: the sign-in survives closing the browser (30 days).
  const login = (authData, { keepSignedIn = false } = {}) => {
    localStorage.setItem("token", authData.token);
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    localStorage.removeItem(SIGNOUT_NOTE_KEY);
    sessionStorage.removeItem(ALERT_BASELINE_KEY);
    const userInfo = {
      userID: authData.userID,
      username: authData.username,
      fullName: authData.fullName,
      role: authData.role,
      profilePicture: authData.profilePicture || null,
      keepSignedIn: !authData.isDemo && keepSignedIn,
      // Demo visitors carry their demo role and the moment their session ends.
      demo: authData.isDemo
        ? {
            role: authData.demoRole,
            label: authData.demoRoleLabel || null,
            endsAt: Date.now() + (authData.demoSecondsLeft || 0) * 1000,
          }
        : null,
    };
    localStorage.setItem("user", JSON.stringify(userInfo));
    setExitTo(null);
    setUser(userInfo);
  };

  // Updates the user info only; the token stays as it is.
  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedFields };
      localStorage.setItem("user", JSON.stringify(merged));
      return merged;
    });
  };

  // Signs out in this browser only and clears everything.
  // to: the page to show next ("/" after Logout); the sign-in page when left out.
  const logout = useCallback((to = null) => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    clearCompanyCache();
    setExitTo(typeof to === "string" ? to : null);
    setUser(null);
  }, []);

  // Sign out properly: the session also ends on the server (the token can't be used again),
  // and the note is shown on the sign-in page, in this tab and in any other open tab.
  //   note: message for the sign-in page; idle: signed out after inactivity;
  //   ended: the server already ended the session (nothing to tell it).
  const signOut = useCallback(async ({ note = "", idle = false, ended = false, to = null } = {}) => {
    const token = localStorage.getItem("token");
    if (!ended && token) {
      // Sent with the token directly and not waited for: this browser signs out at once
      // either way (offline, or already signed out on the server, is fine too).
      api.post("/auth/logout", { reason: idle ? "idle" : null }, { timeout: 8000, headers: { Authorization: `Bearer ${token}` } })
        .catch(() => {});
    }
    try {
      localStorage.setItem(SIGNOUT_NOTE_KEY, JSON.stringify({ text: note || "You have been signed out.", at: Date.now() }));
    } catch {
      // storage full: other tabs just show no message
    }
    if (note) leaveNote(note, false);
    logout(to);
  }, [logout]);


  // Before another sign-in or demo starts in this browser: end the one it still holds on the
  // server too, so an old demo doesn't keep a seat and an old sign-in doesn't stay open.
  // Plain axios, so an already-ended session can't trigger the "signed out" handling.
  const dropSession = useCallback(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const url = user?.demo ? "/demo/end" : "/auth/logout";
      axios.post(`${API_BASE_URL}${url}`, {}, { timeout: 8000, headers: { Authorization: `Bearer ${token}` } })
        .catch(() => {});
    }
    logout();
  }, [user, logout]);

  const runDemoTransition = useCallback(async (role, title, action, label = null) => {
    setDemoTransition({ role, title, label, phase: "in" });
    try {
      const [result] = await Promise.all([
        action(),
        new Promise((resolve) => setTimeout(resolve, TRANSITION_MIN_MS)),
      ]);
      return result;
    } finally {
      setDemoTransition((current) => (current ? { ...current, phase: "out" } : current));
      setTimeout(() => setDemoTransition(null), TRANSITION_OUT_MS);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, signOut, dropSession, exitTo, updateUser, demoTransition, runDemoTransition }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
