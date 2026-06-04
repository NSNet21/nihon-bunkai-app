import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FiChevronDown, FiChevronRight, FiX } from 'react-icons/fi';

import { Accent, Colors, Radii, Spacing } from '@/constants/theme';
import type { Deck } from '@/data/types';
import { getDeckJumpRowState } from '@/lib/deck-jump';
import { buildExportHierarchy, type ExportHierarchyGroup } from '@/lib/import-export/export-hierarchy';
import { ThemedText } from './themed-text';

const LEARNING_SECTION_ORDER = ['Kanji', 'Grammar', 'Vocab', 'Glossary', 'Decks'];

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
  const [closedGroups, setClosedGroups] = useState<Set<string>>(() => new Set());
  const [closedSections, setClosedSections] = useState<Set<string>>(() => new Set());
  const groups = buildExportHierarchy(decks).map((group) => ({
    ...group,
    sections: [...group.sections].sort((a, b) => compareLearningSections(a.label, b.label)),
  }));
  const toggleGroup = (groupKey: string) => {
    setClosedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };
  const toggleSection = (sectionKey: string) => {
    setClosedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };
  const expandAll = () => {
    setClosedGroups(new Set());
    setClosedSections(new Set());
  };
  const openGroups = () => {
    setClosedGroups(new Set());
  };
  const foldGroups = () => {
    setClosedGroups(new Set(groups.map((group) => group.key)));
  };
  const openSections = () => {
    setClosedSections(new Set());
  };
  const foldSections = () => {
    setClosedSections(new Set(groups.flatMap((group) => group.sections.map((section) => section.key))));
  };

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

          <View style={styles.controlRow}>
            <Pressable
              onPress={expandAll}
              accessibilityRole="button"
              accessibilityLabel="เปิดรายการ deck ทั้งหมด"
              style={({ pressed, hovered }: any) => [
                styles.controlBtn,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                (pressed || hovered) && { borderColor: Accent.soft },
                pressed && { opacity: 0.75 },
              ]}>
              <ThemedText type="small" style={{ color: colors.text }}>
                All
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={openGroups}
              accessibilityRole="button"
              accessibilityLabel="เปิด group ทั้งหมด"
              style={({ pressed, hovered }: any) => [
                styles.controlBtn,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                (pressed || hovered) && { borderColor: Accent.soft },
                pressed && { opacity: 0.75 },
              ]}>
              <ThemedText type="small" style={{ color: colors.text }}>
                Group Open
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={foldGroups}
              accessibilityRole="button"
              accessibilityLabel="พับ group ทั้งหมด"
              style={({ pressed, hovered }: any) => [
                styles.controlBtn,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                (pressed || hovered) && { borderColor: Accent.soft },
                pressed && { opacity: 0.75 },
              ]}>
              <ThemedText type="small" style={{ color: colors.text }}>
                Group Fold
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={openSections}
              accessibilityRole="button"
              accessibilityLabel="เปิด sub-group ทั้งหมด"
              style={({ pressed, hovered }: any) => [
                styles.controlBtn,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                (pressed || hovered) && { borderColor: Accent.soft },
                pressed && { opacity: 0.75 },
              ]}>
              <ThemedText type="small" style={{ color: colors.text }}>
                Sub Open
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={foldSections}
              accessibilityRole="button"
              accessibilityLabel="พับ sub-group ทั้งหมด"
              style={({ pressed, hovered }: any) => [
                styles.controlBtn,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                (pressed || hovered) && { borderColor: Accent.soft },
                pressed && { opacity: 0.75 },
              ]}>
              <ThemedText type="small" style={{ color: colors.text }}>
                Sub Fold
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {groups.map((group) => (
              <SwitcherGroup
                key={group.key}
                group={group}
                currentDeckId={currentDeckId}
                colors={colors}
                isClosed={closedGroups.has(group.key)}
                onToggleGroup={toggleGroup}
                closedSections={closedSections}
                onToggleSection={toggleSection}
                onSelectDeck={onSelectDeck}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function compareLearningSections(a: string, b: string) {
  const ai = LEARNING_SECTION_ORDER.indexOf(a);
  const bi = LEARNING_SECTION_ORDER.indexOf(b);
  if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
  return a.localeCompare(b, 'en');
}

function SwitcherGroup({
  group,
  currentDeckId,
  colors,
  isClosed,
  onToggleGroup,
  closedSections,
  onToggleSection,
  onSelectDeck,
}: {
  group: ExportHierarchyGroup;
  currentDeckId?: string;
  colors: typeof Colors.light;
  isClosed: boolean;
  onToggleGroup: (groupKey: string) => void;
  closedSections: ReadonlySet<string>;
  onToggleSection: (sectionKey: string) => void;
  onSelectDeck: (deck: Deck) => void;
}) {
  return (
    <View style={styles.group}>
      <Pressable
        onPress={() => onToggleGroup(group.key)}
        accessibilityRole="button"
        accessibilityLabel={`${isClosed ? 'เปิด' : 'พับ'} ${group.label}`}
        style={({ pressed, hovered }: any) => [
          styles.groupHeader,
          (pressed || hovered) && { opacity: 0.72 },
        ]}>
        <View style={[styles.rule, { backgroundColor: Accent.base }]} />
        <ThemedText type="defaultSemiBold" style={[styles.groupTitle, { color: Accent.base }]}>
          {group.label}
        </ThemedText>
        {isClosed ? (
          <FiChevronRight size={16} color={colors.textHint} strokeWidth={2} />
        ) : (
          <FiChevronDown size={16} color={colors.textHint} strokeWidth={2} />
        )}
      </Pressable>
      {isClosed ? null : group.sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <Pressable
            onPress={() => onToggleSection(section.key)}
            accessibilityRole="button"
            accessibilityLabel={`${closedSections.has(section.key) ? 'เปิด' : 'พับ'} ${section.label}`}
            style={({ pressed, hovered }: any) => [
              styles.sectionHeader,
              (pressed || hovered) && { opacity: 0.72 },
            ]}>
            {closedSections.has(section.key) ? (
              <FiChevronRight size={14} color={colors.textHint} strokeWidth={2} />
            ) : (
              <FiChevronDown size={14} color={colors.textHint} strokeWidth={2} />
            )}
            <ThemedText style={[styles.mono, { color: colors.textHint }]}>{section.label}</ThemedText>
          </Pressable>
          {closedSections.has(section.key) ? null : section.decks.map((deck) => {
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
  controlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  controlBtn: {
    minHeight: 34,
    minWidth: 88,
    borderWidth: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
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
  groupTitle: {
    flex: 1,
    minWidth: 0,
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
