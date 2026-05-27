/**
 * OnboardingSteps — 3-dot step indicator used at the top of each
 * onboarding screen. Roman numerals (I · II · III) with thin connectors;
 * the active + completed dots fill with brand accent.
 *
 * Pattern matches design/handoff-app/Nihon Bunkai - Screens v3.html
 * lines 2060-2067, 2147-2153, 2250-2257.
 */

import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';

const STEPS = ['I', 'II', 'III'] as const;

export function OnboardingSteps({ current }: { current: 1 | 2 | 3 }) {
  const colors = useThemePalette();

  return (
    <View style={styles.row}>
      {STEPS.map((label, i) => {
        const idx = i + 1;
        const filled = idx <= current;
        return (
          <View key={label} style={styles.cluster}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: filled ? Accent.base : 'transparent',
                  borderColor: filled ? Accent.base : colors.border,
                },
              ]}>
              <ThemedText
                style={[
                  styles.dotLabel,
                  { color: filled ? '#fff' : colors.textHint },
                ]}>
                {label}
              </ThemedText>
            </View>
            {idx < STEPS.length && (
              <View
                style={[
                  styles.line,
                  { backgroundColor: idx < current ? Accent.base : colors.border },
                ]}
              />
            )}
          </View>
        );
      })}
      <ThemedText
        type="small"
        themeColor="textHint"
        style={styles.meta}>
        STEP {String(current).padStart(2, '0')} / 03
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLabel: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  line: {
    width: 24,
    height: 1,
  },
  meta: {
    marginLeft: 'auto',
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    letterSpacing: 1.2,
  },
});
