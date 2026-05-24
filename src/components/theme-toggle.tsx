import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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

  const selectedIndex = SEGMENTS.findIndex((s) => s.value === override);
  const pillX = useSharedValue(selectedIndex * SEGMENT_WIDTH);

  useEffect(() => {
    pillX.value = withSpring(selectedIndex * SEGMENT_WIDTH, {
      damping: 18,
      stiffness: 220,
      mass: 0.6,
    });
  }, [selectedIndex, pillX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
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
    left: 2,
    height: 52,
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
