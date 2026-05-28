import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SearchShortcut } from '@/components/search-shortcut';
import { ToastProvider } from '@/components/toast';
import { AuthProvider } from '@/context/auth';
import { ThemeProvider as AppThemeProvider } from '@/context/theme';
import { useThemeColors } from '@/context/theme';
import { requestPersistentStorage } from '@/lib/persistent-storage';

/* First-run gate. Reads nb.onboarded synchronously on mount and redirects to
   /onboarding/welcome when missing. Lives at root so it covers every entry
   path (direct deep link, bookmark, magic-link return). Splash overlay
   hides the brief flash before the redirect commits. */
function OnboardingGate() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    let onboarded = false;
    try {
      onboarded = window.localStorage.getItem('nb.onboarded') === 'true';
    } catch {
      onboarded = true; /* localStorage blocked → don't trap user in onboarding */
    }
    const root = segments[0];
    const inOnboarding = root === 'onboarding';
    /* Login must stay reachable even when not yet onboarded, otherwise the
       SIGN IN link on the welcome screen would redirect right back to it. */
    const inAuthFlow = root === 'login';
    if (!onboarded && !inOnboarding && !inAuthFlow) {
      router.replace('/onboarding/welcome');
    }
  }, [segments, router]);

  return null;
}

function ThemedRoot() {
  const { scheme: colorScheme } = useThemeColors();

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
      <SearchShortcut />
      <OnboardingGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="group-picker" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* SafeAreaProvider must wrap useSafeAreaInsets() consumers
          (onboarding + group-picker sticky CTAs read insets.bottom
          via the hook added in the round-3 followup polish). */}
      <SafeAreaProvider>
        <AppThemeProvider>
          {/* ToastProvider above AuthProvider so auth can show toasts on
              entitlement-load failures. ToastProvider has no auth dependency. */}
          <ToastProvider>
            <AuthProvider>
              <ThemedRoot />
            </AuthProvider>
          </ToastProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
