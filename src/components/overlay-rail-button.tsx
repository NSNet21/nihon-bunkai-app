/**
 * OverlayRailButton — edge-anchored prev/next button used on study
 * cards (Quiz flashcard + Memorize body).
 *
 * Behavior:
 *  - Absolute-positioned to the card's left or right edge (`side`).
 *  - IDLE opacity = 0 (fully transparent affordance).
 *  - onPressIn snaps to opacity 1; onPressOut fades back to 0 after
 *    90ms hold + 520ms ease.
 *  - Pressable hit-testing ignores opacity, so the tap column always
 *    works even when invisible.
 *  - Background = directional gradient (light: warm-charcoal tint,
 *    dark: white tint). Native fallback = flat solid tint.
 *  - bgFill width can exceed the Pressable column so the fade has
 *    more horizontal room than the tap target.
 *
 * Extracted from quiz.tsx 2026-05-27 to share with Memorize.
 */

import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { Colors } from '@/constants/theme';

const IDLE_OPACITY = 0;

export function OverlayRailButton({
  direction,
  side,
  onPress,
  disabled,
  colors,
  width,
  iconSize,
  fillWidth,
  isDark,
}: {
  direction: 'left' | 'right';
  side: 'left' | 'right';
  onPress: () => void;
  disabled: boolean;
  colors: typeof Colors.light;
  width: number;
  iconSize: number;
  /** Visible gradient layer width. Can exceed `width` (the tap column)
   *  so the fade has more horizontal room than the tap target. */
  fillWidth: number;
  /** Light needs DARK tint (white-on-cream is barely visible);
   *  dark needs WHITE tint. Caller resolves scheme. */
  isDark: boolean;
}) {
  const opacity = useSharedValue(IDLE_OPACITY);
  const Icon = direction === 'left' ? FiChevronLeft : FiChevronRight;
  const ariaLabel = direction === 'left' ? 'Previous card' : 'Next card';

  const rgb = isDark ? '255, 255, 255' : '20, 18, 16';
  const peakAlpha = isDark ? 0.42 : 0.22;
  const direction_css = direction === 'left' ? 'to right' : 'to left';
  const overlayBg = Platform.select({
    web: {
      backgroundImage: `linear-gradient(${direction_css}, rgba(${rgb}, ${peakAlpha}) 0%, rgba(${rgb}, 0) 100%)`,
    } as object,
    default: { backgroundColor: `rgba(${rgb}, ${isDark ? 0.18 : 0.10})` },
  });

  function handlePressIn() {
    if (disabled) return;
    opacity.value = withTiming(1, { duration: 0 });
  }

  function handlePressOut() {
    opacity.value = withDelay(
      90,
      withTiming(IDLE_OPACITY, { duration: 520, easing: Easing.bezier(0.4, 0, 1, 1) }),
    );
  }

  function handlePress() {
    if (disabled) return;
    onPress();
  }

  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      style={[overlayRailStyles.btn, { [side]: 0, width }]}>
      <Animated.View
        style={[overlayRailStyles.bgFill, overlayBg, aStyle, { [side]: 0, width: fillWidth, pointerEvents: 'none' }]}
      />
      <Animated.View style={[overlayRailStyles.iconBox, aStyle, { pointerEvents: 'none' }]}>
        <Icon size={iconSize} color={colors.textSecondary} strokeWidth={1.5} />
      </Animated.View>
    </Pressable>
  );
}

const overlayRailStyles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bgFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  iconBox: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
