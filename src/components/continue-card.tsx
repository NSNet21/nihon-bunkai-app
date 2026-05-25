import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { FiChevronRight } from 'react-icons/fi';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from './themed-text';

import { Accent, Colors, Radii, Spacing } from '@/constants/theme';
import type { LastSession } from '@/lib/last-session';

type Props = {
  lastSession: LastSession;
  colors: typeof Colors.light;
};

/**
 * Browse hero CTA — resumes the user's most-recent study session.
 * Tap → /study?deckId=X&entryId=Y (Study screen seeks via existing param).
 *
 * Only rendered when:
 *  - lastSession exists in localStorage
 *  - the deck is still in allDecks (handled by the parent guard)
 *  - the session isn't finished (index < total - 1, parent guard)
 */
export function ContinueCard({ lastSession, colors }: Props) {
  const router = useRouter();
  const progress = Math.min(1, (lastSession.index + 1) / lastSession.total);

  function onPress() {
    router.push({
      pathname: '/study',
      params: { deckId: lastSession.deckId, entryId: lastSession.entryId },
    });
  }

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`เรียนต่อ ${lastSession.deckTitle} · ${lastSession.index + 1} จาก ${lastSession.total}`}
        style={({ pressed }) => [
          styles.outer,
          { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          pressed && styles.pressed,
        ]}>
        {/* Left crimson rail — matches DeckRow stripe pattern */}
        <View style={styles.stripe} pointerEvents="none" />
        <View style={styles.body}>
          <ThemedText style={[styles.label, { color: colors.textHint }]}>
            // ต่อ · CONTINUE
          </ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.title}>
            {lastSession.deckTitle}
          </ThemedText>
          <View style={styles.bottomRow}>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: Accent.base, width: `${progress * 100}%` },
                ]}
              />
            </View>
            <ThemedText style={[styles.count, { color: colors.textSecondary }]}>
              {lastSession.index + 1}/{lastSession.total}
            </ThemedText>
            <FiChevronRight size={20} color={Accent.base} strokeWidth={2} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
    marginTop: Spacing.three,
  },
  pressed: { opacity: 0.85 },
  stripe: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: Accent.base,
  },
  body: {
    flex: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  label: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  count: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 11,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'right',
  },
});
