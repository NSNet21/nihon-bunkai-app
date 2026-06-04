import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FiChevronDown, FiChevronRight, FiX } from 'react-icons/fi';

import { Accent, Colors, Radii, Spacing } from '@/constants/theme';
import type { Deck } from '@/data/types';
import { getDeckJumpRowState } from '@/lib/deck-jump';
import { buildExportHierarchy, type ExportHierarchyGroup } from '@/lib/import-export/export-hierarchy';
import { ThemedText } from './themed-text';

type Props = {
  visible: boolean;
  decks: Deck[];
  currentDeckId?: string;
  message?: string | null;
  colors: typeof Colors.light;
  onClose: () => void;
  onSelectDeck: (deck: Deck) => void;
};

export function QuickDeckSwitcher({
  visible,
  decks,
  currentDeckId,
  message,
  colors,
  onClose,
  onSelectDeck,
}: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const groups = buildExportHierarchy(decks);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, compact && styles.backdropCompact]} onPress={onClose}>
        <Pressable
          onPress={(event: any) => event.stopPropagation?.()}
          style={[
            styles.panel,
            compact && styles.panelCompact,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}>
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>// สลับ Deck</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                เลือก deck แล้วเปิด term แรกทันที
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิดตัวสลับ deck"
              style={({ pressed, hovered }: any) => [
                styles.iconBtn,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                (pressed || hovered) && { borderColor: Accent.soft },
                pressed && { opacity: 0.75 },
              ]}>
              <FiX size={16} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>

          {message ? (
            <View style={[styles.messageBox, { borderColor: Accent.soft, backgroundColor: Accent.bg }]}>
              <ThemedText type="small" style={{ color: Accent.base, fontWeight: '700' }}>
                {message}
              </ThemedText>
            </View>
          ) : null}

          <ScrollView style={styles.scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {groups.map((group) => (
              <SwitcherGroup
                key={group.key}
                group={group}
                currentDeckId={currentDeckId}
                colors={colors}
                onSelectDeck={onSelectDeck}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SwitcherGroup({
  group,
  currentDeckId,
  colors,
  onSelectDeck,
}: {
  group: ExportHierarchyGroup;
  currentDeckId?: string;
  colors: typeof Colors.light;
  onSelectDeck: (deck: Deck) => void;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <View style={[styles.rule, { backgroundColor: Accent.base }]} />
        <ThemedText type="defaultSemiBold" style={{ color: Accent.base }}>
          {group.label}
        </ThemedText>
      </View>
      {group.sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <View style={styles.sectionHeader}>
            <FiChevronDown size={14} color={colors.textHint} strokeWidth={2} />
            <ThemedText style={[styles.mono, { color: colors.textHint }]}>{section.label}</ThemedText>
          </View>
          {section.decks.map((deck) => {
            const state = getDeckJumpRowState(deck.id, currentDeckId);
            return (
              <Pressable
                key={deck.id}
                onPress={() => {
                  if (!state.disabled) onSelectDeck(deck);
                }}
                disabled={state.disabled}
                accessibilityRole="button"
                accessibilityLabel={`สลับไป ${deck.title}`}
                style={({ pressed, hovered }: any) => [
                  styles.deckRow,
                  {
                    borderColor: state.isCurrent ? Accent.soft : colors.border,
                    backgroundColor: state.isCurrent ? Accent.bg : colors.backgroundElement,
                    opacity: state.disabled ? 0.82 : 1,
                  },
                  (pressed || hovered) &&
                    !state.disabled && { borderColor: Accent.soft, backgroundColor: colors.backgroundSelected },
                  pressed && !state.disabled && { opacity: 0.78 },
                ]}>
                <View style={styles.deckText}>
                  <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ color: colors.text }}>
                    {deck.title}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: state.isCurrent ? Accent.base : colors.textSecondary }}>
                    {`${deck.entryCount} terms · ${state.meta}`}
                  </ThemedText>
                </View>
                <FiChevronRight size={16} color={state.isCurrent ? Accent.base : colors.textHint} strokeWidth={2} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  backdropCompact: {
    justifyContent: 'flex-end',
  },
  panel: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '82%',
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  panelCompact: {
    maxWidth: '100%',
    maxHeight: '78%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  mono: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    minHeight: 0,
  },
  messageBox: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  list: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  group: {
    gap: Spacing.two,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rule: {
    width: 18,
    height: 2,
  },
  section: {
    gap: Spacing.one,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingLeft: Spacing.two,
  },
  deckRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  deckText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
