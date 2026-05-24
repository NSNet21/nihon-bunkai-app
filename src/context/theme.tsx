/**
 * Theme context — wraps useColorScheme with manual override capability.
 * Override = 'system' (follow OS) | 'light' | 'dark'.
 * Modified hooks/use-color-scheme.ts reads this context first.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import { usePersistedState } from '@/hooks/use-persisted-state';

export type ThemeOverride = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  override: ThemeOverride;
  setOverride: (next: ThemeOverride) => void;
  toggle: () => void; // cycle: system → light → dark → system
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = usePersistedState<ThemeOverride>('theme-override', 'system');

  const toggle = useCallback(() => {
    const next: ThemeOverride =
      override === 'system' ? 'light' : override === 'light' ? 'dark' : 'system';
    setOverride(next);
  }, [override, setOverride]);

  const value = useMemo(() => ({ override, setOverride, toggle }), [override, setOverride, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeOverride(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    /* Fallback for components rendered outside Provider (e.g., snapshot tests) */
    return {
      override: 'system',
      setOverride: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

export { ThemeContext };
