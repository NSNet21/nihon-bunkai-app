import { useRouter, usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { FiArrowLeft } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from './themed-text';

import { Accent, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/context/theme';

type Tab = { href: string; label: string };

function BackButton({ onPress, colors }: { onPress: () => void; colors: typeof Colors.light }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel="กลับหน้า Browse"
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) });
          opacity.value = withTiming(0.85, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
          opacity.value = withTiming(1, { duration: 220 });
        }}
        style={[styles.backBtn, { borderColor: colors.border }]}
      >
        {({ hovered, pressed }: any) => {
          const active = hovered || pressed;
          return (
            <>
              {/* Left stripe — dims 55% by default, full crimson on hover. */}
              <View
                style={[
                  styles.backStripe,
                  { opacity: active ? 1 : 0.55 },
                  Platform.OS === 'web'
                    ? ({ transition: 'opacity 180ms ease' } as any)
                    : null,
                ]}
              />
              <View style={styles.backInner}>
                <FiArrowLeft size={13} color={active ? Accent.base : colors.textSecondary} />
                <ThemedText
                  style={[
                    styles.backMono,
                    { color: active ? Accent.base : colors.text },
                    Platform.OS === 'web'
                      ? ({ transition: 'color 180ms ease' } as any)
                      : null,
                  ]}
                >
                  BACK
                </ThemedText>
              </View>
            </>
          );
        }}
      </Pressable>
    </Animated.View>
  );
}

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
        onPressOut={() => { scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }); }}
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
  { href: '/shop',      label: 'Shop' },
  { href: '/search',    label: 'Search' },
  { href: '/settings',  label: 'Settings' },
];

/* Routes that enter focus mode — nav links hide, only Back button shows.
   Memorize + Quiz + Quiz Config are immersive study paths. Practice Hub
   (/deck/[id]) itself keeps nav so users can switch sections. */
const FOCUS_PATTERNS = [
  /^\/deck\/[^/]+\/(memorize|quiz|config)$/,
];

export function TopNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { scheme, colors } = useThemeColors();

  const isFocusMode = FOCUS_PATTERNS.some((re) => re.test(pathname));

  return (
    <SafeAreaView
      edges={['top']}
      style={{ backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <View style={styles.bar}>
        <View style={styles.inner}>
          <BrandLink onPress={() => router.push('/')} colors={colors} />
          {isFocusMode ? (
            <BackButton onPress={() => router.push('/')} colors={colors} />
          ) : (
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
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    alignItems: 'center',
    /* Disable text selection across the brand mark + tabs on web —
       click + drag was highlighting "Browse" / "Shop" etc. and the
       wordmark "日本分解 · NIHON BUNKAI". Propagates to all children
       via CSS inheritance; no-op on native. */
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as any) : null),
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 32,
    borderRadius: 0,           // sharp corners — editorial precision
    borderWidth: 1,
    overflow: 'hidden',
  },
  backStripe: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: Accent.base,
  },
  backInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  backMono: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  backDivider: {
    width: 1,
    height: 14,
    alignSelf: 'center',
  },
  backLabel: {
    fontSize: 13,
  },
});
