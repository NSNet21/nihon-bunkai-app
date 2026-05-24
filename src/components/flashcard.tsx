import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { useColorScheme } from '@/hooks/use-color-scheme';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { ThemedText } from './themed-text';

import { Colors, Radii, Spacing } from '@/constants/theme';
import type { Entry } from '@/data/types';

type Props = {
  entry: Entry;
  isFlipped: boolean;
  onFlip: () => void;
};

const FLIP_DURATION = 500;

export function Flashcard({ entry, isFlipped, onFlip }: Props) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;

  const rotation = useSharedValue(isFlipped ? 180 : 0);

  useEffect(() => {
    rotation.value = withTiming(isFlipped ? 180 : 0, {
      duration: FLIP_DURATION,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [isFlipped, rotation]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${rotation.value}deg` },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${rotation.value + 180}deg` },
    ],
  }));

  return (
    <Pressable
      onPress={onFlip}
      style={({ pressed }) => [styles.cardPress, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={isFlipped ? 'แตะเพื่อกลับด้านหน้า' : 'แตะเพื่อดูคำตอบ'}>
      <View style={styles.cardWrapper}>
        {/* Front face */}
        <Animated.View
          style={[
            styles.face,
            { backgroundColor: colors.backgroundElement },
            frontStyle,
          ]}>
          <View style={styles.faceContent}>
            <ThemedText style={styles.term}>{entry.t}</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.pronunciation}>
              {entry.p}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              แตะเพื่อดูคำตอบ
            </ThemedText>
          </View>
        </Animated.View>

        {/* Back face */}
        <Animated.View
          style={[
            styles.face,
            { backgroundColor: colors.backgroundElement },
            backStyle,
          ]}>
          <View style={styles.faceContent}>
            <ThemedText type="title" style={styles.meaning}>
              {entry.d}
            </ThemedText>
            <View style={styles.markdownWrap}>
              <Markdown style={markdownStyles(colors)}>{entry.e}</Markdown>
            </View>
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const CARD_MIN_HEIGHT = 360;

const styles = StyleSheet.create({
  cardPress: { width: '100%' },
  pressed: { opacity: 0.95 },
  cardWrapper: {
    width: '100%',
    minHeight: CARD_MIN_HEIGHT,
  },
  face: {
    position: 'absolute',
    width: '100%',
    minHeight: CARD_MIN_HEIGHT,
    padding: Spacing.six,
    borderRadius: Radii.md,
    backfaceVisibility: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceContent: { gap: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  term: { fontSize: 64, lineHeight: 80, textAlign: 'center' },
  pronunciation: { fontSize: 18 },
  hint: { opacity: 0.6, marginTop: Spacing.two },
  meaning: { textAlign: 'center', marginBottom: Spacing.two },
  markdownWrap: { alignSelf: 'stretch' },
});

/* Markdown styles — adapt to active theme */
function markdownStyles(colors: typeof Colors.light) {
  return {
    body:        { color: colors.text, fontSize: 14, lineHeight: 22 },
    heading3:    { color: colors.text, fontSize: 16, fontWeight: '600' as const, marginTop: Spacing.three, marginBottom: Spacing.one },
    strong:      { color: colors.text, fontWeight: '700' as const },
    em:          { color: colors.text, fontStyle: 'italic' as const },
    bullet_list: { marginVertical: Spacing.one },
    list_item:   { color: colors.text, marginVertical: 2 },
    blockquote:  {
      backgroundColor: colors.backgroundSelected,
      borderLeftColor: colors.textSecondary,
      borderLeftWidth: 3,
      paddingLeft: Spacing.three,
      paddingVertical: Spacing.one,
      marginVertical: Spacing.two,
    },
    hr:          { backgroundColor: colors.textSecondary, height: 1, marginVertical: Spacing.three, opacity: 0.3 },
  };
}
