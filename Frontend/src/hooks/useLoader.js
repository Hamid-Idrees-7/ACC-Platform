import { useEffect, useEffectEvent } from "react";

// Runs a page's loader when the page opens, and again whenever key changes (eg the id in
// the address). The loader always sees the latest props and state.
export function useLoader(load, key = null) {
  const run = useEffectEvent(load);
  useEffect(() => {
    run();
  }, [key]);
}
