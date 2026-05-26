/**
 * Theme context — split into Colors + Actions to reduce fan-out re-renders.
 *
 * Why split: previously a single ThemeContext exposed `override + setters`.
 * Every Themed* component subscribed via useColorScheme → every theme switch
 * re-rendered 1000+ nodes (219ms long task, profiled 2026-05-26).
 *
 * Now:
 *   ThemeColorsContext  — { scheme, colors }     · changes on switch
 *   ThemeActionsContext — { override, setters }  · stable across re-renders
 *
 * Components that only need to dispatch (e.g. the ThemeToggle trigger row)
 * read from Actions and DON'T re-render on switch. Components that need
 * actual colors read from Colors and get a stable memoized ref.
 *
 * useThemeOverride() is kept as a thin alias to useThemeActions() for
 * backward compat during migration — no call site needs to change urgently.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { usePersistedState } from '@/hooks/use-persisted-state';
import { Colors } from '@/constants/theme';

export type ThemeOverride = 'system' | 'light' | 'dark';
export type EffectiveScheme = 'light' | 'dark';
export type ThemeColors = typeof Colors.light;

interface ThemeColorsValue {
  scheme: EffectiveScheme;
  colors: ThemeColors;
}

interface ThemeActionsValue {
  override: ThemeOverride;
  setOverride: (next: ThemeOverride) => void;
  toggle: () => void;
}

const ThemeColorsContext = createContext<ThemeColorsValue>({
  scheme: 'light',
  colors: Colors.light,
});

const ThemeActionsContext = createContext<ThemeActionsValue>({
  override: 'system',
  setOverride: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = usePersistedState<ThemeOverride>('theme-override', 'system');
  const system = useRNColorScheme();

  /* Hydration guard — keeps SSG/SSR first paint = 'light' to match the
     deterministic server output. Without this, RN's useColorScheme can
     return 'dark' immediately on a dark-mode OS and trigger a hydration
     warning. Previously lived in use-color-scheme.web.ts; consolidated
     here so the provider is the single source of truth. */
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const scheme: EffectiveScheme = useMemo(() => {
    if (!hasHydrated) return 'light';
    if (override === 'light' || override === 'dark') return override;
    return system === 'dark' ? 'dark' : 'light';
  }, [hasHydrated, override, system]);

  const colors = useMemo(() => Colors[scheme], [scheme]);

  const colorsValue = useMemo<ThemeColorsValue>(
    () => ({ scheme, colors }),
    [scheme, colors],
  );

  const toggle = useCallback(() => {
    const next: ThemeOverride =
      override === 'system' ? 'light' : override === 'light' ? 'dark' : 'system';
    setOverride(next);
  }, [override, setOverride]);

  const actionsValue = useMemo<ThemeActionsValue>(
    () => ({ override, setOverride, toggle }),
    [override, setOverride, toggle],
  );

  return (
    <ThemeActionsContext.Provider value={actionsValue}>
      <ThemeColorsContext.Provider value={colorsValue}>
        {children}
      </ThemeColorsContext.Provider>
    </ThemeActionsContext.Provider>
  );
}

/** Subscribes to color changes. Re-renders the consumer on theme switch. */
export function useThemeColors(): ThemeColorsValue {
  return useContext(ThemeColorsContext);
}

/** Subscribes to actions only. Stable across theme switches — consumer
 *  does NOT re-render when scheme changes. Use this in components that
 *  only need to dispatch (e.g. the theme-toggle trigger row). */
export function useThemeActions(): ThemeActionsValue {
  return useContext(ThemeActionsContext);
}

/** Backward-compat alias — older call sites import `useThemeOverride`.
 *  Functionally identical to useThemeActions(). */
export function useThemeOverride(): ThemeActionsValue {
  return useThemeActions();
}

export { ThemeColorsContext, ThemeActionsContext };
