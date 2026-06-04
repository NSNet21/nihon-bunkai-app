import { useEffect, useMemo, useRef } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { FiCheckSquare, FiSquare, FiX } from 'react-icons/fi';
import Markdown from 'react-native-markdown-display';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useThemePalette } from '@/context/theme';
import { usePersistedState } from '@/hooks/use-persisted-state';

import { SpeakButton } from './speak-button';
import { ThemedText } from './themed-text';

import { Accent, Colors, Radii, Spacing } from '@/constants/theme';
import type { Entry } from '@/data/types';

/** Column visibility — front face = T + Pf; back face = D + Pb + E.
 *  Pronunciation has independent toggles per face — user can mix-and-match
 *  (e.g. hide P on front to force recall, show P on back to confirm). */
export type ColumnVisibility = {
  t:  boolean;  // front: term (kanji / kana)
  pf: boolean;  // front: pronunciation
  pb: boolean;  // back:  pronunciation
  d:  boolean;  // back:  Thai meaning
  e:  boolean;  // back:  markdown explanation
};
export type FrontHero = 't' | 'p';

type Props = {
  entry: Entry;
  isFlipped: boolean;
  onFlip: () => void;
  visibility: ColumnVisibility;
  frontHero: FrontHero;
  /** Optional session position — drives top-meta + foot-dots progress. */
  index?: number;
  total?: number;
  /** Optional deck title — appended to top meta (e.g. "Kanji N5 · Pack 01"). */
  deckTitle?: string;
  /** Swipe-to-navigate (add-on to SideRail + tap-to-flip). Omit both to disable. */
  onSwipeNext?: () => void;
  onSwipePrev?: () => void;
  canSwipeNext?: boolean;
  canSwipePrev?: boolean;
};

const FLIP_DURATION = 500;

export function Flashcard({
  entry,
  isFlipped,
  onFlip,
  visibility,
  frontHero,
  index,
  total,
  deckTitle,
  onSwipeNext,
  onSwipePrev,
  canSwipeNext = false,
  canSwipePrev = false,
}: Props) {
  const colors = useThemePalette();

  const rotation = useSharedValue(isFlipped ? 180 : 0);
  /* Swipe gesture shared values — declared early so the entry-change
     useEffect can reset tx/animating after navigation completes. The full
     gesture setup happens further below (uses screenW, canSwipe flags). */
  const tx = useSharedValue(0);
  const animating = useSharedValue(false);

  /* Track the entry shown last render so we can tell apart:
       • user flipped the same card  → animate (500ms ease)
       • navigated to a new card    → snap (no animation)
     Without this, swiping while on the back face triggers a visible
     500ms back→front flip after the new card snaps in — looks like a
     glitch ("ตอน swipe card มันชอบ flip กลับไปด้านหลัง"). */
  const prevEntryIdRef = useRef(entry.id);
  useEffect(() => {
    const entryChanged = prevEntryIdRef.current !== entry.id;
    prevEntryIdRef.current = entry.id;
    if (entryChanged) {
      rotation.value = isFlipped ? 180 : 0; // instant snap on nav
      /* New entry has rendered — bring the card back to center now.
         Worklet kept it at ±screenW after the commit (off-screen) so the
         "old text flashing at center before React updates" window is
         invisible to the user. Snap (not animate) so the new card just
         appears in place — slide-in from off-screen would imply directional
         meaning the navigation doesn't have. */
      tx.value = 0;
      animating.value = false;
    } else {
      rotation.value = withTiming(isFlipped ? 180 : 0, {
        duration: FLIP_DURATION,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      });
    }
  }, [isFlipped, rotation, entry.id, tx, animating]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value + 180}deg` }],
  }));

  /* ─── swipe-to-navigate gesture ─────────────────────────────────────
     Add-on layer over the existing Pressable tap-to-flip + SideRail
     chevrons. Pan only activates when horizontal motion clearly wins:
     activeOffsetX [-15, 15] AND failOffsetY [-12, 12] (vertical wins
     ties — back-face ScrollView keeps Y-scroll on long E content).
     Commit when |dx| > max(80, screenW * 0.2) or |vx| > 600.

     Polish tiers (B + C):
     • B — Side hint pill ("← ก่อนหน้า" / "ถัดไป →") fades in past 60px
       so the user knows what release will commit to.
     • C — Rubber-band at deck boundary: if !canSwipeNext (last card) and
       user pulls left, drag is dampened (×0.3) and NO fade — fading a
       card that can't actually leave would be a visual lie.

     Commit-in-flight guard (animating shared value) blocks new gestures
     during the off-screen animation so a fast user can't spam multiple
     next() before state settles (per GPT verdict round 2 — Anti-pattern D).
     tx + animating are declared higher up so the entry-change useEffect
     can reset them. */
  const { width: screenW } = useWindowDimensions();
  const swipeEnabled = Boolean(onSwipeNext || onSwipePrev);

  /* Mirror JS props into shared values so the gesture/style worklets can
     read the latest canSwipe flags without rebuilding the Pan object. */
  const canNextSV = useSharedValue(canSwipeNext);
  const canPrevSV = useSharedValue(canSwipePrev);
  useEffect(() => { canNextSV.value = canSwipeNext; }, [canSwipeNext, canNextSV]);
  useEffect(() => { canPrevSV.value = canSwipePrev; }, [canSwipePrev, canPrevSV]);

  /* Device-tiered thresholds — finger drag on phone, mouse on desktop and
     tablet form-factors all want different scales. Old `max(80, screenW*0.2)`
     made desktop drag 288px (huge) while mobile stayed at 80 (fine). User
     feedback: "ลากแล้วไม่ไป" on desktop. Three explicit tiers, easy to tune. */
  const tier = screenW < 600 ? 'compact' : screenW < 1024 ? 'mid' : 'wide';
  const STICKY = tier === 'compact' ? 18 : tier === 'mid' ? 24 : 28;
  const COMMIT = tier === 'compact' ? 60 : tier === 'mid' ? 90 : 110;
  const FADE_END = tier === 'compact' ? 150 : tier === 'mid' ? 200 : 230;

  /* ─── responsive sizing ──────────────────────────────────────────────
     Card was designed at desktop scale (term=96, padding=32). On tablet/
     mobile the hero overflows and breathing-room collapses.

     Continuous scale (NOT stepped) — linear interpolation between a min
     viewport (360px → scale 0.65) and a max viewport (1024px → scale 1.0).
     Smoother than tier breakpoints; mirrors the landing's `clamp(min, vw,
     max)` feel but in plain JS since RN has no `vw` unit.

     Hero size also adapts to char count on top of the scale, so compound
     vocab (勉強, 食べる) + grammar patterns (〜ます, ありがとう) don't
     overflow even at desktop sizes. */
  const MIN_W = 360;
  const MAX_W = 1024;
  const tCard = Math.max(0, Math.min(1, (screenW - MIN_W) / (MAX_W - MIN_W)));
  const cardScale = 0.65 + tCard * 0.35;  // 0.65 → 1.0

  const facePad        = Math.max(12, Math.round(Spacing.six * cardScale));   // 32 → 21
  const heroBase       = Math.round(96 * cardScale);                          // 96 → 62
  const secondarySize  = Math.max(13, Math.round(18 * cardScale));            // 18 → 13
  const revealMonoSize = Math.max(10, Math.round(11 * cardScale));            // 11 → 10
  const meaningSize    = Math.max(28, Math.round(48 * cardScale));            // 48 → 31
  const backPSize      = Math.max(13, Math.round(16 * cardScale));            // 16 → 13
  /* Pill-clearance offset — meta pill is ~14px tall at top:8, plus visual gap. */
  const META_CLEARANCE = 36;

  const swipeStyle = useAnimatedStyle(() => {
    const dist = Math.abs(tx.value);
    const boundary =
      (tx.value < 0 && !canNextSV.value) || (tx.value > 0 && !canPrevSV.value);
    /* Fade tiers — 0–STICKY no response (mistake-tolerance), STICKY→FADE_END
       progressive opacity drop, beyond FADE_END floored at 0.05. Boundary
       cards stay fully opaque (visual honesty — fading a card that can't
       actually leave is a lie). */
    const fadeStart = STICKY;
    const fadeEnd = FADE_END;
    const opacity = boundary
      ? 1
      : dist <= fadeStart
        ? 1
        : Math.max(0.05, 1 - (dist - fadeStart) / (fadeEnd - fadeStart));
    return {
      opacity,
      transform: [
        { translateX: tx.value },
        /* Subtle rotation tied to drag distance — tactile feel without noise.
           Capped at ±8° so it never competes with the flip's rotateY. */
        { rotateZ: `${Math.max(-8, Math.min(8, tx.value / 30))}deg` },
        /* Tiny scale shrink as it leaves — "letting go" feel. Max 6%. */
        { scale: 1 - Math.min(0.06, dist / 1200) },
      ],
    };
  });

  const fireNext = () => onSwipeNext?.();
  const firePrev = () => onSwipePrev?.();

  const swipePan = Gesture.Pan()
    .enabled(swipeEnabled)
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    /* Keep tracking even when pointer leaves card bounds — on web/desktop
       a fast drag can outrun the card edge; cancelling there leaves the
       card stranded mid-drag (per GPT verdict — Anti-pattern B). */
    .shouldCancelWhenOutside(false)
    .onUpdate((e) => {
      /* Block updates during commit animation so spam-drag can't queue
         multiple navigations (per GPT verdict — Anti-pattern D). */
      if (animating.value) return;
      /* Rubber-band at boundary — dampens drag by 70% so the card visibly
         resists when there's no card to go to. Removes the "broken" feel
         of trying to swipe past the last card with no resistance. */
      const boundary =
        (e.translationX < 0 && !canNextSV.value) ||
        (e.translationX > 0 && !canPrevSV.value);
      tx.value = boundary ? e.translationX * 0.3 : e.translationX;
    })
    .onEnd((e) => {
      if (animating.value) return;
      const fire = Math.abs(e.translationX) > COMMIT || Math.abs(e.velocityX) > 600;
      const goNext = fire && e.translationX < 0 && canSwipeNext;
      const goPrev = fire && e.translationX > 0 && canSwipePrev;
      if (goNext) {
        animating.value = true;
        tx.value = withTiming(
          -screenW,
          { duration: 220, easing: Easing.bezier(0.4, 0, 1, 1) },
          (finished) => {
            if (finished) {
              /* Snap rotation to 0 (front face) — prevents a back-face flash
                 if user swiped while flipped. Then schedule the JS state
                 update. tx STAYS at -screenW (off-screen) until the entry-
                 change useEffect resets it — this hides the "old text
                 flashing at center while React updates" window without
                 using opacity (which would break preserve-3d's backface
                 culling and bleed the back face's badge through). */
              rotation.value = 0;
              scheduleOnRN(fireNext);
            }
          },
        );
      } else if (goPrev) {
        animating.value = true;
        tx.value = withTiming(
          screenW,
          { duration: 220, easing: Easing.bezier(0.4, 0, 1, 1) },
          (finished) => {
            if (finished) {
              rotation.value = 0;
              scheduleOnRN(firePrev);
            }
          },
        );
      } else {
        /* Snap-back with gentle overshoot — bezier mimics Easing.back without
           the web-fallback-to-linear issue ([[next-session-resume]] rule). */
        tx.value = withTiming(0, {
          duration: 240,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        });
      }
    });

  /* Tap-to-flip — replaces the previous Pressable wrapper (which (a) blocked
     SpeakButton presses, since RN-Web Pressable claimed the pointer up
     before children, and (b) rendered as <button> nested with the speaker
     <button>, triggering React's DOM validator). Composed via Race with
     swipePan so swipe and tap can't both fire.

     Inner speaker zones each get their own Gesture.Tap (refs below); the
     outer tapFlip uses `requireExternalGestureToFail` so when a tap lands
     on a speaker its inner Tap wins the arena and the flip never fires.
     SpeakButton's own Pressable.onPress still triggers TTS — RNGH observes
     touches but doesn't block Pressable events. (Gesture.Native does NOT
     activate for Pressable presses on web — Tap is what actually competes
     in the RNGH arena.) useMemo keeps refs stable across renders. */
  const speakerTapHero = useMemo(() => Gesture.Tap().maxDistance(10), []);
  const speakerTapBackP = useMemo(() => Gesture.Tap().maxDistance(10), []);
  const tapFlip = Gesture.Tap()
    .maxDistance(10)
    .requireExternalGestureToFail(speakerTapHero, speakerTapBackP)
    .onEnd((_e, success) => {
      if (!success) return;
      scheduleOnRN(onFlip);
    });
  const cardGesture = Gesture.Race(swipePan, tapFlip);

  /* Resolve front hero: respect setting, but fall back if chosen column is hidden. */
  const heroKey: FrontHero =
    frontHero === 't' && visibility.t  ? 't'
    : frontHero === 'p' && visibility.pf ? 'p'
    : visibility.t ? 't' : 'p';
  const heroValue = heroKey === 't' ? entry.t : entry.p;
  const secondaryKey: FrontHero = heroKey === 't' ? 'p' : 't';
  const secondaryVisible = heroKey === 't' ? visibility.pf : visibility.t;
  const secondaryValue   = secondaryKey === 't' ? entry.t : entry.p;

  /* Length-based shrink ON TOP of the continuous cardScale. Hero (CJK)
     and back-face meaning (Thai/EN body) both can blow out width on long
     entries — different shape per script:
       • Hero: 1-char dominant, compounds (勉強, 食べる) + grammar patterns
         (〜ます, ありがとう) need aggressive shrink to fit
       • Meaning: usually short ("น้ำ"), but vocab entries with comma-
         separated translations can hit 25+ chars ("ตะเกียบ, สะพาน,
         ขอบ, ปลาย") and wrap awkwardly on narrow viewports
       • backP: kana mostly short ("はし") but can hold full forms in
         grammar entries — gentle taper only */
  const heroLen = (heroValue ?? '').length;
  /* Softer taper after 5 chars — old curve dropped to 0.32× at 6+ which
     rendered "〜たり〜たりする" at ~20px on mobile (too small to read as
     hero). New curve keeps long compounds + multi-syllable grammar
     patterns at a comfortable hero size. Min 22 floor so even pathological
     20-char entries stay legible. */
  const heroSize = Math.max(22, (
    heroLen <= 1  ? heroBase                       // 96 / 62 (desktop / mobile)
    : heroLen <= 2  ? Math.round(heroBase * 0.68)  // 65 / 42  勉強, 食事
    : heroLen <= 3  ? Math.round(heroBase * 0.60)  // 58 / 37  食べる, 〜ます
    : heroLen <= 5  ? Math.round(heroBase * 0.54)  // 52 / 33  美味しい, ありがとう
    : heroLen <= 8  ? Math.round(heroBase * 0.48)  // 46 / 30  〜たり〜たりする
    : heroLen <= 12 ? Math.round(heroBase * 0.40)  // 38 / 25  longer grammar patterns
    : Math.round(heroBase * 0.34)                  // 33 / 21  pathological cases
  ));
  const heroLineHeight = Math.round(heroSize * 1.05);

  /* Type-aware meaning base — each content type has a different meaning
     shape, so the "starting size" before length-based shrink differs:
       • kanji    → short concise gloss ("ก่อน, หน้า")            full base
       • vocab    → comma-separated translations (can be 4+ items)  0.85×
       • grammar  → explanatory Thai sentence                       0.68×
       • glossary → dictionary-style definition (longest avg)       0.58×
     Then length-based multiplier shrinks further when the actual entry
     overflows the typical-for-type range. */
  const meaningTypeBase =
    entry.type === 'kanji'    ? meaningSize
    : entry.type === 'vocab'  ? meaningSize * 0.85
    : entry.type === 'grammar'? meaningSize * 0.68
    :                            meaningSize * 0.58;  // glossary
  const meaningLen = (entry.d ?? '').length;
  /* Softened curve per GPT review 2026-05-26 — previous 0.56 floor for
     41+ chars + min 18 made grammar/glossary meanings collapse below
     hero hierarchy. New curve keeps meaning as PRIMARY content of back
     face even when long: floor 26 (24 for grammar/glossary which start
     smaller), softer end-tail. */
  const meaningMul =
    meaningLen <= 8  ? 1
    : meaningLen <= 15 ? 0.92
    : meaningLen <= 25 ? 0.84
    : meaningLen <= 40 ? 0.76
    : 0.68;
  const meaningFloor = entry.type === 'grammar' || entry.type === 'glossary' ? 24 : 26;
  const meaningSizeFinal = Math.max(meaningFloor, Math.round(meaningTypeBase * meaningMul));
  /* Thai descenders + comma wrap → bump line-height to 1.25 vs the 1.15
     used for short titles. Keeps multi-line meanings legible. */
  const meaningLH = Math.round(meaningSizeFinal * 1.25);

  const backPLen = (entry.p ?? '').length;
  const backPMul = backPLen <= 6 ? 1 : backPLen <= 12 ? 0.9 : 0.8;
  const backPSizeFinal = Math.max(12, Math.round(backPSize * backPMul));

  /* Markdown body — scale with cardScale only (paragraphs wrap naturally
     so length-based shrink would be over-engineering). */
  const mdBody = Math.max(12, Math.round(14 * cardScale));

  const hasProgress = typeof index === 'number' && typeof total === 'number' && total > 0;
  /* Editorial top meta — `CARD 01 / 20 // KANJI N5 · PACK 01`.
     Falls back gracefully if either piece is missing. Hidden when the
     user toggles it off in Settings (persisted under nb.show-card-meta).
     On narrow viewports (<600px) drop the deckTitle suffix — the deck
     header above the card already shows it, and the full pill text wraps
     to 2 lines + collides with the top-right speaker/settings cluster. */
  const [showMeta] = usePersistedState<boolean>('show-card-meta', true);
  const showDeckInPill = deckTitle && screenW >= 600;
  const metaText = hasProgress && showMeta
    ? `CARD ${String(index! + 1).padStart(2, '0')} / ${total}${showDeckInPill ? ` // ${deckTitle!.toUpperCase()}` : ''}`
    : null;

  return (
    <>
      <GestureDetector gesture={cardGesture}>
        <Animated.View
          accessibilityLabel={isFlipped ? 'แตะเพื่อกลับด้านหน้า' : 'แตะเพื่อดูคำตอบ'}
          style={[
            styles.cardPress,
            /* Vertical scroll on web — RNGH wraps GestureDetector children with
               touchAction:'none' by default, which blocks mouse-wheel + touch
               scroll inside the back-face ScrollView. swipePan's activeOffsetX
               + failOffsetY already make vertical pans fail; explicit pan-y
               lets the browser deliver them to the ScrollView. */
            Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as any) : null,
          ]}>
          <Animated.View style={[styles.cardWrapper, swipeStyle]}>
            {/* Front face — hero (T or P) + (optionally) the other as secondary.
                pointerEvents flips with isFlipped so the inactive face stops
                intercepting clicks + wheel — backface-visibility:hidden on
                preserve-3d elements doesn't always block hit-testing on web. */}
            <Animated.View
              /* Keep pointerEvents as PROP (not style) — Reanimated's
                 Animated.View on RN Web does NOT forward style.pointerEvents
                 to the rendered div, so toggling via prop is the only
                 reliable way to stop the inactive face from intercepting
                 clicks on the TTS icon + ScrollView wheel. Accept the
                 deprecation warning here. */
              pointerEvents={isFlipped ? 'none' : 'auto'}
              style={[
                styles.face,
                styles.faceCenter,
                { backgroundColor: colors.backgroundElement, padding: facePad },
                /* Front face: kill text selection on web so drag never gets
                   hijacked by browser's text-select. Back face KEEPS default
                   (selectable markdown — user might copy a kanji reading). */
                Platform.OS === 'web' ? ({ userSelect: 'none' } as any) : null,
                frontStyle,
              ]}>
            {/* Top crimson stripe — editorial frame edge */}
            <View style={styles.topStripe} />
            {metaText && <GlassMeta text={metaText} colors={colors} />}
            {/* Config button MOVED OUT to study.tsx header (2026-05-26)
                so it doesn't collide with the overlay-rail hit zone on
                mobile. TTS speaker also moved — see below, inline with
                the hero term so the affordance is adjacent to what it
                reads aloud. */}
            <View style={styles.frontContent}>
              {/* Hero + speaker bound tightly (per GPT review 2026-05-26):
                  speaker sits in a tight block with the hero so the
                  affordance reads as "speak this hero", not as a floating
                  button between hero and secondary. Tight 6px gap inside
                  the block, normal frontContent gap to siblings. */}
              <View style={styles.heroBlock}>
                <ThemedText style={[styles.term, { fontSize: heroSize, lineHeight: heroLineHeight }]}>
                  {heroValue}
                </ThemedText>
                {heroValue ? (
                  <GestureDetector gesture={speakerTapHero}>
                    <View>
                      <SpeakButton text={heroValue} language="ja-JP" colors={colors} size="md" />
                    </View>
                  </GestureDetector>
                ) : null}
              </View>
              {secondaryVisible && secondaryValue ? (
                <ThemedText
                  type="default"
                  themeColor="textSecondary"
                  style={[
                    styles.pronunciation,
                    {
                      fontSize: secondarySize,
                      /* Multi-line secondary (Kunyomi: x\nOnyomi: y) needs
                         breathing room — GPT review noted rows reading
                         as one mashed list. 1.45 ratio opens it up. */
                      lineHeight: Math.round(secondarySize * 1.45),
                    },
                  ]}>
                  {secondaryValue}
                </ThemedText>
              ) : null}
              {/* Reveal cue — mono editorial label + crimson square. Per
                  GPT round-4: pulse runs only on the first 3 cards so
                  the gesture-teach happens early and the rhythm settles
                  static afterwards. After that the dot stays still. */}
              <View style={styles.revealCue}>
                <PulseDot active={(index ?? 0) < 3} />
                <ThemedText style={[styles.revealMono, { color: colors.textHint, fontSize: revealMonoSize }]}>
                  แตะ <ThemedText style={[styles.revealMono, { color: Accent.base, fontSize: revealMonoSize }]}>·</ThemedText> TAP TO REVEAL
                </ThemedText>
              </View>
            </View>
          </Animated.View>

          {/* Back face — D (meaning) + E (explanation), each toggleable */}
          <Animated.View
            pointerEvents={isFlipped ? 'auto' : 'none'}
            style={[styles.face, { backgroundColor: colors.backgroundElement }, backStyle]}>
            <ScrollView
              style={[
                styles.backScroll,
                /* Mobile touch — ScrollView's default touch-action eats pan-x
                   so swipe-to-navigate dies on the back face. Explicit pan-y
                   restricts the scroll container to vertical only and lets
                   horizontal pans bubble up to RNGH's Pan gesture. */
                Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as any) : null,
              ]}
              contentContainerStyle={[
                styles.backScrollContent,
                {
                  paddingTop: facePad + META_CLEARANCE,
                  paddingHorizontal: facePad,
                  paddingBottom: facePad,
                },
              ]}
              {...({ dataSet: { scroll: 'card' } } as object)}
              showsVerticalScrollIndicator>
              {/* Round-5 P2 progressive reveal — GPT round-4: "flip →
                  kanji → 80ms → reading → 80ms → meaning". Mount-gated on
                  `isFlipped` so each flip re-fires the cascade. Base
                  delay 220ms lines the first fade up with the back face
                  becoming visible (FLIP_DURATION 500 / 2 = 250). 160ms
                  duration finishes each element well inside the flip
                  tail so the card lands "settled". */}
              {isFlipped && visibility.d && (
                <Animated.View entering={FadeIn.duration(160).delay(220)}>
                  <ThemedText type="title" style={[styles.meaning, { fontSize: meaningSizeFinal, lineHeight: meaningLH }]}>
                    {entry.d}
                  </ThemedText>
                </Animated.View>
              )}
              {isFlipped && visibility.pb && entry.p ? (
                <Animated.View entering={FadeIn.duration(160).delay(300)} style={styles.backPRow}>
                  <ThemedText
                    type="default"
                    themeColor="textSecondary"
                    style={[styles.backP, { fontSize: backPSizeFinal }]}>
                    {entry.p}
                  </ThemedText>
                  <GestureDetector gesture={speakerTapBackP}>
                    <View>
                      <SpeakButton text={entry.p} language="ja-JP" colors={colors} />
                    </View>
                  </GestureDetector>
                </Animated.View>
              ) : null}
              {isFlipped && visibility.e && (
                <Animated.View entering={FadeIn.duration(160).delay(380)} style={styles.markdownWrap}>
                  <Markdown style={markdownStyles(colors, mdBody)}>{entry.e}</Markdown>
                </Animated.View>
              )}
            </ScrollView>
            {/* Top crimson stripe — rendered AFTER ScrollView so it cleanly
                covers the scrollbar's top edge (otherwise scrollbar shows
                the stripe red bleeding through). */}
            <View style={styles.topStripe} />
            {/* Glass meta — absolute-positioned overlay; scrolling content
                slides UNDER it (backdrop-blur for the frosted editorial edge). */}
            {metaText && <GlassMeta text={metaText} colors={colors} />}
          </Animated.View>
        </Animated.View>

        {/* Overlay layer — sits OUTSIDE the 3D context of cardWrapper so the
            foot-dots progress stays flat and fades over the flip rather than
            disappearing edge-on at 90°. Shares swipeStyle so FootDots
            translates with the card during swipe (otherwise progress sits
            still while the card flies away — looks broken). */}
        <Animated.View pointerEvents="box-none" style={[styles.cardOverlay, swipeStyle]}>
          {hasProgress && <FootDots index={index!} total={total!} colors={colors} isFlipped={isFlipped} />}
        </Animated.View>
        </Animated.View>
      </GestureDetector>
    </>
  );
}

/* FaceSettingsButton + faceSettingsStyles + faceTopActionsStyles removed
   2026-05-26. The config trigger lifted out to study.tsx header so it
   doesn't collide with the overlay-rail hit zone on mobile. The popup
   itself (VisibilityPopup) remains exported below. */

/* ─── glass meta ─────────────────────────────────────────────────────── */

/** Editorial meta pill — frosted-glass bg, sharp corners, mono caps.
 *  Sits inside each face so it flips with the card. Two variants:
 *  - `overlay` (default): absolute-positioned top-left inside the front face
 *  - `inline`: flows as a normal block at the top of the back ScrollView */
function GlassMeta({
  text,
  colors,
  variant = 'overlay',
}: {
  text: string;
  colors: typeof Colors.light;
  variant?: 'overlay' | 'inline';
}) {
  /* Editorial stripe — crimson 2px vertical bar + mono uppercase caption,
     no plate, no border. Lets the card surface read through. Plate
     pattern was reverted from this slot after dark/light parity testing;
     the stripe carries the brand without claiming visual space against
     the kanji hero. */
  return (
    <View
      style={[
        glassStyles.pill,
        variant === 'overlay' ? glassStyles.overlay : glassStyles.inline,
      ]}>
      <View style={glassStyles.stripe} />
      <ThemedText style={[glassStyles.text, { color: colors.textSecondary }]}>{text}</ThemedText>
    </View>
  );
}

const glassStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    pointerEvents: 'none',
  },
  /* 2-px crimson vertical bar — the only chrome left after dropping the
     plate. Height tuned to match the mono-caption cap height + slight
     extension, so it reads as a deliberate editorial element rather
     than a stray accent. */
  stripe: {
    width: 2,
    height: 11,
    backgroundColor: Accent.base,
  },
  /* Compact badge in the top-left corner of each face, sits below the
     existing top-edge red stripe of the card. */
  overlay: {
    position: 'absolute',
    top: 10,
    left: 12,
    zIndex: 7,
  },
  inline: {
    marginBottom: Spacing.three,
  },
  text: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 8,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});

/* ─── foot dots ──────────────────────────────────────────────────────── */

/** 5-quintile progress indicator overlaid bottom-left.
 *  Filled crimson once the card index passes each fifth of the deck.
 *  Fades out and back in when the card flips so the motion reads as part
 *  of the same gesture (explicit 500ms sequence — deliberate, not
 *  cos-tied so the dwell at 0 is perceptible). */
function FootDots({
  index,
  total,
  colors,
  isFlipped,
}: {
  index: number;
  total: number;
  colors: typeof Colors.light;
  isFlipped: boolean;
}) {
  const progress = (index + 1) / total;
  const opacity = useSharedValue(1);
  const mounted = useSharedValue(false);
  useEffect(() => {
    /* Skip the first run so the initial render doesn't fade. */
    if (!mounted.value) { mounted.value = true; return; }
    opacity.value = withSequence(
      withTiming(0, { duration: 350, easing: Easing.bezier(0.455, 0.03, 0.515, 0.955) }),
      withTiming(1, { duration: 350, easing: Easing.bezier(0.455, 0.03, 0.515, 0.955) }),
    );
  }, [isFlipped, opacity, mounted]);
  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[footDotsStyles.row, aStyle]}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = (i + 1) / 5 <= progress;
        return (
          <View
            key={i}
            style={[
              footDotsStyles.dot,
              { backgroundColor: filled ? Accent.base : colors.border },
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

const footDotsStyles = StyleSheet.create({
  row: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 6,
    pointerEvents: 'none',
  },
  dot: {
    width: 5,
    height: 5,
  },
});

/* ─── pulse dot ──────────────────────────────────────────────────────── */

function PulseDot({ active = true }: { active?: boolean }) {
  const op = useSharedValue(1);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!active) {
      /* Settle to rest values when the pulse turns off — keeps the dot
         visible but stationary, no jump frame. */
      op.value = withTiming(1, { duration: 220 });
      scale.value = withTiming(1, { duration: 220 });
      return;
    }
    op.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 900, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
        withTiming(1,   { duration: 900, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
      ),
      -1,
      false,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 900, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
        withTiming(1,   { duration: 900, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
      ),
      -1,
      false,
    );
  }, [active, op, scale]);
  const aStyle = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.pulseDot, aStyle]} />;
}

/* ─── popup ──────────────────────────────────────────────────────────── */

/* Unified card-config popup — opened from the header config button
   (lifted out of the card 2026-05-26 so it stops colliding with the
   overlay rail hit zone on mobile). Single modal renders BOTH face
   sections (front T/Pf + back D/Pb/E) — user dropped the per-face split
   so navigation needs only one tap, popup needs only one button. */
export function VisibilityPopup({
  visible,
  onClose,
  visibility,
  onToggle,
  colors,
  visibleFrontCount,
  visibleBackCount,
}: {
  visible: boolean;
  onClose: () => void;
  visibility: ColumnVisibility;
  onToggle: (k: keyof ColumnVisibility) => void;
  colors: typeof Colors.light;
  visibleFrontCount: number;
  visibleBackCount: number;
}) {
  /* Lock the last-remaining column on each face so the user can't blank it. */
  const frontOnly = visibleFrontCount === 1;
  const backOnly  = visibleBackCount === 1;
  const tLocked   = visibility.t  && frontOnly;
  const pfLocked  = visibility.pf && frontOnly;
  const pbLocked  = visibility.pb && backOnly;
  const dLocked   = visibility.d  && backOnly;
  const eLocked   = visibility.e  && backOnly;

  /* Shares the same persisted key as Settings → Badge บนการ์ด.
     Toggling here updates Settings and vice-versa. */
  const [showMeta, setShowMeta] = usePersistedState<boolean>('show-card-meta', true);

  /* Header lives INSIDE the ScrollView with position:sticky on web so
     the scrollbar gutter spans the full panel height (top edge to
     bottom edge), not just the section-list region. Sticky keeps the
     close button + title anchored to the top while sections scroll. */
  const stickyHeader = Platform.OS === 'web'
    ? ({ position: 'sticky', top: 0, zIndex: 1 } as object)
    : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={popupStyles.overlay} onPress={onClose}>
        <Pressable
          style={[popupStyles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation?.()}>
          {/* Single scroll body wraps both header + sections so the
              scrollbar gutter aligns with the full modal height
              (per user request). Header is position:sticky on web so
              it stays anchored at the top while the section list
              scrolls beneath. */}
          <ScrollView
            style={popupStyles.scrollBody}
            contentContainerStyle={popupStyles.scrollBodyContent}
            showsVerticalScrollIndicator>
            <View style={[popupStyles.header, { backgroundColor: colors.background }, stickyHeader]}>
              <View>
                <ThemedText type="defaultSemiBold">การแสดงผลการ์ด</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  badge มุมการ์ด · คอลัมน์ที่จะแสดง
                </ThemedText>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="ปิดการตั้งค่าการแสดงผลการ์ด"
                style={({ pressed }) => [popupStyles.close, pressed && { opacity: 0.6 }]}>
                <FiX size={20} color={colors.text} strokeWidth={2} />
              </Pressable>
            </View>

            <View style={popupStyles.sectionBlock}>
              <ThemedText type="small" style={[popupStyles.sectionLabel, { color: colors.textHint }]}>
                // BADGE · ป้ายมุมการ์ด
              </ThemedText>
              <CompactToggleRow
                checked={showMeta}
                onPress={() => setShowMeta(!showMeta)}
                colors={colors}
                label="แสดง badge มุมบนซ้าย"
                hint={showMeta ? 'กำลังแสดง · แตะเพื่อซ่อน' : 'กำลังซ่อน · แตะเพื่อแสดง'}
              />
            </View>

            <View style={popupStyles.sectionBlock}>
              <ThemedText type="small" style={[popupStyles.sectionLabel, { color: colors.textHint }]}>
                // FRONT · ด้านหน้า
              </ThemedText>
              <View style={popupStyles.rows}>
                <CheckRow
                  checked={visibility.t}
                  locked={tLocked}
                  onPress={() => onToggle('t')}
                  colors={colors}
                  label="T · คำศัพท์ (Term)"
                  hint="คันจิ / คะนะ"
                />
                <CheckRow
                  checked={visibility.pf}
                  locked={pfLocked}
                  onPress={() => onToggle('pf')}
                  colors={colors}
                  label="P · คำอ่าน (Pronunciation)"
                  hint="ตั้งแยกจากด้านหลัง"
                />
              </View>
            </View>

            <View style={popupStyles.sectionBlock}>
              <ThemedText type="small" style={[popupStyles.sectionLabel, { color: colors.textHint }]}>
                // BACK · ด้านหลัง
              </ThemedText>
              <View style={popupStyles.rows}>
                <CheckRow
                  checked={visibility.d}
                  locked={dLocked}
                  onPress={() => onToggle('d')}
                  colors={colors}
                  label="D · ความหมาย (Thai)"
                  hint="แสดงเป็น title หลังพลิกการ์ด"
                />
                <CheckRow
                  checked={visibility.pb}
                  locked={pbLocked}
                  onPress={() => onToggle('pb')}
                  colors={colors}
                  label="P · คำอ่าน (Pronunciation)"
                  hint="ตั้งแยกจากด้านหน้า"
                />
                <CheckRow
                  checked={visibility.e}
                  locked={eLocked}
                  onPress={() => onToggle('e')}
                  colors={colors}
                  label="E · คำอธิบาย (Explanation)"
                  hint="markdown sections — Breakdown / Examples"
                />
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Single-line toggle — smaller footprint than CheckRow (no locked state,
 *  no inline locked-hint text). Used in VisibilityPopup for sub-options
 *  like the badge visibility switch where there's no risk of "last one
 *  locked" semantics. */
function CompactToggleRow({
  checked,
  onPress,
  colors,
  label,
  hint,
}: {
  checked: boolean;
  onPress: () => void;
  colors: typeof Colors.light;
  label: string;
  hint: string;
}) {
  const Icon = checked ? FiCheckSquare : FiSquare;
  const iconColor = checked ? Accent.base : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        popupStyles.compactRow,
        {
          borderColor: colors.border,
          backgroundColor: checked ? Accent.bg : 'transparent',
        },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon size={18} color={iconColor} strokeWidth={2} />
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText type="defaultSemiBold" style={popupStyles.compactLabel}>{label}</ThemedText>
        <ThemedText type="small" themeColor="textHint" style={popupStyles.compactHint}>{hint}</ThemedText>
      </View>
    </Pressable>
  );
}

function CheckRow({
  checked,
  locked,
  onPress,
  colors,
  label,
  hint,
}: {
  checked: boolean;
  locked: boolean;
  onPress: () => void;
  colors: typeof Colors.light;
  label: string;
  hint: string;
}) {
  const Icon = checked ? FiCheckSquare : FiSquare;
  const iconColor = locked ? colors.textHint : checked ? Accent.base : colors.text;
  /* Compact density — matches CompactToggleRow padding/icon/font sizes so
     all popup rows read as one family. Locked state stays semantically
     distinct via the backgroundSelected fill + lock hint text. */
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        popupStyles.compactRow,
        {
          borderColor: colors.border,
          backgroundColor: locked ? colors.backgroundSelected : checked ? Accent.bg : 'transparent',
        },
        pressed && !locked && { opacity: 0.85 },
        locked && { opacity: 0.85 },
      ]}>
      <Icon size={18} color={iconColor} strokeWidth={2} />
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText type="defaultSemiBold" style={popupStyles.compactLabel}>{label}</ThemedText>
        <ThemedText type="small" themeColor="textHint" style={popupStyles.compactHint}>
          {locked ? 'ล็อกไว้ — ต้องมีอย่างน้อย 1 คอลัมน์เปิด' : hint}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/* ─── styles ─────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  cardPress: { width: '100%', flex: 1 },
  pressed: { opacity: 0.95 },
  /* cardWrapper holds the two rotated faces; preserve-3d is required on web
     so backface-visibility on each face actually hides the opposite-face
     content (including GlassMeta which creates its own stacking context via
     backdrop-filter). Without this, the back face leaks through the front. */
  cardWrapper: {
    width: '100%',
    flex: 1,
    minHeight: 320,
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ transformStyle: 'preserve-3d' } as object) : null),
  } as any,
  /* Overlay layer covering the entire card area — siblings of cardWrapper
     so they live OUTSIDE the 3D rendering context and stay visible during
     the rotateY flip animation. pointerEvents: 'box-none' lets card taps
     fall through except where actual buttons sit. */
  cardOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 20,
  },
  face: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    borderRadius: Radii.md,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  faceCenter: { justifyContent: 'center', alignItems: 'center', padding: Spacing.six },
  topStripe: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: Accent.base,
    pointerEvents: 'none',
  },
  backScrollStripe: {
    height: 3,
    marginHorizontal: -Spacing.six,    // bleed to card edge (counter the padding inside backScrollContent)
    marginTop: -Spacing.six,           // pull up to flush with top
    marginBottom: Spacing.four,
    backgroundColor: Accent.base,
  },
  frontContent: { gap: Spacing.four, alignItems: 'center' },
  /* Tight block — hero + speaker glued together so the affordance binds
     to what it reads. 6px internal gap, then parent frontContent's
     16px gap separates this block from the secondary line. */
  heroBlock: { alignItems: 'center', gap: 6 },
  term: {
    fontSize: 96,
    lineHeight: 100,
    textAlign: 'center',
    fontFamily: Platform.select({ web: '"Noto Serif JP", "Hiragino Mincho ProN", serif', default: undefined }),
    fontWeight: '300',
    letterSpacing: -1,
  },
  pronunciation: { fontSize: 18 },
  revealCue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  revealMono: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  pulseDot: {
    width: 6,
    height: 6,
    backgroundColor: Accent.base,
  },
  backScroll: { flex: 1, alignSelf: 'stretch' },
  /* Generous top padding so the hero answer clears both the top stripe and
     the glass meta pill at top-left, and breathes from the frame edge. */
  backScrollContent: {
    paddingTop: Spacing.six + 36,
    paddingHorizontal: Spacing.six,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  meaning: { textAlign: 'center', marginBottom: Spacing.one },
  backP: { textAlign: 'center', fontSize: 16 },
  backPRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  markdownWrap: { alignSelf: 'stretch' },
  allHiddenHint: { textAlign: 'center', padding: Spacing.six },
});

const popupStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    /* maxHeight caps panel growth so the ScrollView inside actually
       scrolls instead of pushing the modal off-screen on short mobile
       viewports. 92% of viewport keeps a sliver of overlay visible so
       the tap-outside-to-close affordance reads. */
    maxHeight: '92%',
    borderRadius: Radii.md,
    borderWidth: 1,
    /* Panel itself owns no padding — the ScrollView fills it edge-to-
       edge so the scrollbar gutter anchors to the modal's right
       border. Children (header + sections) supply their own inset via
       contentContainerStyle.paddingHorizontal. */
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  close: { padding: 4 },
  sectionBlock: { gap: Spacing.two },
  sectionLabel: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.sm,
    marginTop: Spacing.one,
  },
  swapAction: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  rows: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  /* Used by CompactToggleRow — same visual language as `.row` but
     tighter vertical padding + smaller icon column, so single-toggle
     sub-options don't claim the full row height that 5-column checks do. */
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  compactLabel: { fontSize: 13 },
  compactHint: { fontSize: 11 },
  /* Scroll body owns the entire panel interior — header is now nested
     inside so the scrollbar gutter sits flush with both the modal top
     and bottom borders (full-height scrollbar per user request).
     Children supply their own horizontal inset via contentContainer. */
  scrollBody: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? ({ overflowY: 'auto', scrollbarGutter: 'stable', scrollbarWidth: 'thin' } as any)
      : null),
  },
  scrollBodyContent: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
  },
  footnote: { fontStyle: 'italic' },
});

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
    hr:          { backgroundColor: colors.textSecondary, height: 1, marginVertical: Spacing.three, opacity: 0.3 },
  };
}
