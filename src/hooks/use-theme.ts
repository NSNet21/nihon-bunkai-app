import { useThemeColors } from '@/context/theme';

/**
 * Returns the active palette object (Colors.light or Colors.dark) — a
 * stable reference between renders of the same scheme. ThemedText /
 * ThemedView read through here.
 */
export function useTheme() {
  return useThemeColors().colors;
}
