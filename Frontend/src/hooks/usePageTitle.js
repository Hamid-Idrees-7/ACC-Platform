import { useEffect } from "react";

export const SITE_NAME = "Anonymous Construction Co.";

export function usePageTitle(title, suffix = "ACC") {
  useEffect(() => {
    const name = String(title || "").split(" — ")[0].trim();
    document.title = !suffix ? name : name ? `${name} · ${suffix}` : suffix;
  }, [title, suffix]);
}

// The search result snippet for a public page. Goes back to the site-wide text from
// index.html when the page closes.
export function usePageDescription(text) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]');
    if (!meta || !text) return;
    const before = meta.getAttribute("content");
    meta.setAttribute("content", text);
    return () => meta.setAttribute("content", before);
  }, [text]);
}
