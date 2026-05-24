import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemeOverride } from '@/context/theme';

/**
 * Returns the effective color scheme — honoring manual override from
 * ThemeContext, falling back to the system / OS scheme.
 */
export function useColorScheme() {
  const { override } = useThemeOverride();
  const system = useRNColorScheme();
  if (override === 'light' || override === 'dark') return override;
  return system;
}
