/**
 * PressableScale — unified press feedback wrapper.
 *
 * Round-3 followup (GPT verdict): every interactive should feel tactile,
 * not flat. scale 0.985 + spring release + brief opacity dip.
 *
 * Native path uses Reanimated 4 worklets (UI thread). Web override lives
 * in `pressable-scale.web.tsx` and uses CSS `transition` for the
 * compositor thread — see [[css-transition-over-reanimated-web]].
 *
 * Caller replaces `pressed && { opacity: 0.85 }` style entries with this
 * wrapper. Active/disabled visual states stay in caller-provided `style`.
 * `style` and animated transform live on the SAME element via
 * `createAnimatedComponent(Pressable)` so caller layout props (flex,
 * alignSelf) propagate correctly + scale visibly affects background/border.
 */

import type { ReactNode } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_IN = { damping: 18, stiffness: 320, mass: 0.4 };
const SPRING_OUT = { damping: 16, stiffness: 220, mass: 0.4 };

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Target scale on press-in. Default 0.985 (verdict-spec). 0.99 for large lists/rapid-fire surfaces. */
  scaleTo?: number;
  /** Target opacity on press-in. Default 0.88. */
  opacityTo?: number;
};

export function PressableScale({
  children,
  style,
  scaleTo = 0.985,
  opacityTo = 0.88,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  /* Only emit `opacity` while it's dimmed by a press — at rest let the
     caller's own `style.opacity` win. Otherwise a static `opacity: 1`
     here would override `disabled` callers that set 0.35 to gray out. */
  const animatedStyle = useAnimatedStyle(() => {
    const s: { transform: { scale: number }[]; opacity?: number } = {
      transform: [{ scale: scale.value }],
    };
    if (opacity.value < 1) s.opacity = opacity.value;
    return s;
  });

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) {
          scale.value = withSpring(scaleTo, SPRING_IN);
          opacity.value = withTiming(opacityTo, { duration: 60 });
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING_OUT);
        opacity.value = withTiming(1, { duration: 120 });
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
