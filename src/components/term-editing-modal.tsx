import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FiEdit3, FiFileText, FiHash, FiTrash2, FiX } from 'react-icons/fi';

import type { Deck, Entry } from '@/data/types';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { ThemedText } from '@/components/themed-text';
import {
  canSaveTermEditingForm,
  normalizeTermEditingFields,
  type TermEditingFields,
} from '@/lib/term-editing-form';
import {
  deleteUserLibraryEntry,
  updateUserLibraryEntry,
} from '@/lib/library-management';
import { isUserEditableDeck } from '@/lib/user-content';

type TermEditingModalProps = {
  visible: boolean;
  deck?: Deck;
  entry?: Entry;
  onClose: () => void;
  onSaved: (fields: TermEditingFields) => void;
  onDeleted: () => void;
};

export function TermEditingModal({
  visible,
  deck,
  entry,
  onClose,
  onSaved,
  onDeleted,
}: TermEditingModalProps) {
  const colors = useThemePalette();
  const editable = deck ? isUserEditableDeck(deck) : false;
  const initial = useMemo<TermEditingFields>(() => ({
    t: entry?.t ?? '',
    d: entry?.d ?? '',
    p: entry?.p ?? '',
    e: entry?.e ?? '',
  }), [entry]);
  const [t, setT] = useState(initial.t);
  const [d, setD] = useState(initial.d);
  const [p, setP] = useState(initial.p);
  const [e, setE] = useState(initial.e);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setT(initial.t);
    setD(initial.d);
    setP(initial.p);
    setE(initial.e);
    setBusy(false);
    setStatus('');
    setConfirmDelete(false);
  }, [initial, visible]);

  const normalized = normalizeTermEditingFields({ t, d, p, e });
  const canSave = deck && entry && canSaveTermEditingForm({
    editable,
    t,
    d,
    p,
    e,
    initial,
  });

  async function save() {
    if (!deck || !entry || !canSave || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const result = await updateUserLibraryEntry(deck.id, entry.no, normalized);
      if (!result.ok) {
        setStatus(result.reason ?? 'บันทึกคำนี้ไม่สำเร็จ');
        return;
      }
      onSaved(normalized);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTerm() {
    if (!deck || !entry || !editable || busy) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setStatus('กดลบอีกครั้งเพื่อยืนยัน');
      return;
    }
    setBusy(true);
    try {
      const result = await deleteUserLibraryEntry(deck.id, entry.no);
      if (!result.ok) {
        setStatus(result.reason ?? 'ลบคำนี้ไม่สำเร็จ');
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
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>// TERM EDIT</ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิดแก้ไขคำ"
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

          <View style={[styles.termBadge, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
            <FiEdit3 size={17} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />
            <View style={styles.termBadgeText}>
              <ThemedText type="defaultSemiBold" numberOfLines={1}>{entry?.t ?? 'Term'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {editable ? 'User Content · แก้คำนี้ได้' : 'Official Source · แก้ไม่ได้'}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.formBlock, !editable && { opacity: 0.5 }]}>
            <Field label="T" value={t} disabled={!editable || busy} placeholder="คำศัพท์ / term" icon={<FiHash size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />} onChange={setT} />
            <Field label="D" value={d} disabled={!editable || busy} placeholder="ความหมาย" icon={<FiFileText size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />} onChange={setD} />
            <Field label="P" value={p} disabled={!editable || busy} placeholder="คำอ่าน" icon={<FiFileText size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />} onChange={setP} />
            <Field label="E" value={e} disabled={!editable || busy} placeholder="รายละเอียด / markdown" multiline icon={<FiFileText size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />} onChange={setE} />
          </View>

          {!editable ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              Official Source เป็นเนื้อหาหลักของ Nihon Bunkai จึงแก้หรือลบคำโดยตรงไม่ได้ใน v1
            </ThemedText>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => void save()}
              disabled={!canSave || busy}
              accessibilityRole="button"
              accessibilityLabel="บันทึกคำ"
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: Accent.base, opacity: canSave && !busy ? 1 : 0.45 },
                pressed && canSave && { opacity: 0.78 },
              ]}>
              <ThemedText type="defaultSemiBold" style={styles.primaryText}>บันทึก</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => void deleteTerm()}
              disabled={!editable || busy}
              accessibilityRole="button"
              accessibilityLabel="ลบคำนี้"
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
  multiline,
  icon,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  placeholder: string;
  multiline?: boolean;
  icon: ReactNode;
  onChange: (value: string) => void;
}) {
  const colors = useThemePalette();
  return (
    <View style={styles.field}>
      <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>{label}</ThemedText>
      <View style={[styles.inputShell, multiline && styles.inputShellMulti, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.inputIcon}>{icon}</View>
        <TextInput
          value={value}
          editable={!disabled}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textHint}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[styles.input, multiline && styles.inputMulti, { color: colors.text }]}
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
    maxWidth: 500,
    maxHeight: '92%',
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
  termBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
  },
  termBadgeText: {
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
  inputShellMulti: {
    minHeight: 118,
    alignItems: 'flex-start',
    paddingTop: Spacing.two,
  },
  inputIcon: {
    paddingTop: Platform.OS === 'web' ? 2 : 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    paddingVertical: Platform.OS === 'web' ? 9 : 6,
  },
  inputMulti: {
    minHeight: 96,
    lineHeight: 21,
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
