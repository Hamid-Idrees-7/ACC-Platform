import { useEffect } from "react";

const dirtyPages = new Set();

export const hasUnsavedChanges = () => dirtyPages.size > 0;

export function useUnsavedChanges(dirty) {
  useEffect(() => {
    if (!dirty) return;
    const token = {};
    dirtyPages.add(token);
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      dirtyPages.delete(token);
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);
}
