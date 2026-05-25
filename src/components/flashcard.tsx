import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiCheckSquare, FiSliders, FiSquare, FiX } from 'react-icons/fi';
import Markdown from 'react-native-markdown-display';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
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
  onVisibilityChange: (next: ColumnVisibility) => void;
  frontHero: FrontHero;
  onFrontHeroChange: (next: FrontHero) => void;
  /** Optional session position — drives top-meta + foot-dots progress. */
  index?: number;
  total?: number;
  /** Optional deck title — appended to top meta (e.g. "Kanji N5 · Pack 01"). */
  deckTitle?: string;
};

const FLIP_DURATION = 500;

export function Flashcard({ entry, isFlipped, onFlip, visibility, onVisibilityChange, frontHero, onFrontHeroChange, index, total, deckTitle }: Props) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;

  const rotation = useSharedValue(isFlipped ? 180 : 0);
  /* Which face's config popup is open, if any — split per-face so each icon
     only manages the columns of its own face (locked decision 2026-05-25). */
  const [popupOpen, setPopupOpen] = useState<'front' | 'back' | null>(null);

  useEffect(() => {
    rotation.value = withTiming(isFlipped ? 180 : 0, {
      duration: FLIP_DURATION,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [isFlipped, rotation]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value + 180}deg` }],
  }));

  /* Toggle a column, but bail if it would empty the relevant face. */
  function toggleColumn(key: keyof ColumnVisibility) {
    const next = { ...visibility, [key]: !visibility[key] };
    /* Front face must keep at least one of T or Pf */
    if (!next.t && !next.pf) return;
    /* Back face must keep at least one of D, Pb, or E */
    if (!next.d && !next.pb && !next.e) return;
    /* If we just hid the current hero, auto-swap to the other front-face column */
    if (key === 't'  && !next.t  && frontHero === 't' && next.pf) onFrontHeroChange('p');
    if (key === 'pf' && !next.pf && frontHero === 'p' && next.t)  onFrontHeroChange('t');
    onVisibilityChange(next);
  }

  function swapHero() {
    const next: FrontHero = frontHero === 't' ? 'p' : 't';
    /* Only allow swap to a visible column */
    if (next === 't' && !visibility.t)  return;
    if (next === 'p' && !visibility.pf) return;
    onFrontHeroChange(next);
  }

  const visibleBackCount  = (visibility.d ? 1 : 0) + (visibility.pb ? 1 : 0) + (visibility.e ? 1 : 0);
  const visibleFrontCount = (visibility.t ? 1 : 0) + (visibility.pf ? 1 : 0);

  /* Resolve front hero: respect setting, but fall back if chosen column is hidden. */
  const heroKey: FrontHero =
    frontHero === 't' && visibility.t  ? 't'
    : frontHero === 'p' && visibility.pf ? 'p'
    : visibility.t ? 't' : 'p';
  const heroValue = heroKey === 't' ? entry.t : entry.p;
  const secondaryKey: FrontHero = heroKey === 't' ? 'p' : 't';
  const secondaryVisible = heroKey === 't' ? visibility.pf : visibility.t;
  const secondaryValue   = secondaryKey === 't' ? entry.t : entry.p;

  const hasProgress = typeof index === 'number' && typeof total === 'number' && total > 0;
  /* Editorial top meta — `CARD 01 / 20 // KANJI N5 · PACK 01`.
     Falls back gracefully if either piece is missing. Hidden when the
     user toggles it off in Settings (persisted under nb.show-card-meta). */
  const [showMeta] = usePersistedState<boolean>('show-card-meta', true);
  const metaText = hasProgress && showMeta
    ? `CARD ${String(index! + 1).padStart(2, '0')} / ${total}${deckTitle ? ` // ${deckTitle.toUpperCase()}` : ''}`
    : null;

  return (
    <>
      <Pressable
        onPress={onFlip}
        style={({ pressed }) => [styles.cardPress, pressed && styles.pressed]}
        accessibilityLabel={isFlipped ? 'แตะเพื่อกลับด้านหน้า' : 'แตะเพื่อดูคำตอบ'}>
        <View style={styles.cardWrapper}>
          {/* Front face — hero (T or P) + (optionally) the other as secondary */}
          <Animated.View
            style={[
              styles.face,
              styles.faceCenter,
              { backgroundColor: colors.backgroundElement },
              frontStyle,
            ]}>
            {/* Top crimson stripe — editorial frame edge */}
            <View style={styles.topStripe} pointerEvents="none" />
            {metaText && <GlassMeta text={metaText} colors={colors} />}
            <FaceSettingsButton colors={colors} side="front" onPress={(s) => setPopupOpen(s)} />
            <View style={styles.frontContent}>
              {/* Hero T + speaker directly underneath. Placing the speaker
                  BELOW T (but ABOVE the secondary P) makes the association
                  unambiguous — the speaker reads the big text right above
                  it, while the smaller P below is visually separated by
                  the speaker itself acting as a divider. */}
              <ThemedText style={styles.term}>{heroValue}</ThemedText>
              {heroValue ? (
                <SpeakButton text={heroValue} language="ja-JP" colors={colors} size="md" />
              ) : null}
              {secondaryVisible && secondaryValue ? (
                <ThemedText type="default" themeColor="textSecondary" style={styles.pronunciation}>
                  {secondaryValue}
                </ThemedText>
              ) : null}
              {/* Reveal cue — mono editorial label + pulsing crimson square */}
              <View style={styles.revealCue}>
                <PulseDot />
                <ThemedText style={[styles.revealMono, { color: colors.textHint }]}>
                  แตะ <ThemedText style={[styles.revealMono, { color: Accent.base }]}>·</ThemedText> TAP TO REVEAL
                </ThemedText>
              </View>
            </View>
          </Animated.View>

          {/* Back face — D (meaning) + E (explanation), each toggleable */}
          <Animated.View
            style={[styles.face, { backgroundColor: colors.backgroundElement }, backStyle]}>
            <ScrollView
              style={styles.backScroll}
              contentContainerStyle={styles.backScrollContent}
              showsVerticalScrollIndicator>
              {visibility.d && (
                <ThemedText type="title" style={styles.meaning}>
                  {entry.d}
                </ThemedText>
              )}
              {visibility.pb && entry.p ? (
                <View style={styles.backPRow}>
                  <ThemedText type="default" themeColor="textSecondary" style={styles.backP}>
                    {entry.p}
                  </ThemedText>
                  <SpeakButton text={entry.p} language="ja-JP" colors={colors} />
                </View>
              ) : null}
              {visibility.e && (
                <View style={styles.markdownWrap}>
                  <Markdown style={markdownStyles(colors)}>{entry.e}</Markdown>
                </View>
              )}
            </ScrollView>
            {/* Top crimson stripe — rendered AFTER ScrollView so it cleanly
                covers the scrollbar's top edge (otherwise scrollbar shows
                the stripe red bleeding through). */}
            <View style={styles.topStripe} pointerEvents="none" />
            {/* Glass meta — absolute-positioned overlay; scrolling content
                slides UNDER it (backdrop-blur for the frosted editorial edge). */}
            {metaText && <GlassMeta text={metaText} colors={colors} />}
            <FaceSettingsButton colors={colors} side="back" onPress={(s) => setPopupOpen(s)} />
          </Animated.View>
        </View>

        {/* Overlay layer — sits OUTSIDE the 3D context of cardWrapper so the
            foot-dots progress stays flat and fades over the flip rather than
            disappearing edge-on at 90°. */}
        <View style={styles.cardOverlay} pointerEvents="box-none">
          {hasProgress && <FootDots index={index!} total={total!} colors={colors} isFlipped={isFlipped} />}
        </View>
      </Pressable>

      <VisibilityPopup
        face={popupOpen}
        onClose={() => setPopupOpen(null)}
        visibility={visibility}
        onToggle={toggleColumn}
        colors={colors}
        visibleFrontCount={visibleFrontCount}
        visibleBackCount={visibleBackCount}
        frontHero={frontHero}
        onSwapHero={swapHero}
      />
    </>
  );
}

/* ─── face settings button ───────────────────────────────────────────── */

/** Settings icon sitting INSIDE a face so it rotates with the card during
 *  the flip ("stuck to the card"). Front face uses the normal right inset;
 *  back face is shifted inward to clear the ScrollView scrollbar. */
function FaceSettingsButton({
  colors,
  side,
  onPress,
}: {
  colors: typeof Colors.light;
  side: 'front' | 'back';
  onPress: (side: 'front' | 'back') => void;
}) {
  const rightOffset = side === 'front' ? Spacing.three : Spacing.three + 14;
  return (
    <View
      style={[faceSettingsStyles.anchor, { right: rightOffset }]}
      pointerEvents="box-none">
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          onPress(side);
        }}
        style={({ pressed }) => [
          styles.settingsBtn,
          { borderColor: colors.border, backgroundColor: colors.background },
          pressed && styles.settingsBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="ตั้งค่าการแสดงผลคอลัมน์">
        <FiSliders size={16} color={colors.text} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const faceSettingsStyles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: Spacing.three,
    zIndex: 10,
  },
});

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
  const isDark = colors.background === Colors.dark.background;
  /* Warm cream / warm charcoal alpha + backdrop blur — the editorial glass
     pill. Stays fixed at top of each face while scrolled content passes
     underneath, blurred. The leak-through-3D issue is solved at the
     cardWrapper level (transformStyle: preserve-3d) — see styles below. */
  const bg = isDark ? 'rgba(28, 24, 22, 0.55)' : 'rgba(252, 248, 238, 0.55)';
  const border = isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)';
  const webGlass = Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(8px) saturate(140%)', WebkitBackdropFilter: 'blur(8px) saturate(140%)' } as any)
    : null;
  return (
    <View
      pointerEvents="none"
      style={[
        glassStyles.pill,
        variant === 'overlay' ? glassStyles.overlay : glassStyles.inline,
        { backgroundColor: bg, borderColor: border },
        webGlass,
      ]}>
      <ThemedText style={[glassStyles.text, { color: colors.textSecondary }]}>{text}</ThemedText>
    </View>
  );
}

const glassStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 0,           // sharp — editorial
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  /* Compact pill in the top-left corner of each face, sits below red stripe. */
  overlay: {
    position: 'absolute',
    top: 8,
    left: 10,
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
    <Animated.View style={[footDotsStyles.row, aStyle]} pointerEvents="none">
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
  },
  dot: {
    width: 5,
    height: 5,
  },
});

/* ─── pulse dot ──────────────────────────────────────────────────────── */

function PulseDot() {
  const op = useSharedValue(1);
  const scale = useSharedValue(1);
  useEffect(() => {
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
  }, [op, scale]);
  const aStyle = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.pulseDot, aStyle]} />;
}

/* ─── popup ──────────────────────────────────────────────────────────── */

function VisibilityPopup({
  face,
  onClose,
  visibility,
  onToggle,
  colors,
  visibleFrontCount,
  visibleBackCount,
}: {
  face: 'front' | 'back' | null;
  onClose: () => void;
  visibility: ColumnVisibility;
  onToggle: (k: keyof ColumnVisibility) => void;
  colors: typeof Colors.light;
  visibleFrontCount: number;
  visibleBackCount: number;
  /* frontHero / onSwapHero accepted to keep call-site stable; UX moved out. */
  frontHero?: FrontHero;
  onSwapHero?: () => void;
}) {
  const visible = face !== null;
  const title   = face === 'front' ? 'ด้านหน้า' : 'ด้านหลัง';
  const sublabel = face === 'front'
    ? 'เลือกคอลัมน์ที่จะแสดงด้านหน้า'
    : 'เลือกคอลัมน์ที่จะแสดงด้านหลัง';
  /* Lock the last-remaining column on each face so the user can't blank it. */
  const frontOnly = visibleFrontCount === 1;
  const backOnly  = visibleBackCount === 1;
  const tLocked   = visibility.t  && frontOnly;
  const pfLocked  = visibility.pf && frontOnly;
  const pbLocked  = visibility.pb && backOnly;
  const dLocked   = visibility.d  && backOnly;
  const eLocked   = visibility.e  && backOnly;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={popupStyles.overlay} onPress={onClose}>
        <Pressable
          style={[popupStyles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation?.()}>
          <View style={popupStyles.header}>
            <View>
              <ThemedText type="defaultSemiBold">การแสดงผลคอลัมน์ · {title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{sublabel}</ThemedText>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [popupStyles.close, pressed && { opacity: 0.6 }]}>
              <FiX size={20} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>

          {face === 'front' && (
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
          )}

          {face === 'back' && (
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
          )}

          <ThemedText type="small" themeColor="textSecondary" style={popupStyles.footnote}>
            ค่าเลือกใช้ทั้ง session · global default + Quiz Config มาใน polish round
          </ThemedText>
        </Pressable>
      </Pressable>
    </Modal>
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
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        popupStyles.row,
        {
          borderColor: colors.border,
          backgroundColor: locked ? colors.backgroundSelected : checked ? Accent.bg : 'transparent',
        },
        pressed && !locked && { opacity: 0.85 },
        locked && { opacity: 0.85 },
      ]}>
      <Icon size={22} color={iconColor} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="defaultSemiBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
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
     the rotateY flip animation. pointerEvents="box-none" lets card taps
     fall through except where actual buttons sit. */
  cardOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 20,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnPressed: { opacity: 0.7 },
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
  },
  backScrollStripe: {
    height: 3,
    marginHorizontal: -Spacing.six,    // bleed to card edge (counter the padding inside backScrollContent)
    marginTop: -Spacing.six,           // pull up to flush with top
    marginBottom: Spacing.four,
    backgroundColor: Accent.base,
  },
  frontContent: { gap: Spacing.four, alignItems: 'center' },
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
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.four,
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
  footnote: { fontStyle: 'italic' },
});

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
