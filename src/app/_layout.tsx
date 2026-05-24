import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ToastProvider } from '@/components/toast';
import { AuthProvider } from '@/context/auth';
import { ThemeProvider as AppThemeProvider } from '@/context/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestPersistentStorage } from '@/lib/persistent-storage';

function ThemedRoot() {
  const colorScheme = useColorScheme();

  /* Sync React theme → HTML data-theme so CSS variables (scrollbar, markdown) switch. */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', colorScheme === 'dark' ? 'dark' : 'light');
  }, [colorScheme]);

  /* Ask browser to keep IndexedDB cache (paid content) across storage pressure. */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    void requestPersistentStorage();
  }, []);

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
        <ToastProvider>
          <ThemedRoot />
        </ToastProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}
