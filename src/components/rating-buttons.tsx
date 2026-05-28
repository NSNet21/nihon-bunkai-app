import { StyleSheet, View } from 'react-native';
import { Rating } from 'ts-fsrs';

import { useThemeColors } from '@/context/theme';

import { PressableScale } from './pressable-scale';
import { ThemedText } from './themed-text';

import { Radii, RateColors, Spacing } from '@/constants/theme';

/** Map FSRS Rating enum → Thai microcopy + semantic color key.
 *  All 4 buttons equal width per GPT polish round-2 verdict 2026-05-27:
 *  the 1.15x emphasis on "เข้าใจ" (tried in round-1) was too subtle to
 *  read but enough to break the 4-button rhythm — fell into the "changed
 *  but not enough to feel" zone. Consistency wins. FSRS decision-making
 *  is too consequential to nudge with width. */
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
          <PressableScale
            key={btn.label}
            onPress={() => !disabled && onRate(btn.rating)}
            disabled={disabled}
            /* Lighter scale on FSRS rating buttons — these are pressed
               rapid-fire and full 0.985 reads as "jumpy" at high cadence. */
            scaleTo={0.99}
            opacityTo={0.9}
            style={[
              styles.button,
              { backgroundColor: bg },
              disabled && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={btn.label}>
            <ThemedText type="defaultSemiBold" style={{ color: fg }}>
              {btn.label}
            </ThemedText>
          </PressableScale>
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
  disabled: { opacity: 0.35 },
});
