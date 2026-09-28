import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import "./useHighlight.css";

export function useHighlight(readyKey, onMissing) {
  const [params, setParams] = useSearchParams();
  const target = params.get("highlight");
  const triedFallback = useRef(false);
  const onMissingRef = useRef(onMissing);

  useEffect(() => {
    onMissingRef.current = onMissing;
  });

  useEffect(() => {
    if (!target || readyKey == null) return;

    const el = document.querySelector(`[data-highlight="${CSS.escape(target)}"]`);
    if (!el && onMissingRef.current && !triedFallback.current) {
      triedFallback.current = true;
      onMissingRef.current();
      return;
    }

    const next = new URLSearchParams(params);
    next.delete("highlight");
    setParams(next, { replace: true });
    triedFallback.current = false;
    if (!el) return;

    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("hl-flash");
    void el.offsetWidth;
    el.classList.add("hl-flash");
    el.addEventListener("animationend", () => el.classList.remove("hl-flash"), { once: true });
  }, [readyKey, target, params, setParams]);
}
