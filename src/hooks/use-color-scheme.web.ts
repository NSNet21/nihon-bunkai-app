import { useThemeColors } from '@/context/theme';

/**
 * Web variant — identical to native via the unified ThemeColorsContext.
 * Hydration guard now lives in the provider itself, so the web/.web split
 * is no longer doing extra work. Kept as a file for the platform resolver.
 */
export function useColorScheme() {
  return useThemeColors().scheme;
}
