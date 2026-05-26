/**
 * Layout for /deck/* routes — wraps Practice Hub and its sub-routes
 * (memorize / quiz / config) with the TopNavBar so the brand + tabs
 * are visible. TopNavBar itself handles focus-mode hiding for the
 * immersive study screens via its FOCUS_PATTERNS regex, so Memorize +
 * Quiz + Config still get the "minimal" header treatment.
 *
 * Why a separate layout: /deck/* sits outside the (tabs) group (its
 * URLs aren't tabs), so without this file it would render WITHOUT the
 * brand bar — which made Practice Hub feel disconnected from Browse.
 */

import { Stack } from 'expo-router';
import { View } from 'react-native';

import { TopNavBar } from '@/components/top-nav-bar';

export default function DeckLayout() {
  return (
    <View style={{ flex: 1 }}>
      <TopNavBar />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}
