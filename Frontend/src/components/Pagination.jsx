import { useRef } from "react";
import "./Pagination.css";

// Page numbers to show, eg 1 … 4 5 6 … 12
const pageList = (page, count) => {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= count - 2) [count - 3, count - 2, count - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
};

function Pagination({ page, pageCount, setPage, total, size, label = "items" }) {
  const navRef = useRef(null);
  if (pageCount <= 1) return null;

  const go = (p) => {
    if (p < 1 || p > pageCount || p === page) return;
    setPage(p);
    // Bring the top of the list back into view when it was scrolled past.
    const list = navRef.current?.previousElementSibling;
    const scroller = navRef.current?.closest(".dash-content");
    if (!list || !scroller) return;
    const gap = list.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (gap < 0) scroller.scrollTo({ top: scroller.scrollTop + gap - 16, behavior: "smooth" });
  };

  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  return (
    <nav className="pgn" ref={navRef} aria-label="Pages">
      <span className="pgn-info">
        {from}–{to} of {total} {label}
      </span>
      <div className="pgn-pages">
        <button type="button" className="pgn-btn pgn-arrow" onClick={() => go(page - 1)} disabled={page === 1} aria-label="Previous page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        {pageList(page, pageCount).map((p) =>
          typeof p === "string" ? (
            <span key={p} className="pgn-gap">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`pgn-btn ${p === page ? "active" : ""}`}
              onClick={() => go(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}
        <button type="button" className="pgn-btn pgn-arrow" onClick={() => go(page + 1)} disabled={page === pageCount} aria-label="Next page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
