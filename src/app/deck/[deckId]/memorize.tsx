/**
 * Memorize mode — /deck/[deckId]/memorize
 *
 * Passive review pattern (mirrors Vocat's "การเรียนรู้" / Anki's "Browse"):
 *   - Show ALL fields at once (T hero + P reading + D meaning pill + E body)
 *   - No flip, no rating, no FSRS update, no session log
 *   - Prev / Next navigation only
 *   - Editorial brutalism UI (own brand style — NOT Vocat's pastel)
 *
 * Use case: read-through exposure before committing to active recall
 * (Quiz mode). User can come here unlimited times without polluting
 * FSRS schedule or streak.
 */

import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { FiChevronLeft, FiChevronRight, FiEye, FiEyeOff } from 'react-icons/fi';
import Markdown from 'react-native-markdown-display';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ColumnVisibility } from '@/components/flashcard';
import { OverlayRailButton } from '@/components/overlay-rail-button';
import { SpeakButton } from '@/components/speak-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/context/theme';
import { entriesForDeckAsync, useAllDecks } from '@/hooks/use-decks';
import { usePersistedState } from '@/hooks/use-persisted-state';
import type { Entry } from '@/data/types';
import type { LastSession } from '@/lib/last-session';

export default function MemorizeScreen() {
  const { deckId, entryId } = useLocalSearchParams<{ deckId?: string; entryId?: string }>();
  const { scheme, colors } = useThemeColors();
  const { width: screenW } = useWindowDimensions();

  /* Responsive scale — mirrors flashcard.tsx pattern. Smooth interpolate
     between 360px viewport (0.65×) and 1024px (1.0×). Affects hero term,
     meaning pill, bracket reading, markdown body. */
  const MIN_W = 360;
  const MAX_W = 1024;
  const tCard = Math.max(0, Math.min(1, (screenW - MIN_W) / (MAX_W - MIN_W)));
  const cardScale = 0.65 + tCard * 0.35;
  const termSize = Math.max(36, Math.round(72 * cardScale));
  const termLineHeight = Math.round(termSize * 1.08);
  const bracketSize = Math.max(13, Math.round(16 * cardScale));
  const meaningSize = Math.max(12, Math.round(14 * cardScale));
  const mdBody = Math.max(12, Math.round(14 * cardScale));

  /* Edge rail sizing — narrow on mobile, wider tap target on desktop.
     fillWidth gives the gradient room past the tap column. */
  const compact = screenW < 600;
  const railWidth = compact ? 44 : 56;
  const railIcon = compact ? 24 : 28;
  const railFillWidth = compact ? 72 : 96;

  const { decks: allDecks } = useAllDecks();
  const deck = deckId ? allDecks.find((d) => d.id === deckId) : undefined;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [index, setIndex] = useState(0);
  /* Continue tracking for Learn mode — separate from Quiz's
     'last-session'. Browse renders both Continue cards if both have
     a session in flight. */
  const [, setLastSessionLearn] = usePersistedState<LastSession | null>('last-session-learn', null);
  /* Self-quiz toggle — tap card to hide/show the "answer side" (P + D
     + E). Persists across navigation so the user sets it once and all
     subsequent cards follow. Default true = passive reading (default
     Memorize use case). Per Vocat UX: the entire card is the tap
     target, no separate eye button. */
  const [showAnswer, setShowAnswer] = useState(true);
  /* Column visibility — Memorize has its own key separate from Quiz.
     Per-mode config edited only via Settings (accordion). Default all
     visible so first-time users see the full card. */
  const [visibility] = usePersistedState<ColumnVisibility>(
    'visibility-learn',
    { t: true, pf: true, pb: true, d: true, e: true },
  );

  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    void entriesForDeckAsync(deckId).then((rows) => {
      if (cancelled) return;
      setEntries(rows);
      /* Jump to entryId if present (Continue card resume) — falls
         back to 0 if the entry no longer exists. */
      if (entryId) {
        const jumpTo = rows.findIndex((r) => r.id === entryId);
        setIndex(jumpTo >= 0 ? jumpTo : 0);
      } else {
        setIndex(0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [deckId, entryId]);

  /* Persist position for Continue · Learn — fires on every card change
     so Browse can resume the user where they left off. Skips when
     entries haven't loaded or deck is missing. */
  const current = entries[index];
  useEffect(() => {
    if (!deck || !current) return;
    setLastSessionLearn({
      deckId: deck.id,
      deckTitle: deck.title,
      entryId: current.id,
      index,
      total: entries.length,
      updatedAt: Date.now(),
    });
  }, [deck, current, index, entries.length, setLastSessionLearn]);

  const canPrev = index > 0;
  const canNext = index < entries.length - 1;

  /* Swipe-to-navigate — instant snap (no fade, no drag visual).
     Matches Quiz mode's "rate → next instant" convention + mobile
     card-swap pattern (Tinder/Anki mobile = instant). Pan only
     commits via onEnd; activeOffsetX + failOffsetY disambiguate
     from vertical scroll. */
  function goPrev() {
    if (canPrev) setIndex((i) => i - 1);
  }
  function goNext() {
    if (canNext) setIndex((i) => i + 1);
  }

  /* JS-thread refs mirrored into shared values so the gesture worklet
     can read can-prev/can-next without triggering Pan rebuild. */
  const canPrevSV = useSharedValue(canPrev);
  const canNextSV = useSharedValue(canNext);
  useEffect(() => { canPrevSV.value = canPrev; }, [canPrev, canPrevSV]);
  useEffect(() => { canNextSV.value = canNext; }, [canNext, canNextSV]);

  const swipePan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .shouldCancelWhenOutside(false)
    .onEnd((e) => {
      const commit = Math.abs(e.translationX) > 60 || Math.abs(e.velocityX) > 600;
      if (!commit) return;
      const goNextSwipe = e.translationX < 0 && canNextSV.value;
      const goPrevSwipe = e.translationX > 0 && canPrevSV.value;
      if (goNextSwipe) {
        scheduleOnRN(goNext);
      } else if (goPrevSwipe) {
        scheduleOnRN(goPrev);
      }
    });

  /* Tap composed via Gesture.Race with Pan so swipe + tap never fire
     together. maxDistance keeps it a true tap (no drag-then-release).
     Replaces the previous Pressable wrapper which raced with Pan and
     fired the toggle even on swipe-end.

     Inner speaker zones each get their own Gesture.Tap (refs below);
     the outer tapToggle uses `requireExternalGestureToFail` so when a
     tap lands on a speaker its inner Tap wins the arena and the outer
     never fires. SpeakButton's own Pressable.onPress still triggers
     TTS — RNGH observes touches but doesn't block Pressable events.
     (Note: Gesture.Native() does NOT activate for Pressable presses
     on web — used Gesture.Tap instead so it actually competes in the
     RNGH arena.) useMemo keeps the refs stable across renders. */
  const toggleAnswer = () => setShowAnswer((v) => !v);
  const speakerTapHero = useMemo(() => Gesture.Tap().maxDistance(10), []);
  const speakerTapReading = useMemo(() => Gesture.Tap().maxDistance(10), []);
  const tapToggle = Gesture.Tap()
    .maxDistance(10)
    .requireExternalGestureToFail(speakerTapHero, speakerTapReading)
    .onEnd((_e, success) => {
      if (!success) return;
      scheduleOnRN(toggleAnswer);
    });
  const cardGesture = Gesture.Race(swipePan, tapToggle);

  if (!deck || !current) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <Header />
          <View style={styles.centerFill}>
            <ThemedText type="title">{deck ? 'ยังไม่มีคำในชุดนี้' : 'ไม่พบ Deck'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 320 }}>
              {deck ? 'Deck ว่างเปล่า — กลับไปเลือกชุดอื่น' : 'อาจถูกลบหรือ deck ID ไม่ถูกต้อง'}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* In-page header now empty — counter moved to bottom row
            (user request 2026-05-27). Header kept as a thin spacer
            so the card doesn't snap up against the TopNavBar. */}
        <Header />

        {/* Card-as-scroll-container restructure 2026-05-27 (user request):
            page no longer scrolls — the card frame fills available space and
            its inner body ScrollView handles overflow with an always-visible
            scrollbar (y-only). Outer flex column = Header / card flex:1 /
            Footer. Stripe + GlassMeta + EyeIndicator stay absolute over the
            ScrollView so they don't scroll with content. */}
        <View style={styles.cardOuter}>
          <View style={compact ? styles.cardSlot : styles.cardRow}>
            {!compact && (
              <SideRailBtn
                direction="left"
                onPress={goPrev}
                disabled={!canPrev}
                colors={colors}
              />
            )}
          <GestureDetector gesture={cardGesture}>
            <View
              accessibilityRole="none"
              accessibilityLabel={showAnswer ? 'แตะเพื่อซ่อนคำตอบ' : 'แตะเพื่อแสดงคำตอบ'}
              style={[
                styles.card,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
              ]}>
            <View style={[styles.cardStripe, { backgroundColor: Accent.base }]} />

            {/* Top-left meta cluster — GlassMeta pill + eye-state
                indicator side by side. Eye used to live in the top-
                right corner but the right-edge overlay rail covers
                that whole column on mobile, swallowing eye taps.
                Moved here 2026-05-27 so it sits clear of the rail. */}
            <View style={styles.topMetaCluster}>
              <View style={[styles.glassMeta, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <ThemedText style={[styles.mono, { color: colors.textSecondary, fontSize: 8 }]}>
                  {`CARD ${String(index + 1).padStart(2, '0')} / ${entries.length} // ${showAnswer ? 'MEMORIZE' : 'RECALL'}`}
                </ThemedText>
              </View>
              {showAnswer ? (
                <FiEye size={14} color={colors.textHint} strokeWidth={2} />
              ) : (
                <FiEyeOff size={14} color={Accent.base} strokeWidth={2} />
              )}
            </View>

            <ScrollView
              style={[
                styles.cardBodyScroll,
                /* touch-action: pan-y so vertical touch-scroll bubbles
                   through RNGH's tap arena (tap maxDistance 10 fails
                   immediately on scroll motion). Matches Quiz back-face
                   ScrollView styling — uses RN-Web's default scrollbar
                   (no explicit overflow override, no persistentScrollbar). */
                Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as any) : null,
              ]}
              contentContainerStyle={styles.cardBodyContent}
              {...({ dataSet: { scroll: 'card-memorize' } } as object)}
              showsVerticalScrollIndicator>
            {/* FRONT block — T (hero) + P (reading). Always shown
                (gated by visibility flags). T uses visibility.t, P uses
                visibility.pf — matches Quiz front-face semantics. */}
            {visibility.t ? (
              <View style={styles.heroBlock}>
                <ThemedText style={[styles.term, { color: colors.text, fontSize: termSize, lineHeight: termLineHeight }]}>{current.t}</ThemedText>
                {current.t ? (
                  <GestureDetector gesture={speakerTapHero}>
                    <View>
                      <SpeakButton text={current.t} language="ja-JP" colors={colors} size="md" />
                    </View>
                  </GestureDetector>
                ) : null}
              </View>
            ) : null}

            {visibility.pf && current.p ? (
              <View style={styles.bracketRow}>
                <ThemedText style={[styles.bracketText, { color: colors.textSecondary, fontSize: bracketSize }]}>
                  {current.p}
                </ThemedText>
                <GestureDetector gesture={speakerTapReading}>
                  <View>
                    <SpeakButton text={current.p} language="ja-JP" colors={colors} />
                  </View>
                </GestureDetector>
              </View>
            ) : null}

            {/* BACK block — D (meaning) + E (markdown body). Toggleable
                via tap. Uses visibility.d / visibility.e. Pb is unused
                in Memorize (P lives on the front only per UX direction). */}
            {showAnswer ? (
              <View style={styles.answerBlock}>
                {/* Divider separates FRONT (T + P) from BACK (D + E).
                    Sits above D pill per user direction. */}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {visibility.d && current.d ? (
                  <View style={[styles.meaningPill, { borderColor: Accent.soft, backgroundColor: Accent.bg }]}>
                    <ThemedText style={[styles.meaningText, { color: Accent.base, fontSize: Math.max(13, meaningSize + 1) }]}>{current.d}</ThemedText>
                  </View>
                ) : null}

                {visibility.e && current.e ? (
                  <View style={styles.bodyWrap}>
                    <Markdown style={markdownStyles(colors, mdBody)}>{current.e}</Markdown>
                  </View>
                ) : null}
              </View>
            ) : (
              /* Hidden state — reveal hint sized up per GPT polish round
                 2026-05-27: original 11px in tiny mono got lost in the
                 empty card area, leaving the user wondering "is this
                 empty or am I supposed to do something?". Now: short
                 Thai sentence + uppercase mono kicker, both tappable
                 surface area, scale +5px each, opacity ~0.75 via colors
                 token (textSecondary). Pulse dot kept for movement cue. */
              <View style={styles.revealCue}>
                <View style={[styles.pulseDot, { backgroundColor: Accent.base }]} />
                <ThemedText style={[styles.revealHintMain, { color: colors.textSecondary }]}>
                  แตะเพื่อดูคำตอบ
                </ThemedText>
                <ThemedText style={[styles.mono, { color: colors.textHint, fontSize: 10 }]}>
                  TAP TO REVEAL
                </ThemedText>
              </View>
            )}
            </ScrollView>

            {/* Edge overlay rails — only on compact viewports. Idle
                opacity 0, press reveals (mirrors Quiz overlay rails).
                Wide viewports use SideRailBtn outside the card instead
                so the chevron doesn't overlap content (user request
                2026-05-27). */}
            {compact && (
              <OverlayRailButton
                direction="left"
                side="left"
                onPress={goPrev}
                disabled={!canPrev}
                colors={colors}
                width={railWidth}
                iconSize={railIcon}
                fillWidth={railFillWidth}
                isDark={scheme === 'dark'}
              />
            )}
            {compact && (
              <OverlayRailButton
                direction="right"
                side="right"
                onPress={goNext}
                disabled={!canNext}
                colors={colors}
                width={railWidth}
                iconSize={railIcon}
                fillWidth={railFillWidth}
                isDark={scheme === 'dark'}
              />
            )}
            </View>
          </GestureDetector>
            {!compact && (
              <SideRailBtn
                direction="right"
                onPress={goNext}
                disabled={!canNext}
                colors={colors}
              />
            )}
          </View>
        </View>

        {/* Bottom counter row — minimal, just the index. Prev/next
            live in the card-edge overlay rails now, so this row has
            no controls. Per user request 2026-05-27. */}
        {entries.length > 0 && (
          <View style={styles.bottomCounter}>
            <ThemedText type="small" themeColor="textSecondary">
              {index + 1} / {entries.length}
            </ThemedText>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────────── */

function Header() {
  /* In-page header — thin spacer only. Counter moved to bottomCounter.
     Kept so the card doesn't crash into the TopNavBar. */
  return <View style={styles.headerBar} />;
}

/** Side rail button — always-visible chevron beside the card on wide
 *  viewports (PC / tablet). Mirrors Quiz's SideRail. Sits OUTSIDE
 *  the card so it never overlaps content (user request 2026-05-27). */
function SideRailBtn({
  direction,
  onPress,
  disabled,
  colors,
}: {
  direction: 'left' | 'right';
  onPress: () => void;
  disabled: boolean;
  colors: typeof Colors.light;
}) {
  const Icon = direction === 'left' ? FiChevronLeft : FiChevronRight;
  const ariaLabel = direction === 'left' ? 'Previous card' : 'Next card';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      style={({ pressed }) => [
        styles.sideRailBtn,
        pressed && !disabled && { opacity: 0.5 },
        disabled && { opacity: 0.2 },
      ]}>
      <Icon size={48} color={colors.textSecondary} strokeWidth={1.5} />
    </Pressable>
  );
}

/* NavButton removed 2026-05-27 — prev/next now lives as edge
   OverlayRailButton (idle opacity 0 / press reveal), matching the
   Quiz card pattern. Footer area is gone. */

/* ─── Markdown styles ───────────────────────────────────────────────── */

function markdownStyles(colors: typeof Colors.light, bodySize = 14) {
  const lh = Math.round(bodySize * 1.55);
  const headingSize = Math.max(13, Math.round(bodySize * 1.14));
  return {
    body:        { color: colors.text, fontSize: bodySize, lineHeight: lh },
    heading3:    { color: colors.text, fontSize: headingSize, fontWeight: '600' as const, marginTop: Spacing.three, marginBottom: Spacing.one },
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
    hr: { backgroundColor: colors.textSecondary, height: 1, marginVertical: Spacing.three, opacity: 0.3 },
  };
}

/* ─── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  /* Card outer wrapper — flex container that fills space between Header
     and Footer. Card itself sits inside with flex: 1, body scrolls. */
  cardOuter: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  /* Wide-viewport layout — side buttons flanking the card. */
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  cardSlot: { flex: 1, alignSelf: 'stretch' },
  sideRailBtn: {
    width: 56,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cardBodyScroll: { flex: 1, alignSelf: 'stretch' },
  cardBodyContent: {
    /* All padding lives here (not on .card) so the scrollbar runs the
       full card height and stays flush with the right border. Top
       padding clears the GlassMeta pill + eye indicator. */
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.six + Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  /* ─── Card frame (matches Quiz Flashcard editorial shell) ─── */
  card: {
    flex: 1,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: Radii.md,
    /* No padding — ScrollView fills the full card so the scrollbar
       runs the entire card height (top stripe → bottom). GlassMeta +
       eye sit absolute over the top; contentContainer carries the
       inset so content doesn't sit under them. */
    padding: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  cardStripe: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
  },
  topMetaCluster: {
    position: 'absolute',
    top: 8, left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 3,
    pointerEvents: 'none',
  },
  glassMeta: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 0,
  },
  answerBlock: {
    gap: Spacing.three,
  },
  /* Reveal cue layout — switched to column so the larger Thai sentence
     and uppercase mono kicker stack centered, with the pulse dot above.
     Original row layout (dot · text) couldn't accommodate the new size
     and looked cramped. GPT polish round 2026-05-27. */
  revealCue: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  pulseDot: {
    width: 6,
    height: 6,
  },
  revealHintMain: {
    fontFamily: Platform.select({ web: '"Sarabun", sans-serif', default: undefined }),
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  secLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pip: { width: 5, height: 5 },
  mono: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  heroBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  term: {
    fontFamily: Platform.select({ web: '"Noto Serif JP", "Hiragino Mincho ProN", serif', default: undefined }),
    fontSize: 72,
    fontWeight: '300',
    lineHeight: 78,
    letterSpacing: -1,
    textAlign: 'center',
  },
  bracketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  bracketText: {
    fontSize: 16,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  hiddenHint: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
  },
  meaningPill: {
    alignSelf: 'center',
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 0,            // sharp — editorial
  },
  meaningText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
  bodyWrap: { paddingHorizontal: Spacing.one },
  /* Bottom counter — minimal index display, no controls (rails handle nav). */
  bottomCounter: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
});
