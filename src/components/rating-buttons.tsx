import { Pressable, StyleSheet, View } from 'react-native';
import { Rating } from 'ts-fsrs';

import { useThemeColors } from '@/context/theme';

import { ThemedText } from './themed-text';

import { Radii, RateColors, Spacing } from '@/constants/theme';

/** Map FSRS Rating enum → Thai microcopy + semantic color key. */
const BUTTONS = [
  { rating: Rating.Again, label: 'ลืม',     colorKey: 'again' as const },
  { rating: Rating.Hard,  label: 'ยาก',     colorKey: 'hard'  as const },
  { rating: Rating.Good,  label: 'เข้าใจ', colorKey: 'good'  as const },
  { rating: Rating.Easy,  label: 'ง่าย',   colorKey: 'easy'  as const },
];

type Props = {
  onRate: (rating: Rating) => void;
  disabled?: boolean;
};

export function RatingButtons({ onRate, disabled = false }: Props) {
  const { scheme } = useThemeColors();
  const palette = RateColors[scheme];

  return (
    <View style={styles.row} accessibilityRole="toolbar">
      {BUTTONS.map((btn) => {
        const fg = palette[`${btn.colorKey}Fg`];
        const bg = palette[`${btn.colorKey}Bg`];
        return (
          <Pressable
            key={btn.label}
            onPress={() => !disabled && onRate(btn.rating)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: bg },
              pressed && !disabled && styles.pressed,
              disabled && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={btn.label}>
            <ThemedText type="defaultSemiBold" style={{ color: fg }}>
              {btn.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.35 },
});
