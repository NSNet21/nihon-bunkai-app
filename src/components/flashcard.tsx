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
};

const FLIP_DURATION = 500;

export function Flashcard({ entry, isFlipped, onFlip, visibility, onVisibilityChange, frontHero, onFrontHeroChange }: Props) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;

  const rotation = useSharedValue(isFlipped ? 180 : 0);
  const [popupOpen, setPopupOpen] = useState(false);

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

  return (
    <>
      <Pressable
        onPress={onFlip}
        style={({ pressed }) => [styles.cardPress, pressed && styles.pressed]}
        accessibilityLabel={isFlipped ? 'แตะเพื่อกลับด้านหน้า' : 'แตะเพื่อดูคำตอบ'}>
        <View style={styles.cardWrapper}>
          {/* Settings (visibility) icon — top-right, sits above both faces */}
          <View style={styles.cardSettingsAnchor} pointerEvents="box-none">
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                setPopupOpen(true);
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
            <View style={styles.frontContent}>
              <ThemedText style={styles.term}>{heroValue}</ThemedText>
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
              {/* Top stripe — scrolls with content (not pinned) per user request. */}
              <View style={styles.backScrollStripe} pointerEvents="none" />
              {visibility.d && (
                <ThemedText type="title" style={styles.meaning}>
                  {entry.d}
                </ThemedText>
              )}
              {visibility.pb && (
                <ThemedText type="default" themeColor="textSecondary" style={styles.backP}>
                  {entry.p}
                </ThemedText>
              )}
              {visibility.e && (
                <View style={styles.markdownWrap}>
                  <Markdown style={markdownStyles(colors)}>{entry.e}</Markdown>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Pressable>

      <VisibilityPopup
        visible={popupOpen}
        onClose={() => setPopupOpen(false)}
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

/* ─── pulse dot ──────────────────────────────────────────────────────── */

function PulseDot() {
  const op = useSharedValue(1);
  const scale = useSharedValue(1);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,   { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,   { duration: 900, easing: Easing.inOut(Easing.ease) }),
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
  visible,
  onClose,
  visibility,
  onToggle,
  colors,
  visibleFrontCount,
  visibleBackCount,
  frontHero,
  onSwapHero,
}: {
  visible: boolean;
  onClose: () => void;
  visibility: ColumnVisibility;
  onToggle: (k: keyof ColumnVisibility) => void;
  colors: typeof Colors.light;
  visibleFrontCount: number;
  visibleBackCount: number;
  frontHero: FrontHero;
  onSwapHero: () => void;
}) {
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
              <ThemedText type="defaultSemiBold">การแสดงผลคอลัมน์</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                เลือกที่จะซ่อน/แสดงในการ์ดนี้
              </ThemedText>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [popupStyles.close, pressed && { opacity: 0.6 }]}>
              <FiX size={20} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Front face — T + Pf (independent from back) */}
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
            {/* Swap hero — moved to external UX (Browse / session config) per user. */}
          </View>

          {/* Back face — D + Pb + E (independent from front) */}
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
  cardWrapper: { width: '100%', flex: 1, minHeight: 320, position: 'relative' },
  cardSettingsAnchor: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    zIndex: 10,
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
  backScrollContent: { padding: Spacing.six, gap: Spacing.three, alignItems: 'stretch' },
  meaning: { textAlign: 'center', marginBottom: Spacing.one },
  backP: { textAlign: 'center', fontSize: 16 },
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
