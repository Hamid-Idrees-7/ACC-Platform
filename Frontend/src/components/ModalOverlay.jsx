import { useEffect, useRef, useState } from "react";
import "./ModalOverlay.css";

const openStack = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

function ModalOverlay({ className, onClose, label, children }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  const edited = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const requestCloseRef = useRef(null);

  useEffect(() => {
    closeRef.current = onClose;
    confirmingRef.current = confirming;
  });

  useEffect(() => {
    const node = ref.current;
    const token = {};
    openStack.push(token);
    const previous = document.activeElement;

    if (!node.contains(document.activeElement)) {
      const field = [...node.querySelectorAll("input:not([type=hidden]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])")].find(visible);
      if (field) field.focus({ preventScroll: true });
      else node.focus({ preventScroll: true });
    }

    const markEdited = (e) => {
      if (e.isTrusted) edited.current = true;
    };

    const requestClose = () => {
      if (edited.current) setConfirming(true);
      else closeRef.current?.();
    };

    const onClick = (e) => {
      if (confirmingRef.current) return;
      const trigger = e.target.closest("[data-close]");
      if (trigger && node.contains(trigger)) {
        e.preventDefault();
        e.stopPropagation();
        requestClose();
      }
    };

    const onKey = (e) => {
      if (e.defaultPrevented || openStack[openStack.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        if (confirmingRef.current) setConfirming(false);
        else requestClose();
        return;
      }
      if (e.key !== "Tab") return;
      const list = [...node.querySelectorAll(FOCUSABLE)].filter(visible);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (!node.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    requestCloseRef.current = requestClose;
    node.addEventListener("input", markEdited);
    node.addEventListener("change", markEdited);
    node.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("input", markEdited);
      node.removeEventListener("change", markEdited);
      node.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      openStack.splice(openStack.indexOf(token), 1);
      if (previous && typeof previous.focus === "function" && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);

  const onBackdrop = (e) => {
    if (e.target !== e.currentTarget || confirming) return;
    requestCloseRef.current?.();
  };

  return (
    <div ref={ref} className={className} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onClick={onBackdrop}>
      {children}
      {confirming && (
        <div className="mdo-confirm-layer" onClick={(e) => { if (e.target === e.currentTarget) setConfirming(false); }}>
          <div className="mdo-confirm" role="alertdialog" aria-modal="true" aria-labelledby="mdo-confirm-title">
            <h3 id="mdo-confirm-title">Discard your changes?</h3>
            <p>What you typed in this form is not saved yet. If you close it now, it will be lost.</p>
            <div className="mdo-confirm-actions">
              <button type="button" className="mdo-keep" onClick={() => setConfirming(false)} autoFocus>Keep editing</button>
              <button type="button" className="mdo-discard" onClick={() => { setConfirming(false); closeRef.current?.(); }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ModalOverlay;
