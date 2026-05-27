/**
 * MiniCard — read-only sample-card preview for Deck Detail.
 *
 * NOT a scaled-down Flashcard. GPT verdict round 2: reusing Flashcard
 * at 0.5× would drag in gesture handlers, sharedValues, flip/swipe
 * logic — heavy coupling for a static thumbnail. This is a separate,
 * tiny component that only renders the FRONT face read-only.
 *
 * Layout mirrors the design handoff (Screens v3, screen 02 mini-card):
 *   - top crimson stripe
 *   - left brand mark · right level rail
 *   - hero (T) · divider · reading (P) · meaning preview (D, 1 line)
 *   - 5 nav dots (decorative, hint at deck size)
 */

import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Accent, Colors, Radii, Spacing } from '@/constants/theme';
import type { Entry } from '@/data/types';

export function MiniCard({
  entry,
  colors,
}: {
  entry: Entry;
  colors: typeof Colors.light;
}) {
  /* Trim meaning to one line — full Thai meanings can wrap awkwardly
     in the cramped preview. Show "..." if cut. */
  const meaning = entry.d.length > 60 ? entry.d.slice(0, 57).trim() + '…' : entry.d;

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
      <View style={[styles.topStripe, { backgroundColor: Accent.base }]} />

      <View style={styles.leftMark}>
        <ThemedText style={[styles.markText, { color: colors.textHint }]}>
          {`// CARD 01`}
        </ThemedText>
      </View>

      {/* Right rail (kindGlyph + level) removed — type-derived decoration
          isn't reliable for user-added decks (Phase 3+). Body claims the
          full width now. */}

      <View style={styles.body}>
        <ThemedText style={[styles.hero, { color: colors.text }]} numberOfLines={1}>
          {entry.t}
        </ThemedText>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        {entry.p ? (
          <ThemedText style={[styles.reading, { color: colors.textSecondary }]} numberOfLines={1}>
            {entry.p}
          </ThemedText>
        ) : null}
        {meaning ? (
          <ThemedText style={[styles.meaning, { color: colors.textHint }]} numberOfLines={1}>
            {meaning}
          </ThemedText>
        ) : null}
      </View>

      <View style={[styles.navDots, { pointerEvents: 'none' }]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === 0 ? Accent.base : colors.border },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.four,
    paddingTop: Spacing.five,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 140,
  },
  topStripe: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
  },
  leftMark: {
    position: 'absolute',
    top: 8, left: 10,
  },
  markText: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  body: {
    alignItems: 'flex-start',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  hero: {
    fontFamily: Platform.select({ web: '"Noto Serif JP", "Hiragino Mincho ProN", serif', default: undefined }),
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: 32,
    marginTop: Spacing.one,
    marginBottom: Spacing.one,
  },
  reading: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  meaning: {
    fontSize: 11,
    letterSpacing: 0.2,
    fontStyle: 'italic',
  },
  navDots: {
    flexDirection: 'row',
    gap: 4,
    position: 'absolute',
    bottom: 10,
    left: 12,
  },
  dot: {
    width: 5,
    height: 5,
  },
});
