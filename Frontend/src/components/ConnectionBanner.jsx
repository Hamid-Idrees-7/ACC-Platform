import { useEffect, useRef, useState } from "react";
import { HEALTH_URL, SERVER_UNREACHABLE_EVENT } from "../config/apiConfig";
import { resyncNow } from "../services/live";
import "./ConnectionBanner.css";

const RETRY_MS = 8000;

function ConnectionBanner() {
  const [state, setState] = useState(() => (navigator.onLine === false ? "offline" : "ok"));
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    let wasDown = navigator.onLine === false;

    const check = async () => {
      clearTimeout(timer.current);
      try {
        const res = await fetch(HEALTH_URL, { cache: "no-store" });
        if (!alive) return;
        if (res.ok) {
          setState((prev) => (prev === "ok" ? "ok" : "back"));
          if (wasDown) {
            wasDown = false;
            resyncNow();
          }
          timer.current = setTimeout(() => alive && setState((prev) => (prev === "back" ? "ok" : prev)), 2500);
          return;
        }
      } catch {
        if (!alive) return;
      }
      wasDown = true;
      setState(navigator.onLine === false ? "offline" : "down");
      timer.current = setTimeout(check, RETRY_MS);
    };

    const onUnreachable = () => {
      wasDown = true;
      setState((prev) => (prev === "down" || prev === "offline" ? prev : navigator.onLine === false ? "offline" : "down"));
      clearTimeout(timer.current);
      timer.current = setTimeout(check, RETRY_MS);
    };
    const onOffline = () => {
      wasDown = true;
      clearTimeout(timer.current);
      setState("offline");
    };
    const onOnline = () => check();

    window.addEventListener(SERVER_UNREACHABLE_EVENT, onUnreachable);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      alive = false;
      clearTimeout(timer.current);
      window.removeEventListener(SERVER_UNREACHABLE_EVENT, onUnreachable);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (state === "ok") return null;

  const text = state === "offline"
    ? "You are offline. Changes can't be saved until the connection is back."
    : state === "down"
      ? "Can't reach the server. Trying again..."
      : "Connected again.";

  return (
    <div className={`cnb cnb-${state}`} role={state === "back" ? "status" : "alert"}>
      <span className="cnb-dot" aria-hidden="true" />
      {text}
    </div>
  );
}

export default ConnectionBanner;
