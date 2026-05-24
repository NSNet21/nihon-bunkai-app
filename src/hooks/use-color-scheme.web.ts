import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemeOverride } from '@/context/theme';

/**
 * Web variant — same override-aware behavior, plus hydration guard to keep
 * SSR output consistent with client (boilerplate behavior preserved).
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const { override } = useThemeOverride();
  const system = useRNColorScheme();

  if (!hasHydrated) return 'light';
  if (override === 'light' || override === 'dark') return override;
  return system;
}
