import { startTransition, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FiCheck, FiX } from 'react-icons/fi';

import { ThemedText } from './themed-text';

import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemeActions, useThemeColors, type ThemeOverride } from '@/context/theme';

type Segment = { value: ThemeOverride; glyph: string; label: string };

const SEGMENTS: Segment[] = [
  { value: 'system', glyph: '◐', label: 'อัตโนมัติ' },
  { value: 'light',  glyph: '☀', label: 'สว่าง' },
  { value: 'dark',   glyph: '☾', label: 'มืด' },
];

/**
 * Theme selector — settings-row trigger + modal popup (3 options).
 *
 * Was a segmented pill control with a sliding indicator. The slide
 * animation kept breaking every refactor pass (Reanimated worklet sync
 * issues, useEffect after-commit lag, JS thread blockage on theme
 * cascade re-render). 2026-05-26 swapped to a row+popup pattern that
 * has ZERO animation — just two taps to switch theme, but immune to
 * future regressions and matches the VisibilityPopup pattern elsewhere
 * in the app.
 */
export function ThemeToggle() {
  const { override, setOverride } = useThemeActions();
  const { scheme: effective, colors } = useThemeColors();
  const [open, setOpen] = useState(false);

  /* Apply theme as a non-urgent transition — modal close + click feedback
     paint first, then the ~1000-node cascade re-renders in the next chunk.
     React 19 can interrupt this if the user keeps interacting, so taps
     never feel blocked. Modal animationType="fade" is preserved (user
     locked transition style 2026-05-26 — see [[theme-perf-cascade]]). */
  const applyTheme = (next: ThemeOverride) => {
    startTransition(() => {
      setOverride(next);
    });
    setOpen(false);
  };

  /* Clamp — corrupt persisted override (legacy value) shouldn't crash;
     fall back to the first segment (system). */
  const current = SEGMENTS.find((s) => s.value === override) ?? SEGMENTS[0];

  return (
    <View style={styles.outer}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`เปลี่ยนธีม · ตอนนี้คือ ${current.label}`}
        style={({ pressed }) => [
          styles.trigger,
          { borderColor: colors.border, backgroundColor: colors.backgroundElement },
          pressed && { opacity: 0.85 },
        ]}>
        <Text style={[styles.triggerGlyph, { color: colors.text }]}>{current.glyph}</Text>
        <View style={{ flex: 1 }}>
          <ThemedText type="defaultSemiBold">{current.label}</ThemedText>
          {override === 'system' && (
            <ThemedText type="small" themeColor="textSecondary">
              ตามอุปกรณ์ · ตอนนี้แสดง{effective === 'dark' ? 'มืด' : 'สว่าง'}
            </ThemedText>
          )}
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={popupStyles.overlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[popupStyles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation?.()}>
            <View style={popupStyles.header}>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold">เลือกธีม</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  อัตโนมัติจะตามค่าระบบของอุปกรณ์
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                style={({ pressed }) => [popupStyles.close, pressed && { opacity: 0.6 }]}>
                <FiX size={20} color={colors.text} strokeWidth={2} />
              </Pressable>
            </View>
            <View style={popupStyles.rows}>
              {SEGMENTS.map((seg) => {
                const active = seg.value === override;
                return (
                  <Pressable
                    key={seg.value}
                    onPress={() => applyTheme(seg.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`เลือกธีม ${seg.label}`}
                    style={({ pressed }) => [
                      popupStyles.row,
                      {
                        borderColor: colors.border,
                        backgroundColor: active ? Accent.bg : 'transparent',
                      },
                      pressed && !active && { opacity: 0.85 },
                    ]}>
                    <Text style={[popupStyles.rowGlyph, { color: active ? Accent.base : colors.text }]}>
                      {seg.glyph}
                    </Text>
                    <ThemedText type="defaultSemiBold" style={{ flex: 1 }}>
                      {seg.label}
                    </ThemedText>
                    {active && <FiCheck size={18} color={Accent.base} strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { gap: Spacing.two, alignItems: 'stretch' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  triggerGlyph: { fontSize: 22, lineHeight: 26, width: 24, textAlign: 'center' },
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
    maxWidth: 380,
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
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
  rowGlyph: { fontSize: 22, lineHeight: 26, width: 24, textAlign: 'center' },
});
