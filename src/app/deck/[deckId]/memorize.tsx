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
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { freeDeckParams } from '@/data/static-params';

/* Pre-render for every free deck — see [deckId]/index.tsx note. */
export function generateStaticParams() {
  return freeDeckParams();
}
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { FiChevronLeft, FiChevronRight, FiEye, FiEyeOff, FiShuffle, FiSliders } from 'react-icons/fi';
import Markdown from 'react-native-markdown-display';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ColumnVisibility, VisibilityPopup } from '@/components/flashcard';
import { OverlayRailButton } from '@/components/overlay-rail-button';
import { SpeakButton } from '@/components/speak-button';
import { StudyMobileBackButton } from '@/components/study-mobile-back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/context/theme';
import { entriesForDeckAsync, useAllDecks } from '@/hooks/use-decks';
import { usePersistedState } from '@/hooks/use-persisted-state';
import type { Entry } from '@/data/types';
import { loadGroupEntriesAsync, parseGroupIds } from '@/lib/group-entries';
import type { LastSession } from '@/lib/last-session';
import { studyFallbackHref } from '@/lib/navigation-back';
import {
  DEFAULT_STUDY_MODE_CONFIGS,
  sanitizeStudyModeConfig,
  studyModeConfigKey,
  type StudyModeConfig,
} from '@/lib/study-mode-config';
import { buildReshuffledStudySessionEntries, buildStudySessionEntries } from '@/lib/study-session';

export default function MemorizeScreen() {
  const { deckId, entryId, ids } = useLocalSearchParams<{ deckId?: string; entryId?: string; ids?: string }>();
  /* Group-mode = ?ids=foo,bar,baz appended to URL. When present, Memorize
     merges entries from N decks instead of loading one. Continue-card
     persist is skipped (transient session — no "resume group X at card
     12/120" semantics for v1). */
  const groupIds = useMemo(() => parseGroupIds(ids), [ids]);
  const isGroupMode = groupIds.length > 0;
  const backFallbackHref = studyFallbackHref(deckId);
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
  const shuffleIterationRef = useRef(0);
  const [flashcardConfig] = usePersistedState<StudyModeConfig>(
    studyModeConfigKey('flashcard'),
    DEFAULT_STUDY_MODE_CONFIGS.flashcard,
  );
  const safeFlashcardConfig = useMemo(
    () => sanitizeStudyModeConfig(flashcardConfig, 'flashcard'),
    [flashcardConfig],
  );
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
  /* Shared with Quiz card + Settings → Badge บนการ์ด. Gates the top-
     left meta badge in this Learn surface so the in-card popup toggle
     reaches here too. */
  const [showMeta] = usePersistedState<boolean>('show-card-meta', true);
  /* Column visibility — Memorize has its own key separate from Quiz.
     Settings exposes the same key under "// LEARN CARD". Header
     sliders icon opens an in-card popup (parity with Quiz). */
  const [visibility, setVisibility] = usePersistedState<ColumnVisibility>(
    'visibility-learn',
    { t: true, pf: true, pb: true, d: true, e: true },
  );
  const [configOpen, setConfigOpen] = useState(false);
  /* Round-5 P0 — GPT verdict "sliders discoverability ยังกลางๆ · ครั้งแรก
     tooltip VISIBLE FIELDS แล้วจำ dismiss state". Persists across visits
     until first tap; once acknowledged, never shown again. */
  const [slidersTipSeen, setSlidersTipSeen] = usePersistedState<boolean>(
    'tip-memorize-sliders-seen',
    false,
  );
  /* Adaptive `right` inset for the sliders button based on whether the
     card-body ScrollView is currently showing a vertical scrollbar
     (per user request — when scrollbar visible, leave gap so the
     button doesn't crash into the bar; when no overflow, snap closer
     to the edge). Tracked via onLayout + onContentSizeChange. */
  const [hasScrollbar, setHasScrollbar] = useState(false);
  const scrollLayoutHRef = useRef(0);
  const scrollContentHRef = useRef(0);
  const evaluateOverflow = () => {
    const overflow = scrollContentHRef.current > scrollLayoutHRef.current + 2;
    setHasScrollbar((prev) => (prev === overflow ? prev : overflow));
  };
  const visibleFrontCount = (visibility.t ? 1 : 0) + (visibility.pf ? 1 : 0);
  const visibleBackCount = (visibility.d ? 1 : 0) + (visibility.pb ? 1 : 0) + (visibility.e ? 1 : 0);
  const toggleColumn = (key: keyof ColumnVisibility) => {
    const next = { ...visibility, [key]: !visibility[key] };
    /* Keep at least one column visible per face to avoid blank-card state. */
    if (!next.t && !next.pf) return;
    if (!next.d && !next.pb && !next.e) return;
    setVisibility(next);
  };

  useEffect(() => {
    let cancelled = false;
    const loader = isGroupMode
      ? loadGroupEntriesAsync(groupIds)
      : deckId
        ? entriesForDeckAsync(deckId)
        : Promise.resolve<Entry[]>([]);
    void loader.then((rows) => {
      if (cancelled) return;
      const sessionRows =
        entryId || isGroupMode
          ? rows
          : buildStudySessionEntries(rows, safeFlashcardConfig, `${deckId}:flashcard`);
      setEntries(sessionRows);
      /* Jump to entryId if present (Continue card resume) — falls
         back to 0 if the entry no longer exists. Group mode never
         resumes, so always start at 0 when ids change. */
      if (entryId && !isGroupMode) {
        const jumpTo = sessionRows.findIndex((r) => r.id === entryId);
        setIndex(jumpTo >= 0 ? jumpTo : 0);
      } else {
        setIndex(0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [deckId, entryId, isGroupMode, groupIds, safeFlashcardConfig]);

  /* Persist position for Continue · Learn — fires on every card change
     so Browse can resume the user where they left off. Skips when
     entries haven't loaded, deck is missing, OR we're in group mode
     (transient cross-deck session — no Continue card semantics). */
  const current = entries[index];
  useEffect(() => {
    if (isGroupMode) return;
    if (!deck || !current) return;
    setLastSessionLearn({
      deckId: deck.id,
      deckTitle: deck.title,
      entryId: current.id,
      index,
      total: entries.length,
      updatedAt: Date.now(),
    });
  }, [deck, current, index, entries.length, isGroupMode, setLastSessionLearn]);

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

  const shufflePulse = useSharedValue(0);
  const shuffleCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shufflePulse.value > 0.5 ? -3 : shufflePulse.value > 0 ? 3 : 0 },
      { scale: shufflePulse.value > 0 ? 0.992 : 1 },
    ],
  }));

  const canShuffleSession = !entryId && !isGroupMode && entries.length > 1;
  function handleShuffleSession() {
    if (!canShuffleSession || !deckId) return;
    setShowAnswer(true);
    setIndex(0);
    shuffleIterationRef.current += 1;
    setEntries((rows) => buildReshuffledStudySessionEntries(
      rows,
      { count: 'all', order: 'normal' },
      `${deckId}:flashcard`,
      shuffleIterationRef.current,
    ));
    shufflePulse.value = 0;
    shufflePulse.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(0, { duration: 180 }),
    );
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
  /* Same RNGH arena pattern as speakers: rails register their own Tap
     gestures, and the outer tapToggle requires them to fail before it
     fires. Without this, tapping a rail on mobile would both navigate
     AND toggle the answer (the rail's Pressable doesn't compete with
     RNGH's tap arena on its own). */
  const railTapPrev = useMemo(() => Gesture.Tap().maxDistance(10), []);
  const railTapNext = useMemo(() => Gesture.Tap().maxDistance(10), []);
  const shuffleTap = useMemo(() => Gesture.Tap().maxDistance(10), []);
  /* Sliders config button — own Tap gesture so its hit zone wins the
     RNGH arena over `tapToggle` (which would otherwise also fire
     show/hide on the same touch). Mirrors the speaker / rail pattern. */
  const configTap = useMemo(
    () => Gesture.Tap().maxDistance(10).onEnd((_e, success) => {
      if (!success) return;
      scheduleOnRN(() => setConfigOpen(true));
    }),
    [],
  );
  const tapToggle = Gesture.Tap()
    .maxDistance(10)
    .requireExternalGestureToFail(speakerTapHero, speakerTapReading, railTapPrev, railTapNext, configTap, shuffleTap)
    .onEnd((_e, success) => {
      if (!success) return;
      scheduleOnRN(toggleAnswer);
    });
  const cardGesture = Gesture.Race(swipePan, tapToggle);

  /* Empty-state gate. Group mode skips the deck-existence check —
     deck is intentionally undefined (sentinel path /deck/__group__).
     Only fail when entries actually failed to load. */
  if ((!deck && !isGroupMode) || !current) {
    const isEmpty = isGroupMode ? entries.length === 0 : !!deck;
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <Header backFallbackHref={backFallbackHref} />
          <View style={styles.centerFill}>
            <ThemedText type="title">{isEmpty ? 'ยังไม่มีคำในชุดนี้' : 'ไม่พบ Deck'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 320 }}>
              {isEmpty ? 'Deck ว่างเปล่า — กลับไปเลือกชุดอื่น' : 'อาจถูกลบหรือ deck ID ไม่ถูกต้อง'}
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
            (user request 2026-05-27). Sliders icon sits on the card
            top-right via absolute positioning (see configBtnFloat). */}
        <Header backFallbackHref={backFallbackHref} />

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
            <Animated.View
              accessibilityRole="none"
              accessibilityLabel={showAnswer ? 'แตะเพื่อซ่อนคำตอบ' : 'แตะเพื่อแสดงคำตอบ'}
              style={[
                styles.card,
                shuffleCardStyle,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
              ]}>
            <View style={[styles.cardStripe, { backgroundColor: Accent.base }]} />

            {/* Round-5 P2 — corner registration marks. GPT round-4 noted
                Memorize is the sacred card surface where "spine / book /
                archive" language can land if kept subtle. These tiny L
                marks at each corner read as editorial print bleed
                indicators — purely decorative, no info content, no
                interaction. Crimson at 40% opacity disappears below the
                Quiz card's visual hierarchy but rewards close looking. */}
            {/* Top-left meta cluster — editorial crimson stripe + mono
                caption + eye-state indicator. Badge text gates on
                show-card-meta (in-card popup + Settings); the eye
                indicator stays visible regardless because it's a
                functional state cue, not chrome. */}
            <View style={styles.topMetaCluster}>
              {showMeta && (
                <View style={styles.glassMeta}>
                  <View style={styles.metaStripe} />
                  <ThemedText style={[styles.mono, { color: colors.textSecondary, fontSize: 8 }]}>
                    {`CARD ${String(index + 1).padStart(2, '0')} / ${entries.length} // ${showAnswer ? 'MEMORIZE' : 'RECALL'}`}
                  </ThemedText>
                </View>
              )}
              {showAnswer ? (
                <FiEye size={14} color={colors.textHint} strokeWidth={2} />
              ) : (
                <FiEyeOff size={14} color={Accent.base} strokeWidth={2} />
              )}
            </View>

            {/* Floating sliders button — top-right of card, mirrors the
                top-left meta cluster. Wrapped in a GestureDetector with
                its own Tap gesture (registered in tapToggle's
                requireExternalGestureToFail list) so the tap doesn't
                also fire the card's show/hide answer toggle. */}
            <GestureDetector gesture={configTap}>
              <Pressable
                onPress={() => {
                  setConfigOpen(true);
                  if (!slidersTipSeen) setSlidersTipSeen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="ตั้งค่าการแสดงผลคอลัมน์"
                style={({ pressed }) => [
                  styles.configBtnFloat,
                  /* Adaptive right inset — when scrollbar visible (overflow),
                     step LEFT so the button doesn't crash into the scroll
                     handle; when no overflow, snap closer to the edge.
                     Mobile uses `scrollbarWidth: 'thin'` on the inner
                     ScrollView, so its gap can be ~half the desktop
                     value (12 vs 22) and still clear the thinner bar. */
                  { right: hasScrollbar ? (compact ? 12 : 22) : 10 },
                  { borderColor: colors.border, backgroundColor: colors.background },
                  pressed && { opacity: 0.7 },
                ]}>
                <FiSliders size={16} color={colors.text} strokeWidth={2} />
              </Pressable>
            </GestureDetector>

            <GestureDetector gesture={shuffleTap}>
              <Pressable
                onPress={handleShuffleSession}
                disabled={!canShuffleSession}
                accessibilityRole="button"
                accessibilityLabel="สลับลำดับรอบเรียนนี้"
                style={({ pressed }) => [
                  styles.shuffleBtnFloat,
                  { right: (hasScrollbar ? (compact ? 12 : 22) : 10) + 42 },
                  { borderColor: colors.border, backgroundColor: colors.background },
                  pressed && { opacity: 0.7 },
                  !canShuffleSession && { opacity: 0.35 },
                ]}>
                <FiShuffle size={15} color={colors.text} strokeWidth={2} />
              </Pressable>
            </GestureDetector>

            {/* First-time discoverability hint — sits just below the
                sliders icon, right-aligned to match. Tiny mono so it
                reads as a marginal note, not a tutorial overlay.
                Dismissed permanently on first icon tap. */}
            {!slidersTipSeen && (
              <View
                style={[
                  styles.slidersTip,
                  { right: hasScrollbar ? (compact ? 12 : 22) : 10, pointerEvents: 'none' },
                ]}>
                <ThemedText
                  style={[styles.slidersTipText, { color: colors.textHint }]}
                  accessibilityElementsHidden>
                  VISIBLE FIELDS
                </ThemedText>
              </View>
            )}

            <ScrollView
              style={[
                styles.cardBodyScroll,
                /* touch-action: pan-y so vertical touch-scroll bubbles
                   through RNGH's tap arena (tap maxDistance 10 fails
                   immediately on scroll motion).
                   `scrollbarWidth: 'thin'` only on compact (mobile) so
                   the bar doesn't crash into the floating sliders
                   button — desktop keeps the default scrollbar
                   (wider, more comfortable to grab with a mouse). */
                Platform.OS === 'web'
                  ? ({
                      touchAction: 'pan-y',
                      ...(compact ? { scrollbarWidth: 'thin' } : null),
                    } as any)
                  : null,
              ]}
              contentContainerStyle={styles.cardBodyContent}
              {...({ dataSet: { scroll: 'card-memorize' } } as object)}
              /* Track overflow so the floating sliders button can step
                 left to leave a gap when the scrollbar appears. */
              onLayout={(e) => {
                scrollLayoutHRef.current = e.nativeEvent.layout.height;
                evaluateOverflow();
              }}
              onContentSizeChange={(_, h) => {
                scrollContentHRef.current = h;
                evaluateOverflow();
              }}
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
              <GestureDetector gesture={railTapPrev}>
                <View style={[styles.railOverlayWrap, { left: 0, width: railWidth }]}>
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
                </View>
              </GestureDetector>
            )}
            {compact && (
              <GestureDetector gesture={railTapNext}>
                <View style={[styles.railOverlayWrap, { right: 0, width: railWidth }]}>
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
                </View>
              </GestureDetector>
            )}
            </Animated.View>
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
        {/* Editorial brand strip — matches Quiz's bottom decoration so
            the two study modes feel consistent (user request 2026-05-27). */}
        <View style={[styles.brandRow, { pointerEvents: 'none' }]}>
          <ThemedText style={[styles.brandText, { color: colors.textHint }]}>
            NIHON BUNKAI · 鍛練精進
          </ThemedText>
        </View>

        {/* Column-visibility popup — shares the same `visibility-learn`
            key that Settings exposes; toggling here updates Settings
            and vice-versa. */}
        <VisibilityPopup
          visible={configOpen}
          onClose={() => setConfigOpen(false)}
          visibility={visibility}
          onToggle={toggleColumn}
          colors={colors}
          visibleFrontCount={visibleFrontCount}
          visibleBackCount={visibleBackCount}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────────── */

function Header({ backFallbackHref }: { backFallbackHref: string }) {
  /* In-page header — thin spacer only. Counter moved to bottomCounter.
     Kept so the card doesn't crash into the TopNavBar. Sliders icon
     lives ON the card via absolute positioning (configBtnFloat) so it
     sits in-context with the content instead of stealing header space. */
  return (
    <View style={styles.headerBar}>
      <StudyMobileBackButton fallbackHref={backFallbackHref} floating={false} />
    </View>
  );
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
  /* Floating sliders button — top-right of card, mirror of topMetaCluster.
     Size 32×32 matches Quiz's headerConfigBtn so the same control reads
     identically across study modes. zIndex 20 sits ABOVE the right
     overlay rail (zIndex 15) on mobile so the tap reaches the sliders
     instead of the next-card gesture. Right inset 22 keeps a visible
     gap between the button and the vertical scrollbar that lives on the
     right edge of the inner ScrollView on PC/tablet. */
  configBtnFloat: {
    position: 'absolute',
    top: 8,
    right: 22,
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  shuffleBtnFloat: {
    position: 'absolute',
    top: 8,
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  /* First-time tooltip below the sliders icon. Top 44 = configBtnFloat
     top (8) + height (32) + 4px gap. Right matches the icon's adaptive
     inset so the label sits right-aligned underneath. zIndex below the
     icon (20) so the button always wins the press hit-area. */
  slidersTip: {
    position: 'absolute',
    top: 44,
    zIndex: 19,
  },
  slidersTipText: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  glassMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  /* 2-px crimson vertical bar — paired with the mono caption. Mirrors
     the GlassMeta editorial stripe used in flashcard.tsx (Quiz card)
     so Quiz + Learn read as the same publication. */
  metaStripe: {
    width: 2,
    height: 11,
    backgroundColor: Accent.base,
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
  /* Wrapper around each compact-mode OverlayRailButton so the inner
     gesture (railTap{Prev,Next}) has a real View to attach to.
     position: absolute + top/bottom/side: 0 mirrors what the button
     sets internally — the wrap is invisible itself; child takes over
     layout. zIndex matches the button to keep stacking order. */
  railOverlayWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 15,
  },
  /* Bottom counter — minimal index display, no controls (rails handle nav). */
  bottomCounter: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  /* Brand decoration strip — mirrors quiz.tsx brandStyles. */
  brandRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  brandText: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});
