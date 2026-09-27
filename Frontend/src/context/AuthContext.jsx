import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { tokenExpiresAt } from "../utils/token";
import { DEMO_NOTE_KEY } from "../config/demoConfig";
import { LOGIN_NOTE_KEY, SIGNOUT_NOTE_KEY, ACTIVITY_KEY } from "../config/sessionConfig";

// Create the context (the shared "notice board")
const AuthContext = createContext();

// Demo role transition timing: the role card stays up at least this long,
// then fades out while the new dashboard fades in (1.5s in total).
const TRANSITION_MIN_MS = 700;                                                       // card kitni der dikhe
const TRANSITION_OUT_MS = 300;                                                       // card kitni der me gayab ho

// A message for the sign-in page (shown once, in this tab).
const leaveNote = (note, demo) => {
  try {
    sessionStorage.setItem(demo ? DEMO_NOTE_KEY : LOGIN_NOTE_KEY, note);
  } catch {
    // storage blocked: the sign-in page simply shows no message
  }
};

// Provider component - wraps the app and gives login state to all pages
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Where a dashboard page goes after signing out: the home page after Logout, otherwise
  // (null) the sign-in page. Set in the same update as the user, so it is never too late.
  const [exitTo, setExitTo] = useState(null);

  // Live demo role-change transition: { role, title, phase: in | out } or null
  const [demoTransition, setDemoTransition] = useState(null);

  // On app load, check if a user is already logged in (from localStorage).
  // A token that has already expired is cleared straight away, with a note for the sign-in page.
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      const token = localStorage.getItem("token");
      const expiresAt = tokenExpiresAt(token);
      if (stored && token && expiresAt && expiresAt <= Date.now()) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        leaveNote(stored.demo ? "Your demo session has ended. Thanks for exploring ACC!" : "Your session has expired. Please sign in again.", !!stored.demo);
      } else if (stored) {
        setUser(stored);
      }
    } catch {
      localStorage.removeItem("user");
    }
    setLoading(false);
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

  // Called after a successful login - save token and user info
  const login = (authData) => {
    localStorage.setItem("token", authData.token);
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    localStorage.removeItem(SIGNOUT_NOTE_KEY);
    const userInfo = {
      userID: authData.userID,
      username: authData.username,
      fullName: authData.fullName,
      role: authData.role,
      profilePicture: authData.profilePicture || null,
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

  // Update user info only (keeps the token untouched)
  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedFields };
      localStorage.setItem("user", JSON.stringify(merged));
      return merged;
    });
  };

  // Called on logout - clear everything (this browser only).
  // to: the page to show next ("/" after Logout); the sign-in page when left out.
  const logout = useCallback((to = null) => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
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
      value={{ user, login, logout, signOut, exitTo, updateUser, loading, demoTransition, runDemoTransition }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook - lets any page easily use the auth context
export function useAuth() {
  return useContext(AuthContext);
}
