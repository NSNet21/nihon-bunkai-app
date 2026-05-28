import { Tabs } from 'expo-router';

import { Accent } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';

export default function AppTabs() {
  const colors = useThemePalette();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Accent.base,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      }}>
      <Tabs.Screen name="index"    options={{ title: 'Browse' }} />
      <Tabs.Screen name="study"    options={{ title: 'Study' }} />
      <Tabs.Screen name="shop"     options={{ title: 'Shop' }} />
      <Tabs.Screen name="search"   options={{ title: 'Search' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
