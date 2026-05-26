import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from './themed-text';

import { Accent, Colors, Radii, Spacing } from '@/constants/theme';
import { useThemeOverride, type ThemeOverride } from '@/context/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Segment = { value: ThemeOverride; glyph: string; label: string };

const SEGMENTS: Segment[] = [
  { value: 'system', glyph: '◐', label: 'อัตโนมัติ' },
  { value: 'light',  glyph: '☀', label: 'สว่าง' },
  { value: 'dark',   glyph: '☾', label: 'มืด' },
];

const TRACK_WIDTH = 264;
const SEGMENT_WIDTH = TRACK_WIDTH / SEGMENTS.length;

/**
 * Segmented control — pill slides between 3 states under the active option.
 * Tap any segment to select that override.
 */
export function ThemeToggle() {
  const { override, setOverride } = useThemeOverride();
  const effective = useColorScheme();
  const colors = (effective === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;

  /* Clamp selectedIndex — corrupt persisted override (e.g. legacy value) would
     return -1 and translate the pill to negative (off-track left), looking
     like a "jump to edge" bug. */
  const rawIndex = SEGMENTS.findIndex((s) => s.value === override);
  const selectedIndex = rawIndex < 0 ? 0 : rawIndex;
  const pillX = useSharedValue(selectedIndex * SEGMENT_WIDTH);

  useEffect(() => {
    /* cancelAnimation FIRST so rapid clicks don't accumulate velocity from
       the previous in-flight withTiming. Reanimated 4 preserves momentum
       across retargets, which compounds on rapid alternating clicks and
       sends the pill way off-track (saw tx=95000+ in stress test). */
    cancelAnimation(pillX);
    pillX.value = withTiming(selectedIndex * SEGMENT_WIDTH, {
      duration: 180,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
    });
  }, [selectedIndex, pillX]);

  /* Hard-clamp the rendered translateX to track bounds. Defensive guard
     against any upstream weirdness (Reanimated 4 momentum overshoot, React
     Compiler memoization quirks) that could push pillX off the visible
     track. The animation is still smooth — clamp only affects values that
     would render outside the track anyway. */
  const maxX = (SEGMENTS.length - 1) * SEGMENT_WIDTH;
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(0, Math.min(maxX, pillX.value)) }],
  }));

  return (
    <View style={styles.outer}>
      <View
        style={[
          styles.track,
          { borderColor: colors.border, backgroundColor: colors.backgroundElement },
        ]}>
        <Animated.View
          style={[
            styles.pill,
            { backgroundColor: Accent.base, width: SEGMENT_WIDTH - 4 },
            pillStyle,
          ]}
        />
        {SEGMENTS.map((seg) => {
          const isActive = seg.value === override;
          const fg = isActive ? '#ffffff' : colors.text;
          return (
            <Pressable
              key={seg.value}
              onPress={() => setOverride(seg.value)}
              style={({ pressed }) => [
                styles.segment,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`เลือกธีม: ${seg.label}`}
              accessibilityState={{ selected: isActive }}>
              <Text style={[styles.glyph, { color: fg }]}>{seg.glyph}</Text>
              <Text style={[styles.segLabel, { color: fg }]}>{seg.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        กำลังใช้: {effective === 'dark' ? 'มืด' : 'สว่าง'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { gap: Spacing.two, alignItems: 'flex-start' },
  track: {
    width: TRACK_WIDTH,
    height: 56,
    flexDirection: 'row',
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: 2,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: Radii.sm,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    zIndex: 1,
  },
  pressed: { opacity: 0.85 },
  glyph: { fontSize: 18, lineHeight: 22 },
  segLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
});
