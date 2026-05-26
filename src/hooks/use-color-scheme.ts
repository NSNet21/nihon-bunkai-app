import { useThemeColors } from '@/context/theme';

/**
 * Returns the effective color scheme — honoring manual override from
 * ThemeContext, falling back to the system / OS scheme. Reads from the
 * memoized ThemeColorsContext so override-only re-renders are skipped
 * by React when the scheme value hasn't actually flipped.
 */
export function useColorScheme() {
  return useThemeColors().scheme;
}
