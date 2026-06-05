import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FiArchive, FiEdit3, FiFolder, FiTrash2, FiX } from 'react-icons/fi';

import type { Deck } from '@/data/types';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { ThemedText } from '@/components/themed-text';
import {
  canSaveDeckManagementForm,
  normalizeDeckManagementFields,
  type DeckManagementFields,
} from '@/lib/deck-management-form';
import {
  deleteUserLibraryDeck,
  moveUserLibraryDeck,
  renameUserLibraryDeck,
} from '@/lib/library-management';
import { getDeckOrganization, isUserEditableDeck } from '@/lib/user-content';

type DeckManagementModalProps = {
  visible: boolean;
  deck?: Deck;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
};

export function DeckManagementModal({
  visible,
  deck,
  onClose,
  onChanged,
  onDeleted,
}: DeckManagementModalProps) {
  const colors = useThemePalette();
  const editable = deck ? isUserEditableDeck(deck) : false;
  const initial = useMemo<DeckManagementFields>(() => {
    if (!deck) return { title: '', group: undefined, section: undefined };
    const organization = getDeckOrganization(deck);
    return {
      title: deck.title,
      group: organization.group,
      section: organization.section,
    };
  }, [deck]);
  const [title, setTitle] = useState(initial.title);
  const [group, setGroup] = useState(initial.group ?? '');
  const [section, setSection] = useState(initial.section ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(initial.title);
    setGroup(initial.group ?? '');
    setSection(initial.section ?? '');
    setStatus('');
    setConfirmDelete(false);
  }, [initial, visible]);

  const normalized = normalizeDeckManagementFields({ title, group, section });
  const canSave = deck && canSaveDeckManagementForm({
    editable,
    title,
    group,
    section,
    initial,
  });

  async function save() {
    if (!deck || !canSave || busy) return;
    setBusy(true);
    setStatus('');
    try {
      if (normalized.title !== initial.title) {
        const result = await renameUserLibraryDeck(deck.id, normalized.title);
        if (!result.ok) {
          setStatus(result.reason ?? 'บันทึกชื่อ deck ไม่สำเร็จ');
          return;
        }
      }
      if (normalized.group !== initial.group || normalized.section !== initial.section) {
        const result = await moveUserLibraryDeck(deck.id, {
          group: normalized.group,
          section: normalized.section,
        });
        if (!result.ok) {
          setStatus(result.reason ?? 'ย้าย group / section ไม่สำเร็จ');
          return;
        }
      }
      setStatus('บันทึก deck แล้ว');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function deleteDeck() {
    if (!deck || !editable || busy) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setStatus('กดลบอีกครั้งเพื่อยืนยัน');
      return;
    }
    setBusy(true);
    try {
      const result = await deleteUserLibraryDeck(deck.id);
      if (!result.ok) {
        setStatus(result.reason ?? 'ลบ deck ไม่สำเร็จ');
        return;
      }
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={(event: any) => event.stopPropagation?.()}
          style={[styles.panel, { borderColor: colors.border, borderTopColor: Accent.base, backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>// DECK ACTIONS</ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิด Deck Actions"
              style={({ pressed, hovered }: any) => [
                styles.iconBtn,
                { borderColor: pressed || hovered ? Accent.soft : colors.border },
                pressed && { opacity: 0.75 },
              ]}>
              {({ pressed, hovered }: any) => (
                <FiX size={16} color={pressed || hovered ? Accent.base : colors.text} strokeWidth={2} />
              )}
            </Pressable>
          </View>

          <View style={[styles.deckBadge, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
            <FiArchive size={17} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />
            <View style={styles.deckBadgeText}>
              <ThemedText type="defaultSemiBold" numberOfLines={1}>
                {deck?.title ?? 'Deck'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {editable ? 'User Content · แก้ metadata ได้' : 'Official Source · แก้ไม่ได้'}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.formBlock, !editable && { opacity: 0.5 }]}>
            <Field
              label="ชื่อ deck"
              value={title}
              disabled={!editable || busy}
              placeholder="ชื่อ deck"
              icon={<FiEdit3 size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />}
              onChange={setTitle}
            />
            <Field
              label="Group"
              value={group}
              disabled={!editable || busy}
              placeholder="เช่น Manual imports"
              icon={<FiFolder size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />}
              onChange={setGroup}
            />
            <Field
              label="Section"
              value={section}
              disabled={!editable || busy}
              placeholder="เช่น N2 / Week 1"
              icon={<FiFolder size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />}
              onChange={setSection}
            />
          </View>

          {!editable ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              Official Source เป็นเนื้อหาหลักของ Nihon Bunkai จึง rename, move, หรือ delete ไม่ได้ใน v1
            </ThemedText>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => void save()}
              disabled={!canSave || busy}
              accessibilityRole="button"
              accessibilityLabel="บันทึก deck"
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: Accent.base, opacity: canSave && !busy ? 1 : 0.45 },
                pressed && canSave && { opacity: 0.78 },
              ]}>
              <ThemedText type="defaultSemiBold" style={styles.primaryText}>
                บันทึก
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => void deleteDeck()}
              disabled={!editable || busy}
              accessibilityRole="button"
              accessibilityLabel="ลบ deck"
              style={({ pressed }) => [
                styles.deleteBtn,
                { borderColor: editable ? Accent.soft : colors.border, opacity: editable && !busy ? 1 : 0.45 },
                confirmDelete && { backgroundColor: Accent.bg },
                pressed && editable && { opacity: 0.75 },
              ]}>
              <FiTrash2 size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />
              <ThemedText type="small" style={{ color: editable ? Accent.base : colors.textSecondary }}>
                {confirmDelete ? 'ยืนยันลบ' : 'ลบ'}
              </ThemedText>
            </Pressable>
          </View>

          {status ? (
            <View style={[styles.status, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary">{status}</ThemedText>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({
  label,
  value,
  disabled,
  placeholder,
  icon,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  placeholder: string;
  icon: ReactNode;
  onChange: (value: string) => void;
}) {
  const colors = useThemePalette();
  return (
    <View style={styles.field}>
      <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>{label}</ThemedText>
      <View style={[styles.inputShell, { borderColor: colors.border, backgroundColor: colors.background }]}>
        {icon}
        <TextInput
          value={value}
          editable={!disabled}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textHint}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: colors.text }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  panel: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderTopWidth: 3,
    borderRadius: Radii.md,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minWidth: 0,
  },
  pip: { width: 5, height: 5 },
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
  deckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
  },
  deckBadgeText: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  formBlock: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  inputShell: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: Radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    paddingVertical: Platform.OS === 'web' ? 9 : 6,
  },
  note: {
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#fff',
  },
  deleteBtn: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  status: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.two,
  },
});
