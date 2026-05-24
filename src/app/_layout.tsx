import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/auth';
import { ThemeProvider as AppThemeProvider } from '@/context/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function ThemedRoot() {
  const colorScheme = useColorScheme();

  /* Sync React theme → HTML data-theme so CSS variables (scrollbar, markdown) switch. */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', colorScheme === 'dark' ? 'dark' : 'light');
  }, [colorScheme]);

  return (
    <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <ThemedRoot />
      </AuthProvider>
    </AppThemeProvider>
  );
}
