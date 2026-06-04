import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FiArrowLeft } from 'react-icons/fi';

import { ThemedText } from './themed-text';

import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { useHasHydrated } from '@/hooks/use-has-hydrated';
import { navigateBackOrFallback } from '@/lib/navigation-back';

const MOBILE_NAV_BREAKPOINT = 768;

export function StudyMobileBackButton({
  fallbackHref,
  floating = true,
  side = 'left',
  inset,
}: {
  fallbackHref: string;
  floating?: boolean;
  side?: 'left' | 'right';
  inset?: { top?: number; horizontal?: number };
}) {
  const router = useRouter();
  const colors = useThemePalette();
  const { width } = useWindowDimensions();
  const hasHydrated = useHasHydrated();
  const isMobile = hasHydrated && width < MOBILE_NAV_BREAKPOINT;

  if (!isMobile) return null;

  return (
    <Pressable
      onPress={() => navigateBackOrFallback(
        {
          canGoBack: () => router.canGoBack(),
          back: () => router.back(),
          push: (href) => router.push(href as never),
        },
        fallbackHref,
      )}
      accessibilityRole="button"
      accessibilityLabel="กลับไปหน้าก่อนหน้า"
      style={({ pressed, hovered }: any) => {
        const active = pressed || hovered;
        return [
          styles.button,
          floating ? [styles.floating, side === 'right' ? styles.floatingRight : styles.floatingLeft] : styles.inline,
          floating && inset?.top !== undefined ? { top: inset.top } : null,
          floating && inset?.horizontal !== undefined
            ? side === 'right'
              ? { right: inset.horizontal }
              : { left: inset.horizontal }
            : null,
          {
            backgroundColor: colors.background,
            borderColor: active ? Accent.base : colors.border,
          },
          pressed && { opacity: 0.78 },
        ];
      }}
    >
      {({ pressed, hovered }: any) => {
        const active = pressed || hovered;
        const fg = active ? Accent.base : colors.textSecondary;
        return (
          <>
            <View style={[styles.stripe, { opacity: active ? 1 : 0.58 }]} />
            <View style={styles.inner}>
              <FiArrowLeft size={14} color={fg} strokeWidth={2} />
              <ThemedText style={[styles.label, { color: active ? Accent.base : colors.text }]}>
                BACK
              </ThemedText>
            </View>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as any) : null),
  },
  floating: {
    position: 'absolute',
    top: Spacing.two,
    zIndex: 50,
  },
  floatingLeft: {
    left: Spacing.two,
  },
  floatingRight: {
    right: Spacing.two,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  stripe: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: Accent.base,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  label: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
});
