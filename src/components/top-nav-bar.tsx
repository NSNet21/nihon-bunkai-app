import { useRouter, usePathname, router as imperativeRouter } from 'expo-router';
import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FiArrowLeft, FiBookOpen, FiSettings, FiShoppingBag } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from './themed-text';

import { Accent, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { useHasHydrated } from '@/hooks/use-has-hydrated';

type Tab = { href: string; label: string };
type MobileTab = Tab & { Icon: typeof FiBookOpen };

const MOBILE_NAV_BREAKPOINT = 768;

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

const MOBILE_TABS: MobileTab[] = [
  { href: '/',          label: 'Browse',   Icon: FiBookOpen },
  { href: '/shop',      label: 'Shop',     Icon: FiShoppingBag },
  { href: '/settings',  label: 'Settings', Icon: FiSettings },
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
  const colors = useThemePalette();
  const { width } = useWindowDimensions();
  const hasHydrated = useHasHydrated();

  const isFocusMode = FOCUS_PATTERNS.some((re) => re.test(pathname));
  const isMobile = hasHydrated && width < MOBILE_NAV_BREAKPOINT;

  /* Track which routes we've already kicked a prefetch on so hovering
     the same tab twice doesn't fire repeat fetches. Cleared only on
     full reload — the warmed module cache stays valid for the session. */
  const prefetched = useRef<Set<string>>(new Set());
  const handleHover = (href: string) => {
    if (Platform.OS !== 'web') return;
    if (href === pathname) return;
    if (prefetched.current.has(href)) return;
    prefetched.current.add(href);
    imperativeRouter.prefetch(href as any);
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={{ backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <View style={styles.bar}>
        <View style={styles.inner}>
          <BrandLink onPress={() => router.push('/')} colors={colors} />
          {isFocusMode ? (
            <BackButton onPress={() => router.push('/')} colors={colors} />
          ) : !isMobile ? (
            <View style={styles.tabs}>
              {TABS.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                  <Pressable
                    key={tab.href}
                    onPress={() => router.push(tab.href as any)}
                    onHoverIn={() => handleHover(tab.href)}
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
          ) : (
            <View style={styles.mobileBrandRule} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const colors = useThemePalette();
  const { width } = useWindowDimensions();
  const hasHydrated = useHasHydrated();
  const isMobile = hasHydrated && width < MOBILE_NAV_BREAKPOINT;

  if (!isMobile) return null;

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.mobileNavSafe, { backgroundColor: colors.background, borderTopColor: colors.border }]}
    >
      <View style={styles.mobileNavInner}>
        {MOBILE_TABS.map((tab) => {
          const isActive = tab.href === '/' ? pathname === '/' : pathname === tab.href;
          const color = isActive ? Accent.base : colors.textSecondary;
          const Icon = tab.Icon;
          return (
            <Pressable
              key={tab.href}
              onPress={() => router.push(tab.href as any)}
              accessibilityRole="link"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              {...(Platform.OS === 'web'
                ? ({ 'aria-current': isActive ? 'page' : undefined, 'data-active': isActive ? 'true' : 'false' } as any)
                : null)}
              style={({ pressed }) => [
                styles.mobileNavItem,
                isActive && styles.mobileNavItemActive,
                pressed && { opacity: 0.65 },
              ]}
            >
              <View
                style={[
                  styles.mobileNavActiveRail,
                  { opacity: isActive ? 1 : 0, backgroundColor: Accent.base },
                ]}
              />
              <Icon size={19} color={color} />
              <ThemedText
                style={[
                  styles.mobileNavLabel,
                  { color },
                  isActive && styles.mobileNavLabelActive,
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
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
  mobileBrandRule: {
    width: 28,
    height: 1,
    backgroundColor: Accent.base,
    opacity: 0.75,
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
  mobileNavSafe: {
    borderTopWidth: StyleSheet.hairlineWidth,
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as any) : null),
  },
  mobileNavInner: {
    minHeight: 58,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  mobileNavItem: {
    position: 'relative',
    minWidth: 74,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  mobileNavItemActive: {
    backgroundColor: Accent.bg,
  },
  mobileNavActiveRail: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 2,
  },
  mobileNavLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  mobileNavLabelActive: {
    fontWeight: '800',
  },
});
