import { useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { FiChevronRight } from 'react-icons/fi';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressableScale } from './pressable-scale';
import { ThemedText } from './themed-text';

import { Accent, Colors, Radii, Spacing } from '@/constants/theme';
import { continueModeBadge, continueRouteHref, type ContinueMode } from '@/lib/continue-route';
import type { LastSession } from '@/lib/last-session';

type Props = {
  lastSession: LastSession;
  colors: typeof Colors.light;
  /** Which resume surface to open. Default 'quiz' keeps the existing flashcard session. */
  mode?: ContinueMode;
};

/**
 * Browse hero CTA — resumes the user's most-recent study session.
 * `mode='quiz'` → /deck/[deckId]/quiz?entryId=Y (Flashcard session).
 * `mode='learn'` → /deck/[deckId]/term/[entryId] (Term Preview).
 *
 * Only rendered when:
 *  - lastSession exists in localStorage
 *  - the deck is still in allDecks (handled by the parent guard)
 *  - the session isn't finished (index < total - 1, parent guard)
 */
export function ContinueCard({ lastSession, colors, mode = 'quiz' }: Props) {
  const router = useRouter();
  const progress = Math.min(1, (lastSession.index + 1) / lastSession.total);
  const modeBadge = continueModeBadge(mode);

  function onPress() {
    router.push(continueRouteHref(lastSession, mode) as never);
  }

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`เรียนต่อ ${modeBadge} ${lastSession.deckTitle} · ${lastSession.index + 1} จาก ${lastSession.total}`}
        style={[
          styles.outer,
          { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        ]}>
        {/* Left crimson rail — matches DeckRow stripe pattern */}
        <View style={styles.stripe} />
        <View style={styles.body}>
          <ThemedText style={[styles.label, { color: colors.textHint }]}>
            {`// ${modeBadge} · CONTINUE`}
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
      </PressableScale>
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
    pointerEvents: 'none',
  },
  body: {
    flex: 1,
    /* Round-5 P0 compact -15%: GPT verdict says Continue is a utility
       "resume strip", not a showcase. Paddings 12 → 8 + gap 8 → 6 drops
       the card height ~15% without losing readability. */
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: 6,
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
    /* marginTop removed — body.gap (6) already handles separation. */
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
