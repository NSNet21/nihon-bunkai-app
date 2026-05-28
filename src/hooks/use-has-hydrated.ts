import { useEffect, useState } from 'react';

/**
 * Returns `false` on SSR + the first client paint, then flips to `true`
 * after the first effect commit. Use this to gate any render branch that
 * would diverge between server and client because of a runtime-only
 * value (window dimensions, localStorage, matchMedia, etc.).
 *
 * Pattern:
 *   const hasHydrated = useHasHydrated();
 *   const isCompact = hasHydrated && width < 600;  // safe — initial false
 *   return isCompact ? <Mobile/> : <Desktop/>;
 *
 * Without the gate, SSR renders one branch (typically desktop, since
 * Dimensions defaults to 0) and the client first paint renders the
 * other on a real viewport — React throws #418 ("server HTML didn't
 * match client") and discards the affected sub-tree, forcing a full
 * client re-render that the user perceives as sluggishness on cold
 * load. See [[hydration-fix-as-perf-win]].
 */
export function useHasHydrated(): boolean {
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    setHasHydrated(true);
  }, []);
  return hasHydrated;
}
