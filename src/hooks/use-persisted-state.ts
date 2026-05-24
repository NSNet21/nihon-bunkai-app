import { useCallback, useEffect, useState } from 'react';

/**
 * useState that mirrors to localStorage (web) under key `nb.<name>`.
 * Survives page reloads and tab switches. No-op on native (Phase 2 = AsyncStorage adapter).
 */
export function usePersistedState<T>(name: string, initial: T): [T, (next: T) => void] {
  const key = `nb.${name}`;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  /* Re-sync from storage if another tab updates it. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return;
      try {
        setValue(JSON.parse(e.newValue));
      } catch {
        /* ignore parse errors from foreign tabs */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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
    },
    [key],
  );

  return [value, setPersisted];
}
