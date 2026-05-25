import { useCallback, useEffect, useState } from 'react';

/**
 * useState that mirrors to localStorage (web) under key `nb.<name>`.
 * Survives page reloads and tab switches. No-op on native (Phase 2 = AsyncStorage adapter).
 *
 * Same-tab sync: the native `storage` event only fires in OTHER tabs, so we
 * dispatch a custom `nb:persisted` event on every write and listen for it,
 * which lets two components on the same page (e.g. Settings + Flashcard)
 * stay in sync without lifting state to a context.
 */
const SAME_TAB_EVENT = 'nb:persisted';

type NbPersistedDetail = { key: string; value: unknown };

export function usePersistedState<T>(name: string, initial: T): [T, (next: T) => void] {
  const key = `nb.${name}`;

  /* Always start with `initial` so SSG output matches the first client render.
     Hydration from localStorage happens in the effect below — one frame after
     mount. Without this, expo export -p web (output: "static") would mismatch
     server HTML vs. client state and React 19 would warn loudly in prod. */
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    /* Hydrate from localStorage AFTER mount — keeps SSG/SSR output stable. */
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore parse errors */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return;
      try {
        setValue(JSON.parse(e.newValue));
      } catch {
        /* ignore parse errors from foreign tabs */
      }
    };
    const onSameTab = (e: Event) => {
      const detail = (e as CustomEvent<NbPersistedDetail>).detail;
      if (!detail || detail.key !== key) return;
      setValue(detail.value as T);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(SAME_TAB_EVENT, onSameTab as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SAME_TAB_EVENT, onSameTab as EventListener);
    };
  }, [key]);

  const setPersisted = useCallback(
    (next: T) => {
      setValue(next);
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* quota/private-mode — silently ignore */
      }
      /* Notify any same-tab listeners (the native `storage` event does not). */
      window.dispatchEvent(new CustomEvent<NbPersistedDetail>(SAME_TAB_EVENT, { detail: { key, value: next } }));
    },
    [key],
  );

  return [value, setPersisted];
}
