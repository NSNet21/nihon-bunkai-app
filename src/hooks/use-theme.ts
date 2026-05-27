import { useThemePalette } from '@/context/theme';

/**
 * Returns the active palette object — ThemedText / ThemedView read
 * through here. Routed via useThemePalette so on web the value is
 * a stable module-level constant of CSS-var strings; consumers do
 * NOT re-render on theme switch (CSS handles the visual swap).
 * Native path subscribes to scheme normally.
 */
export function useTheme() {
  return useThemePalette();
}
