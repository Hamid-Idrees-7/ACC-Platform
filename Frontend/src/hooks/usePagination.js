import { useState } from "react";
import { useSearchParams } from "react-router-dom";

export const PAGE_SIZE = 25;

// Splits an already filtered list into pages. The page goes back to 1 when resetKey
// changes (search or filters), but not when the same list is reloaded.
// With getId, a ?highlight=<id> link opens the page that has that item.
export function usePagination(items, { resetKey = "", getId, size = PAGE_SIZE } = {}) {
  const [params] = useSearchParams();
  const target = getId ? params.get("highlight") : null;

  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(resetKey);
  const [lastTarget, setLastTarget] = useState(null);

  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    setPage(1);
  }

  if (target !== lastTarget) {
    const index = target ? items.findIndex((item) => String(getId(item)) === target) : -1;
    if (index >= 0) {
      setLastTarget(target);
      setPage(Math.floor(index / size) + 1);
    } else if (!target) {
      setLastTarget(null);
    }
  }

  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * size;

  return {
    page: current,
    pageCount,
    setPage,
    pageItems: items.slice(start, start + size),
    total: items.length,
    size,
  };
}
