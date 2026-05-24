import { useRouter, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from './themed-text';

import { Accent, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Tab = { href: string; label: string };

function BrandLink({ onPress, colors }: { onPress: () => void; colors: typeof Colors.light }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel="กลับหน้า Browse"
        // @ts-ignore web tooltip
        title="Browse"
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 220, easing: Easing.back(1.4) }); }}
        style={({ pressed, hovered }: any) => [
          styles.brand,
          hovered && { opacity: 0.7 },
          pressed && { opacity: 0.5 },
        ]}>
        <ThemedText type="defaultSemiBold" style={{ color: Accent.base, letterSpacing: 1 }}>
          日本分解
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ letterSpacing: 1.5 }}>
          · NIHON BUNKAI
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const TABS: Tab[] = [
  { href: '/',          label: 'Browse' },
  { href: '/study',     label: 'Study' },
  { href: '/shop',      label: 'Shop' },
  { href: '/search',    label: 'Search' },
  { href: '/settings',  label: 'Settings' },
];

export function TopNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;

  return (
    <SafeAreaView
      edges={['top']}
      style={{ backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <View style={styles.bar}>
        <View style={styles.inner}>
          <BrandLink onPress={() => router.push('/')} colors={colors} />
          <View style={styles.tabs}>
            {TABS.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Pressable
                  key={tab.href}
                  onPress={() => router.push(tab.href as any)}
                  style={({ pressed, hovered }: any) => [
                    styles.tab,
                    {
                      backgroundColor: isActive ? Accent.base : 'transparent',
                    },
                    hovered && !isActive && { backgroundColor: colors.backgroundElement },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <ThemedText
                    type={isActive ? 'defaultSemiBold' : 'default'}
                    style={{ color: isActive ? '#ffffff' : colors.text, fontSize: 13, lineHeight: 13, textAlign: 'center', includeFontPadding: false } as any}>
                    {tab.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.four,
    flexWrap: 'wrap',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
  tab: {
    paddingHorizontal: Spacing.two,
    minHeight: 32,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.sm,
  },
});
