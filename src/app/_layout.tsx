import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from 'expo-router';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ThemeProvider as AppThemeProvider } from '@/context/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function ThemedRoot() {
  const colorScheme = useColorScheme();
  return (
    <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </NavThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <AppThemeProvider>
      <ThemedRoot />
    </AppThemeProvider>
  );
}
