/**
 * Theme context — three-context split to minimize fan-out re-renders.
 *
 *   ThemePaletteContext — { colors }            · STABLE on web (CSS vars).
 *                                                  Changes on native theme switch.
 *   ThemeColorsContext  — { scheme, colors }    · changes on switch (back-compat)
 *   ThemeActionsContext — { override, setters } · stable across re-renders
 *
 * Why the extra ThemePaletteContext (added 2026-05-27 for the
 * heavy-data perf rework): on web, theme colors map to CSS variables
 * — the visual swap happens at the CSS layer, no React reconcile
 * needed. ThemePaletteContext's value is a frozen module-level
 * constant on web, so React.Context's strict equality check skips
 * the subscriber wakeup entirely. ThemedText / ThemedView read
 * through useTheme() → useThemePalette() → ZERO re-renders on web
 * theme switch.
 *
 * Components that need scheme (e.g. _layout.tsx setting the
 * data-theme attribute) still use useThemeColors() and re-render
 * normally — that's the one place where re-render is the goal.
 *
 * useThemeOverride() is kept as a thin alias to useThemeActions()
 * for backward compat — no call site needs to change urgently.
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
import { Platform, useColorScheme as useRNColorScheme } from 'react-native';

import { usePersistedState } from '@/hooks/use-persisted-state';
import { Colors } from '@/constants/theme';

/* CSS-var palette for web — keys mirror ThemeColors shape. Each value
   resolves at the CSS layer via global.css's :root / [data-theme="dark"]
   var definitions. Frozen module-level constant so the Provider
   value below is referentially stable across renders. */
const WEB_COLORS = Object.freeze({
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surface2: 'var(--surface-2)',
  surface3: 'var(--surface-3)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  text: 'var(--text)',
  textMuted: 'var(--text-muted)',
  textHint: 'var(--text-hint)',
  background: 'var(--bg)',
  backgroundElement: 'var(--surface-2)',
  backgroundSelected: 'var(--surface-3)',
  textSecondary: 'var(--text-muted)',
}) as unknown as typeof Colors.light;

export type ThemeOverride = 'system' | 'light' | 'dark';
export type EffectiveScheme = 'light' | 'dark';
export type ThemeColors = typeof Colors.light;

interface ThemePaletteValue {
  colors: ThemeColors;
}

interface ThemeColorsValue {
  scheme: EffectiveScheme;
  colors: ThemeColors;
}

interface ThemeActionsValue {
  override: ThemeOverride;
  setOverride: (next: ThemeOverride) => void;
  toggle: () => void;
}

/* Stable web palette context value — module-level constant on web
   means React.Context skips the subscriber wakeup entirely on
   theme switch (CSS handles the visual swap via var lookups). */
const WEB_PALETTE_VALUE: ThemePaletteValue = { colors: WEB_COLORS };

const ThemePaletteContext = createContext<ThemePaletteValue>({ colors: Colors.light });

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

  /* Cast widens Colors[scheme] (union of light|dark literal types) to the
     light-shaped ThemeColors. Runtime values share the same key shape;
     literal-type mismatch is purely a TS artifact of `as const` color defs. */
  const colors = useMemo(() => Colors[scheme] as ThemeColors, [scheme]);

  const colorsValue = useMemo<ThemeColorsValue>(
    () => ({ scheme, colors }),
    [scheme, colors],
  );

  /* On web: stable module-level constant — context never fires update,
     subscribers never re-render. CSS vars on :root handle the visual
     swap when data-theme changes (set by ThemedRoot in _layout.tsx).
     On native: tracks the computed palette per scheme (re-renders). */
  const paletteValue = useMemo<ThemePaletteValue>(
    () => (Platform.OS === 'web' ? WEB_PALETTE_VALUE : { colors }),
    [colors],
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
      <ThemePaletteContext.Provider value={paletteValue}>
        <ThemeColorsContext.Provider value={colorsValue}>
          {children}
        </ThemeColorsContext.Provider>
      </ThemePaletteContext.Provider>
    </ThemeActionsContext.Provider>
  );
}

/** Subscribes to color changes. Re-renders the consumer on theme switch.
 *  Use only when you need the `scheme` field too (rare). For colors-only
 *  consumers (the common case — ThemedText/ThemedView via useTheme),
 *  prefer useThemePalette() which is no-op on web. */
export function useThemeColors(): ThemeColorsValue {
  return useContext(ThemeColorsContext);
}

/** Subscribes to the colors palette only. On WEB this context value
 *  is a stable module-level constant whose values are CSS-var strings
 *  (var(--text), var(--bg), etc.) — React.Context skips the subscriber
 *  wakeup, the visual swap happens in CSS. On NATIVE it tracks the
 *  current scheme's palette and re-renders consumers on theme switch.
 *
 *  The default export `useTheme` routes through here, so ThemedText
 *  and ThemedView automatically benefit. */
export function useThemePalette(): ThemeColors {
  return useContext(ThemePaletteContext).colors;
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

export { ThemePaletteContext, ThemeColorsContext, ThemeActionsContext };
