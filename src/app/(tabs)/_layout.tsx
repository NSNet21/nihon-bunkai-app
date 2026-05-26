import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { TopNavBar } from '@/components/top-nav-bar';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <TopNavBar />
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}>
          <Tabs.Screen name="index"    options={{ title: 'Browse' }} />
          <Tabs.Screen name="shop"     options={{ title: 'Shop' }} />
          <Tabs.Screen name="search"   options={{ title: 'Search' }} />
          <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
        </Tabs>
      </View>
    </View>
  );
}
