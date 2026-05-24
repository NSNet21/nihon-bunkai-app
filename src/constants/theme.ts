/**
 * NIHON BUNKAI — Companion App theme tokens
 * Ported from landing/src/styles/tokens.css (v3 LOCKED).
 * Source of truth for app brand: [[app-visual-identity]] memory.
 */

import '@/global.css';

import { Platform } from 'react-native';

/* Brand accent — single crimson (NOT per-level).
   Matches landing --accent. */
export const Accent = {
  base: '#e0202c',
  strong: '#c01825',
  bg: 'rgba(224, 32, 44, 0.14)',
  soft: 'rgba(224, 32, 44, 0.40)',
} as const;

/* Light (Wabi cream) — default. Dark (Editorial warm-charcoal) — toggle. */
export const Colors = {
  light: {
    bg: '#faf6f0',
    surface: '#ffffff',
    surface2: '#f3eee6',
    surface3: '#ebe4d7',
    border: '#d8d1c4',
    borderStrong: '#b8af9e',
    text: '#14110e',
    textMuted: '#5e564e',
    textHint: '#8a8278',
    /* Boilerplate-compat aliases (used by themed-view / themed-text) */
    background: '#faf6f0',
    backgroundElement: '#f3eee6',
    backgroundSelected: '#ebe4d7',
    textSecondary: '#5e564e',
  },
  dark: {
    bg: '#141210',
    surface: '#1b1816',
    surface2: '#211d1a',
    surface3: '#2a2620',
    border: '#3a342e',
    borderStrong: '#524a42',
    text: '#f0ebe2',
    textMuted: '#bfb8ae',
    textHint: '#78726a',
    background: '#141210',
    backgroundElement: '#1b1816',
    backgroundSelected: '#211d1a',
    textSecondary: '#bfb8ae',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/* FSRS rating semantic — 4 buttons (landing ports 3, "easy" added here).
   ลืม / ยาก / เข้าใจ / ง่าย */
export const RateColors = {
  light: {
    againFg: '#b5604a', againBg: '#f5e8e3',
    hardFg:  '#b58c40', hardBg:  '#f5ecdb',
    goodFg:  '#6f8056', goodBg:  '#ecefe1',
    easyFg:  '#5a7a4a', easyBg:  '#e0e8d4', // TBD — pending GPT review
  },
  dark: {
    againFg: '#ff6855', againBg: 'rgba(181, 96, 74, 0.16)',
    hardFg:  '#e0aa55', hardBg:  'rgba(181, 140, 64, 0.16)',
    goodFg:  '#a8c080', goodBg:  'rgba(168, 192, 128, 0.12)',
    easyFg:  '#88a868', easyBg:  'rgba(90, 122, 74, 0.16)',
  },
} as const;

/* Spacing — landing sp-* scale (existing names preserved for boilerplate). */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  /* Additional landing scale */
  sp5: 20,
  sp8: 32,
  sp10: 40,
  sp12: 44,
  sp16: 56,
  sp20: 72,
} as const;

/* Sharp radii only — pill for toggle pills. NO 8/12/16. */
export const Radii = {
  sm: 3,
  md: 4,
  pill: 999,
} as const;

/* Type scale (px) — landing baseline. */
export const FontSize = {
  xs: 9, sm: 11, base: 13, md: 15,
  lg: 18, xl: 24, xxl: 32, xxxl: 48,
  display: 54, hero: 96,
} as const;

/* Fonts — multi-script. Native uses system fallbacks (expo-font load later);
   web uses CSS var stack defined in global.css. */
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
    display: 'Oswald-Bold', // requires expo-font load
    jp: 'NotoSerifJP-Regular',
    th: 'Sarabun-Regular',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
    display: 'sans-serif',
    jp: 'serif',
    th: 'sans-serif',
  },
  web: {
    sans: 'var(--ff-ui)',
    serif: 'var(--ff-jp)',
    rounded: 'var(--ff-ui)',
    mono: 'var(--ff-mono)',
    display: 'var(--ff-display)',
    jp: 'var(--ff-jp)',
    th: 'var(--ff-th)',
  },
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
