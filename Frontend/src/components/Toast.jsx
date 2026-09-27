import { useState, useRef, useCallback, useEffect } from "react";
import "./Toast.css";

// Small message at the bottom of the screen (next to the buttons people just pressed),
// eg Company settings saved. Same look as the toasts on the other pages.
export function useToast(duration = 3000) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((text, type = "success") => {
    clearTimeout(timer.current);
    setToast({ text, type, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), duration);
  }, [duration]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return [toast, showToast];
}

// raised: sits above a sticky save bar instead of covering its buttons.
function Toast({ toast, raised = false }) {
  if (!toast) return null;
  return (
    <div key={toast.id} className={`tst tst-${toast.type} ${raised ? "tst-raised" : ""}`} role={toast.type === "error" ? "alert" : "status"}>
      {toast.type === "error" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      )}
      <span>{toast.text}</span>
    </div>
  );
}

export default Toast;
