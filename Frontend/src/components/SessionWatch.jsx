import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import api from "../services/api";
import { demoService } from "../services/demoService";
import { DEMO_NOTE_KEY } from "../config/demoConfig";
import {
  SESSION_ENDED_EVENT, ACTIVITY_KEY, IDLE_WARNING_SECONDS, DEFAULT_IDLE_MINUTES, idleLabel,
} from "../config/sessionConfig";
import "./SessionWatch.css";
import { leaveWithoutAsking } from "../hooks/useUnsavedChanges";

// Wraps every dashboard page while someone is signed in.
// Signs out after the inactivity time chosen in Settings > Security, with a one-minute
// warning. Activity in any open tab counts (shared through localStorage).
// When the server ends the session (signed out on another device, password changed,
// account disabled, expired), it signs out here too and shows the reason on the sign-in page.

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove", "scroll"];
const WRITE_EVERY_MS = 5000;

// While someone is active, the server hears from this browser at least this often, so it never
// treats a session as idle while the person reads or types without saving (shared by all tabs).
const PING_EVERY_MS = 3 * 60 * 1000;
const PING_KEY = "acc-last-ping";

const readLastActivity = () => Number(localStorage.getItem(ACTIVITY_KEY)) || 0;

function SessionWatch() {
  const { user, signOut, logout } = useAuth();
  const { prefs } = usePreferences();
  const navigate = useNavigate();

  const minutes = user ? prefs.idleMinutes ?? DEFAULT_IDLE_MINUTES : 0;
  const [secondsLeft, setSecondsLeft] = useState(null);   // shown while the warning is open
  const warningOpen = secondsLeft !== null && !!user && minutes > 0;
  const warningRef = useRef(false);
  useEffect(() => { warningRef.current = warningOpen; }, [warningOpen]);

  const ending = useRef(false);
  const lastWrite = useRef(0);
  const stayRef = useRef(null);

  // Remember activity (at most every 5 seconds, it is shared with the other tabs).
  const markActive = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastWrite.current < WRITE_EVERY_MS) return;
    lastWrite.current = now;
    try {
      localStorage.setItem(ACTIVITY_KEY, String(now));
      if (now - (Number(localStorage.getItem(PING_KEY)) || 0) >= PING_EVERY_MS) {
        localStorage.setItem(PING_KEY, String(now));
        api.get("/auth/ping").catch(() => {});
      }
    } catch {
      // storage blocked: this tab still keeps its own time
    }
  }, []);

  // A brand-new browser session has no activity time yet.
  useEffect(() => {
    if (user && !readLastActivity()) markActive(true);
  }, [user, markActive]);

  // Activity anywhere on the page. While the warning is open only its buttons count,
  // so moving the mouse by accident does not hide it.
  useEffect(() => {
    if (!user) return;
    const onActivity = () => {
      if (!warningRef.current) markActive();
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true, capture: true }));
    return () => ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity, { capture: true }));
  }, [user, markActive]);

  const timeOut = useCallback(async () => {
    if (ending.current) return;
    ending.current = true;
    setSecondsLeft(null);
    const text = `You were signed out after ${idleLabel(minutes)} of inactivity.`;
    if (user?.demo) {
      // A demo visitor's seat is freed as well.
      try {
        await demoService.end();
      } catch {
        // The demo may already be over on the server.
      }
      sessionStorage.setItem(DEMO_NOTE_KEY, `${text} Your demo has ended.`);
      logout();
    } else {
      await signOut({ note: text, idle: true });
    }
    leaveWithoutAsking(() => navigate("/login", { replace: true }));
  }, [minutes, user, signOut, logout, navigate]);

  // Check once a second while automatic sign-out is on. Uses clock times, so a sleeping
  // computer or a background tab is handled correctly when it wakes up.
  useEffect(() => {
    if (!user || !minutes) return;
    const limit = minutes * 60 * 1000;
    const check = () => {
      if (ending.current) return;
      const last = Math.max(readLastActivity(), lastWrite.current);
      const left = last + limit - Date.now();
      if (left <= 0) timeOut();
      else if (left <= IDLE_WARNING_SECONDS * 1000) setSecondsLeft(Math.ceil(left / 1000));
      else setSecondsLeft(null);
    };
    const first = setTimeout(check, 0);
    const timer = setInterval(check, 1000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, minutes, timeOut]);

  // The server ended the session.
  useEffect(() => {
    if (!user || user.demo) return;   // demo visitors: handled by the demo bar
    const onEnded = async (e) => {
      if (ending.current) return;
      ending.current = true;
      await signOut({ note: e.detail?.message || "Your session has ended. Please sign in again.", ended: true });
      leaveWithoutAsking(() => navigate("/login", { replace: true }));
    };
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
  }, [user, signOut, navigate]);

  const stay = useCallback(() => {
    markActive(true);
    setSecondsLeft(null);
  }, [markActive]);

  // The warning takes the keyboard focus, and Escape keeps the user signed in.
  useEffect(() => {
    if (!warningOpen) return;
    stayRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        stay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [warningOpen, stay]);

  const signOutNow = async () => {
    if (ending.current) return;
    ending.current = true;
    setSecondsLeft(null);
    if (user?.demo) {
      try { await demoService.end(); } catch { /* already over */ }
      sessionStorage.setItem(DEMO_NOTE_KEY, "You left the demo. Thanks for exploring ACC!");
      logout();
    } else {
      await signOut();
    }
    leaveWithoutAsking(() => navigate("/login", { replace: true }));
  };

  if (!warningOpen) return null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="ssw-overlay">
      <div className="ssw-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ssw-title" aria-describedby="ssw-text">
        <div className="ssw-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        </div>
        <h3 id="ssw-title">Are you still there?</h3>
        <p id="ssw-text">
          There has been no activity for a while. For your security you will be signed out in
        </p>
        <div className="ssw-count" aria-live="polite">{mm}:{ss}</div>
        <div className="ssw-actions">
          <button type="button" className="ssw-btn ssw-btn-ghost" onClick={signOutNow}>Sign out now</button>
          <button type="button" className="ssw-btn ssw-btn-primary" onClick={stay} ref={stayRef}>Stay signed in</button>
        </div>
      </div>
    </div>
  );
}

export default SessionWatch;
