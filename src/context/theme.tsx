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
  useState,
  type ReactNode,
} from 'react';

export type ThemeOverride = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  override: ThemeOverride;
  setOverride: (next: ThemeOverride) => void;
  toggle: () => void; // cycle: system → light → dark → system
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<ThemeOverride>('system');

  const toggle = useCallback(() => {
    setOverride((prev) => (prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system'));
  }, []);

  const value = useMemo(() => ({ override, setOverride, toggle }), [override, toggle]);

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
