import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiCheckSquare, FiSliders, FiSquare, FiX } from 'react-icons/fi';
import Markdown from 'react-native-markdown-display';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { ThemedText } from './themed-text';

import { Accent, Colors, Radii, Spacing } from '@/constants/theme';
import type { Entry } from '@/data/types';

export type ColumnVisibility = { d: boolean; p: boolean; e: boolean };

type Props = {
  entry: Entry;
  isFlipped: boolean;
  onFlip: () => void;
  visibility: ColumnVisibility;
  onVisibilityChange: (next: ColumnVisibility) => void;
};

const FLIP_DURATION = 500;

export function Flashcard({ entry, isFlipped, onFlip, visibility, onVisibilityChange }: Props) {
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

  function toggleColumn(key: keyof ColumnVisibility) {
    onVisibilityChange({ ...visibility, [key]: !visibility[key] });
  }

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

          {/* Front face — T + (optionally) P */}
          <Animated.View
            style={[
              styles.face,
              styles.faceCenter,
              { backgroundColor: colors.backgroundElement },
              frontStyle,
            ]}>
            <View style={styles.frontContent}>
              <ThemedText style={styles.term}>{entry.t}</ThemedText>
              {visibility.p && (
                <ThemedText type="default" themeColor="textSecondary" style={styles.pronunciation}>
                  {entry.p}
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                แตะเพื่อดูคำตอบ
              </ThemedText>
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
              {visibility.p && (
                <ThemedText type="default" themeColor="textSecondary" style={styles.backP}>
                  {entry.p}
                </ThemedText>
              )}
              {visibility.e && (
                <View style={styles.markdownWrap}>
                  <Markdown style={markdownStyles(colors)}>{entry.e}</Markdown>
                </View>
              )}
              {!visibility.d && !visibility.e && !visibility.p && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.allHiddenHint}>
                  ทุกคอลัมน์ถูกซ่อน — แตะ icon ↗ เพื่อเลือกที่จะแสดง
                </ThemedText>
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
      />
    </>
  );
}

/* ─── popup ──────────────────────────────────────────────────────────── */

function VisibilityPopup({
  visible,
  onClose,
  visibility,
  onToggle,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  visibility: ColumnVisibility;
  onToggle: (k: keyof ColumnVisibility) => void;
  colors: typeof Colors.light;
}) {
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

          <View style={popupStyles.rows}>
            <CheckRow
              checked={visibility.d}
              onPress={() => onToggle('d')}
              colors={colors}
              label="D · ความหมาย (Thai)"
              hint="แสดงเป็น title หลังพลิกการ์ด"
            />
            <CheckRow
              checked={visibility.p}
              onPress={() => onToggle('p')}
              colors={colors}
              label="P · คำอ่าน (Pronunciation)"
              hint="แสดงทั้งหน้า + หลังการ์ด"
            />
            <CheckRow
              checked={visibility.e}
              onPress={() => onToggle('e')}
              colors={colors}
              label="E · คำอธิบาย (Explanation)"
              hint="markdown sections — Breakdown / Examples"
            />
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        popupStyles.row,
        { borderColor: colors.border, backgroundColor: checked ? Accent.bg : 'transparent' },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon size={22} color={checked ? Accent.base : colors.text} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="defaultSemiBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
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
  frontContent: { gap: Spacing.three, alignItems: 'center' },
  term: { fontSize: 64, lineHeight: 80, textAlign: 'center' },
  pronunciation: { fontSize: 18 },
  hint: { opacity: 0.6, marginTop: Spacing.two },
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
