import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FiChevronLeft, FiChevronRight, FiSliders } from 'react-icons/fi';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Rating } from 'ts-fsrs';

import { Flashcard, VisibilityPopup, type ColumnVisibility, type FrontHero } from '@/components/flashcard';
import { RatingButtons } from '@/components/rating-buttons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { useAllDecks, entriesForDeckAsync } from '@/hooks/use-decks';
import type { Entry } from '@/data/types';
import type { LastSession } from '@/lib/last-session';

export default function StudyScreen() {
  const { deckId, entryId } = useLocalSearchParams<{ deckId?: string; entryId?: string }>();
  const { decks: allDecks } = useAllDecks();
  const deck = deckId ? allDecks.find((d) => d.id === deckId) : undefined;
  const [entries, setEntries] = useState<Entry[]>([]);
  const { showToast } = useToast();
  /* Side rails — on narrow viewports they flip from inline (eating
     row-space) to absolute OVER the card edges, freeing the full row
     width for the card itself.

     Rail size only needs MILD viewport scaling since overlay mode
     already solves the "rails squeeze the card" problem. Floor raised
     from 0.65 → 0.82 (was over-shrinking icons on mobile down to
     36×36, awkward as a hit target). Now mobile = 52×46, desktop =
     64×56 — both feel right for their context. */
  const { width: viewportW } = useWindowDimensions();
  const railT = Math.max(0, Math.min(1, (viewportW - 360) / (1024 - 360)));
  const railScale = 0.82 + railT * 0.18;          // 0.82 → 1.0
  const railWidth = Math.round(64 * railScale);   // 52 → 64
  const railIcon = Math.round(56 * railScale);    // 46 → 56
  const overlayRails = viewportW < 600;
  /* On mobile, stretch the gradient OVERLAY wider than the Pressable's
     tap column so the fade range is generous. Tap area stays railWidth.
     GPT verdict 2026-05-26: 0.35×W (~136px on 390px viewport, 272 across
     both rails) was eating too much of card middle — only 118px left
     for tap-reveal. Pulled to 0.22×W cap 100 → mobile rails take ~86px
     each, ~218 across, leaves 170+px clean center for tap reveal. */
  const railFillWidth = overlayRails
    ? Math.min(Math.round(viewportW * 0.22), 100)
    : railWidth;

  useEffect(() => {
    // Reset session state on deck switch — fresh front-card start every time.
    setIndex(0);
    setIsFlipped(false);
    setResults([]);

    let cancelled = false;
    if (!deckId) {
      setEntries([]);
      return;
    }
    void entriesForDeckAsync(deckId).then((rows) => {
      if (cancelled) return;
      setEntries(rows);
      // Jump to entryId if provided (from Search tap-through OR Continue card
      // restoring a prior session). If the entry no longer exists in this
      // deck (deleted, deck reordered, deep link expired), tell the user
      // instead of silently dumping them at index 0.
      if (entryId) {
        const jumpTo = rows.findIndex((r) => r.id === entryId);
        if (jumpTo >= 0) {
          setIndex(jumpTo);
        } else if (rows.length > 0) {
          showToast('ตัวการ์ดเดิมหาไม่เจอ เริ่มจากต้น', { kind: 'info' });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [deckId, entryId, showToast]);

  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<Rating[]>([]);
  /* Column visibility — persisted globally (Settings ↔ per-card popup share
     the same source). Pf / Pb are independent: user might want P shown on
     back (as confirmation) while hidden on front (force recall). */
  const [visibility, setVisibility] = usePersistedState<ColumnVisibility>(
    'visibility',
    { t: true, pf: true, pb: true, d: true, e: true },
  );
  const [frontHero, setFrontHero] = usePersistedState<FrontHero>('front-hero', 't');
  const [, setLastSession] = usePersistedState<LastSession | null>('last-session', null);
  /* Card columns config — popup lifted out of the Flashcard 2026-05-26.
     Trigger now lives in the header (FiSliders button) so it's clear of
     the overlay-rail hit zone on mobile. Auto-swap hero when hiding the
     active hero column happens here too. */
  const [configOpen, setConfigOpen] = useState(false);
  const visibleFrontCount = (visibility.t ? 1 : 0) + (visibility.pf ? 1 : 0);
  const visibleBackCount = (visibility.d ? 1 : 0) + (visibility.pb ? 1 : 0) + (visibility.e ? 1 : 0);
  const toggleColumn = (key: keyof ColumnVisibility) => {
    const next = { ...visibility, [key]: !visibility[key] };
    /* Front face must keep at least one of T or Pf */
    if (!next.t && !next.pf) return;
    /* Back face must keep at least one of D, Pb, or E */
    if (!next.d && !next.pb && !next.e) return;
    /* Auto-swap hero if the column it points at just got hidden */
    if (key === 't' && !next.t && frontHero === 't' && next.pf) setFrontHero('p');
    if (key === 'pf' && !next.pf && frontHero === 'p' && next.t) setFrontHero('t');
    setVisibility(next);
  };

  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;

  const current = entries[index];
  const isComplete = entries.length > 0 && index >= entries.length;
  const canPrev = index > 0;
  const canNext = index < entries.length - 1;

  /* Persist study position so Browse can offer "Continue · {deck} · {idx}/{total}".
     Bail when there's no real entry (loading / empty / past-end / no deck). */
  useEffect(() => {
    if (!deck || !current || isComplete) return;
    setLastSession({
      deckId: deck.id,
      deckTitle: deck.title,
      entryId: current.id,
      index,
      total: entries.length,
      updatedAt: Date.now(),
    });
  }, [deck, current, index, entries.length, isComplete, setLastSession]);

  function handleRate(rating: Rating) {
    setResults((prev) => [...prev, rating]);
    setIsFlipped(false);
    /* Finishing the deck retires the Continue CTA — Browse only shows it
       for sessions that still have cards left to study. */
    if (index >= entries.length - 1) setLastSession(null);
    setIndex((i) => i + 1);
  }

  function handlePrev() {
    if (!canPrev) return;
    setIsFlipped(false);
    setIndex((i) => i - 1);
  }

  function handleNext() {
    if (!canNext) return;
    setIsFlipped(false);
    setIndex((i) => i + 1);
  }

  function handleRestart() {
    setIndex(0);
    setIsFlipped(false);
    setResults([]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.content}>
          {!deck ? (
            <EmptyState
              title="ยังไม่ได้เลือก Deck"
              body="เลือก deck จากแท็บ Browse เพื่อเริ่มเรียน"
            />
          ) : entries.length === 0 ? (
            <EmptyState
              title={deck.title}
              body="Deck นี้ยังไม่มี entry — paid tier จะปลดล็อกหลังซื้อจาก nihon-bunkai-landing.pages.dev"
            />
          ) : isComplete ? (
            <SessionComplete deckTitle={deck.title} results={results} onRestart={handleRestart} />
          ) : (
            <>
              <View style={styles.header}>
                <ThemedText type="defaultSemiBold">{deck.title}</ThemedText>
                <View style={styles.headerRight}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {index + 1} / {entries.length}
                  </ThemedText>
                  <Pressable
                    onPress={() => setConfigOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="ตั้งค่าการแสดงผลคอลัมน์"
                    style={({ pressed }) => [
                      styles.headerConfigBtn,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <FiSliders size={16} color={colors.text} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.cardRow}>
                {!overlayRails && (
                  <SideRail
                    direction="left"
                    onPress={handlePrev}
                    disabled={!canPrev}
                    colors={colors}
                    width={railWidth}
                    iconSize={railIcon}
                  />
                )}
                <View style={styles.cardSlot}>
                  <Flashcard
                    entry={current}
                    isFlipped={isFlipped}
                    onFlip={() => setIsFlipped((f) => !f)}
                    visibility={visibility}
                    frontHero={frontHero}
                    index={index}
                    total={entries.length}
                    deckTitle={deck.title}
                    onSwipeNext={handleNext}
                    onSwipePrev={handlePrev}
                    canSwipeNext={canNext}
                    canSwipePrev={canPrev}
                  />
                  {/* Overlay rails on narrow viewports — both faces.
                      Idle opacity = 0 (fully transparent) so the icon
                      never visually fights with content. Press-down
                      reveals instantly; press-up fades back to fully
                      hidden. Tap area works regardless of opacity. */}
                  {overlayRails && (
                    <OverlayRailButton
                      direction="left"
                      side="left"
                      onPress={handlePrev}
                      disabled={!canPrev}
                      colors={colors}
                      width={railWidth}
                      iconSize={railIcon}
                      fillWidth={railFillWidth}
                      isDark={scheme === 'dark'}
                    />
                  )}
                  {overlayRails && (
                    <OverlayRailButton
                      direction="right"
                      side="right"
                      onPress={handleNext}
                      disabled={!canNext}
                      colors={colors}
                      width={railWidth}
                      iconSize={railIcon}
                      fillWidth={railFillWidth}
                      isDark={scheme === 'dark'}
                    />
                  )}
                </View>
                {!overlayRails && (
                  <SideRail
                    direction="right"
                    onPress={handleNext}
                    disabled={!canNext}
                    colors={colors}
                    width={railWidth}
                    iconSize={railIcon}
                  />
                )}
              </View>
              <RatingButtons onRate={handleRate} disabled={!isFlipped} />
              <BrandStrip colors={colors} />
              <VisibilityPopup
                visible={configOpen}
                onClose={() => setConfigOpen(false)}
                visibility={visibility}
                onToggle={toggleColumn}
                colors={colors}
                visibleFrontCount={visibleFrontCount}
                visibleBackCount={visibleBackCount}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Editorial footer mark — anchors the study session in the brand. */
function BrandStrip({ colors }: { colors: typeof Colors.light }) {
  return (
    <View style={brandStyles.row} pointerEvents="none">
      <ThemedText style={[brandStyles.text, { color: colors.textHint }]}>
        NIHON BUNKAI · 鍛練精進
      </ThemedText>
    </View>
  );
}

function SideRail({
  direction,
  onPress,
  disabled,
  colors,
  width = 64,
  iconSize = 56,
}: {
  direction: 'left' | 'right';
  onPress: () => void;
  disabled: boolean;
  colors: typeof Colors.light;
  /** Continuous viewport-driven width — shrinks on mobile so the rails
   *  don't eat 40% of the card's horizontal space. Defaults preserve
   *  legacy desktop behavior. */
  width?: number;
  iconSize?: number;
}) {
  const Icon = direction === 'left' ? FiChevronLeft : FiChevronRight;
  const accessibilityLabel = direction === 'left' ? 'Previous card' : 'Next card';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        railStyles.button,
        { width },
        pressed && !disabled && railStyles.pressed,
        disabled && railStyles.disabled,
      ]}>
      <Icon size={iconSize} color={colors.textSecondary} strokeWidth={1.5} />
    </Pressable>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.center}>
      <ThemedText type="title">{title}</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.emptyBody}>
        {body}
      </ThemedText>
    </View>
  );
}

function SessionComplete({
  deckTitle,
  results,
  onRestart,
}: {
  deckTitle: string;
  results: Rating[];
  onRestart: () => void;
}) {
  return (
    <View style={styles.center}>
      <ThemedText type="title">เรียนจบแล้ว 🎌</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        {deckTitle} · {results.length} cards
      </ThemedText>
      <View style={styles.completeActions}>
        <Pressable onPress={onRestart} style={({ pressed }) => [styles.restartBtn, pressed && styles.pressed]}>
          <ThemedText type="defaultSemiBold" style={{ color: Accent.base }}>
            เรียนรอบใหม่
          </ThemedText>
        </Pressable>
        <Link href="/" asChild>
          <Pressable style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
            <ThemedText type="default" themeColor="textSecondary">
              กลับไป Browse
            </ThemedText>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: {
    flex: 1,
    padding: Spacing.four,
    paddingTop: Spacing.six + Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerConfigBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  cardSlot: { flex: 1, alignSelf: 'stretch' },
  center: { flex: 1, gap: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  emptyBody: { textAlign: 'center', maxWidth: 360 },
  completeActions: { gap: Spacing.two, marginTop: Spacing.four, alignItems: 'center' },
  restartBtn: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Accent.base,
  },
  linkBtn: {
    paddingVertical: Spacing.two,
  },
  pressed: { opacity: 0.7 },
});

const railStyles = StyleSheet.create({
  /* width supplied inline per-render so it can scale with viewport. */
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.2 },
});

/* Overlay rail button — used on narrow viewports (<600px). Pressable
   spans the FULL card height so the user can stab anywhere on the
   left/right edge column without aiming at the small icon. Icon itself
   is hidden by default (opacity 0) and fades in on tap → holds briefly
   → fades out, so the chrome stays out of the way until the user asks
   for it. Tap area still works while invisible since Pressable hit-
   testing ignores opacity. zIndex 15 sits below cardOverlay (FootDots
   z=20 inside flashcard.tsx) so progress dots stay clean. */
const overlayRailStyles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  /* bgFill — wide gradient layer that extends INWARD past the Pressable
     bounds (mobile only) so the gradient fade range is generous, not
     compressed into the 52px tap column. Anchored to `[side]: 0` +
     explicit `width` via inline style; children = none. */
  bgFill: {
    position: 'absolute',
    top: 0, bottom: 0,
  },
  /* iconBox — sits inside the Pressable's actual bounds + centers the
     icon at the edge. Stacked on top of bgFill via render order. Both
     layers share the same opacity (Animated.View aStyle). */
  iconBox: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Hide-until-tapped chevron on the card edge. IDLE opacity 0 (fully
 *  transparent) — GPT had suggested 0.06 hint, but user feedback in
 *  testing showed even that faint trace fought with text on the back
 *  face. Cleaner to commit to "0 idle / press = visible / release fade
 *  to 0". Tap area still works since Pressable hit-testing ignores
 *  opacity. Discoverability is a trade-off taken on real-world feedback. */
const IDLE_OPACITY = 0;

function OverlayRailButton({
  direction,
  side,
  onPress,
  disabled,
  colors,
  width,
  iconSize,
  fillWidth,
  isDark,
}: {
  direction: 'left' | 'right';
  side: 'left' | 'right';
  onPress: () => void;
  disabled: boolean;
  colors: typeof Colors.light;
  width: number;
  iconSize: number;
  /** How wide the visible gradient layer is. Can exceed `width` (the
   *  Pressable's tap column) to give the fade more horizontal room. */
  fillWidth: number;
  /** Light theme needs DARK tint (white-on-cream is barely visible);
   *  dark theme needs WHITE tint. Caller passes the resolved scheme. */
  isDark: boolean;
}) {
  const opacity = useSharedValue(IDLE_OPACITY);
  const Icon = direction === 'left' ? FiChevronLeft : FiChevronRight;
  const ariaLabel = direction === 'left' ? 'Previous card' : 'Next card';

  /* Per-side + per-theme gradient:
       - Light: warm-charcoal tint (rgba(20,18,16,0.22)) — shows up as
         soft shadow on cream bg. Higher alpha than dark theme since
         dark-on-cream contrast is gentler than white-on-charcoal.
       - Dark: white tint (rgba(255,255,255,0.42)) — original.
     Gradient starts solid at the edge (`to right` for left, `to left`
     for right), fades to transparent toward card center.
     Native fallback: flat solid tint (no backgroundImage support). */
  const rgb = isDark ? '255, 255, 255' : '20, 18, 16';
  const peakAlpha = isDark ? 0.42 : 0.22;
  const direction_css = direction === 'left' ? 'to right' : 'to left';
  const overlayBg = Platform.select({
    web: {
      backgroundImage: `linear-gradient(${direction_css}, rgba(${rgb}, ${peakAlpha}) 0%, rgba(${rgb}, 0) 100%)`,
    } as object,
    default: { backgroundColor: `rgba(${rgb}, ${isDark ? 0.18 : 0.10})` },
  });

  function handlePressIn() {
    if (disabled) return;
    /* Cancel any in-flight fade-out, snap to fully visible. duration 0 =
       instant per Reanimated semantics — feels like a hard cut, matching
       finger-down. */
    opacity.value = withTiming(1, { duration: 0 });
  }

  function handlePressOut() {
    /* Gentle dismiss back to IDLE opacity (not full 0) — affordance
       remains barely perceptible. 90ms hold + 520ms fade. */
    opacity.value = withDelay(
      90,
      withTiming(IDLE_OPACITY, { duration: 520, easing: Easing.bezier(0.4, 0, 1, 1) }),
    );
  }

  function handlePress() {
    if (disabled) return;
    onPress();
  }

  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      style={[overlayRailStyles.btn, { [side]: 0, width }]}>
      {/* bgFill = wide gradient layer (can exceed Pressable bounds);
          iconBox = icon centered inside Pressable's actual bounds. */}
      <Animated.View
        style={[overlayRailStyles.bgFill, overlayBg, aStyle, { [side]: 0, width: fillWidth }]}
        pointerEvents="none"
      />
      <Animated.View style={[overlayRailStyles.iconBox, aStyle]} pointerEvents="none">
        <Icon size={iconSize} color={colors.textSecondary} strokeWidth={1.5} />
      </Animated.View>
    </Pressable>
  );
}

const brandStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.three,
  },
  text: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});
