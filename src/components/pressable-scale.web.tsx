/**
 * PressableScale (web) — inline CSS transition path.
 *
 * Picked automatically by Metro on web. Native counterpart uses
 * Reanimated worklets. Web path avoids Reanimated's JS-thread cost
 * on web by binding transform/opacity to a `pressed` state and
 * letting the CSS compositor interpolate.
 *
 * `style` lives on the outer Pressable so caller layout props (flex,
 * alignSelf) propagate and the scale visibly affects background/border.
 *
 * See [[css-transition-over-reanimated-web]] for the rationale and
 * Settings toggle precedent in pace.tsx.
 */

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  scaleTo?: number;
  opacityTo?: number;
};

const TRANSITION = {
  transition: 'transform 140ms cubic-bezier(0.2, 0, 0, 1), opacity 80ms ease',
} as unknown as ViewStyle;

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
  const [pressed, setPressed] = useState(false);
  const active = pressed && !disabled;

  /* Merge caller-style with press transform. RN Web flattens the array
     and forwards `transition` straight to the rendered div, so the
     browser compositor handles transform/opacity interpolation.
     `opacity` is only emitted while a press is active — at rest the
     caller's own `style.opacity` wins, so `disabled` callers that
     set 0.35 still gray out correctly. */
  const composed = useMemo(
    () => [
      style,
      TRANSITION,
      active
        ? { transform: [{ scale: scaleTo }], opacity: opacityTo }
        : { transform: [{ scale: 1 }] },
    ],
    [style, active, scaleTo, opacityTo],
  );

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={StyleSheet.flatten(composed) as StyleProp<ViewStyle>}
      {...rest}>
      {children}
    </Pressable>
  );
}
