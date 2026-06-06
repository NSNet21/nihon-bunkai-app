import { useEffect, useMemo, useReducer, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FiEdit3, FiFileText, FiHash, FiMaximize2, FiPlus, FiRotateCcw, FiTrash2, FiX } from 'react-icons/fi';

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
  createUserLibraryEntry,
  deleteUserLibraryEntry,
  resetOfficialEntryOverride,
  saveOfficialEntryOverride,
  updateUserLibraryEntry,
} from '@/lib/library-management';
import { isOfficialDeck, isUserEditableDeck } from '@/lib/user-content';
import { getEditorInputShellStyle, getEditorTextInputWebStyle } from '@/lib/editor-input-style';

type TermEditingModalState = TermEditingFields & {
  busy: boolean;
  status: string;
  confirmDelete: boolean;
};

type TermEditingModalAction =
  | { type: 'reset'; initial: TermEditingFields }
  | { type: 'field'; field: keyof TermEditingFields; value: string }
  | { type: 'busy'; busy: boolean }
  | { type: 'status'; status: string }
  | { type: 'confirm-delete' };

function createModalState(initial: TermEditingFields): TermEditingModalState {
  return {
    ...initial,
    busy: false,
    status: '',
    confirmDelete: false,
  };
}

function termEditingModalReducer(
  state: TermEditingModalState,
  action: TermEditingModalAction,
): TermEditingModalState {
  switch (action.type) {
    case 'reset':
      return createModalState(action.initial);
    case 'field':
      return { ...state, [action.field]: action.value };
    case 'busy':
      return { ...state, busy: action.busy };
    case 'status':
      return { ...state, status: action.status };
    case 'confirm-delete':
      return { ...state, confirmDelete: true, status: 'กดลบอีกครั้งเพื่อยืนยัน' };
    default:
      return state;
  }
}

type TermEditingModalProps = {
  visible: boolean;
  mode?: 'edit' | 'create';
  deck?: Deck;
  entry?: Entry;
  onClose: () => void;
  onSaved?: (fields: TermEditingFields) => void;
  onCreated?: (entry: Entry) => void;
  onDeleted?: () => void;
  onReset?: () => void;
};

export function TermEditingModal({
  visible,
  mode = 'edit',
  deck,
  entry,
  onClose,
  onSaved,
  onCreated,
  onDeleted,
  onReset,
}: TermEditingModalProps) {
  const colors = useThemePalette();
  const isCreate = mode === 'create';
  const userEditable = deck ? isUserEditableDeck(deck) : false;
  const officialEditable = deck && !isCreate ? isOfficialDeck(deck) : false;
  const editable = userEditable || Boolean(officialEditable);
  const canReset = Boolean(officialEditable && entry?.hasPersonalOverride);
  const initial = useMemo<TermEditingFields>(() => ({
    t: isCreate ? '' : entry?.t ?? '',
    d: isCreate ? '' : entry?.d ?? '',
    p: isCreate ? '' : entry?.p ?? '',
    e: isCreate ? '' : entry?.e ?? '',
  }), [entry, isCreate]);
  const [state, dispatch] = useReducer(termEditingModalReducer, initial, createModalState);
  const [expandedEOpen, setExpandedEOpen] = useState(false);
  const { t, d, p, e, busy, status, confirmDelete } = state;

  useEffect(() => {
    if (!visible) return;
    dispatch({ type: 'reset', initial });
  }, [initial, visible]);

  const normalized = normalizeTermEditingFields({ t, d, p, e });
  const canSave = Boolean(deck) && canSaveTermEditingForm({
    editable,
    t,
    d,
    p,
    e,
    initial: isCreate ? undefined : initial,
  });

  async function save() {
    if (!deck || !canSave || busy) return;
    dispatch({ type: 'busy', busy: true });
    dispatch({ type: 'status', status: '' });
    try {
      if (isCreate) {
        const result = await createUserLibraryEntry(deck.id, normalized);
        if (!result.ok || !result.entry) {
          dispatch({ type: 'status', status: result.reason ?? 'เพิ่มคำใหม่ไม่สำเร็จ' });
          return;
        }
        onCreated?.(result.entry);
        return;
      }
      if (!entry) return;
      const result = officialEditable
        ? await saveOfficialEntryOverride(deck.id, entry.no, normalized)
        : await updateUserLibraryEntry(deck.id, entry.no, normalized);
      if (!result.ok) {
        dispatch({ type: 'status', status: result.reason ?? 'บันทึกคำนี้ไม่สำเร็จ' });
        return;
      }
      onSaved?.(normalized);
    } finally {
      dispatch({ type: 'busy', busy: false });
    }
  }

  async function resetTerm() {
    if (!deck || !entry || !officialEditable || !canReset || busy) return;
    dispatch({ type: 'busy', busy: true });
    try {
      const result = await resetOfficialEntryOverride(deck.id, entry.no);
      if (!result.ok) {
        dispatch({ type: 'status', status: result.reason ?? 'รีเซ็ตคำนี้ไม่สำเร็จ' });
        return;
      }
      onReset?.();
    } finally {
      dispatch({ type: 'busy', busy: false });
    }
  }

  async function deleteTerm() {
    if (!deck || !entry || !userEditable || busy) return;
    if (!confirmDelete) {
      dispatch({ type: 'confirm-delete' });
      return;
    }
    dispatch({ type: 'busy', busy: true });
    try {
      const result = await deleteUserLibraryEntry(deck.id, entry.no);
      if (!result.ok) {
        dispatch({ type: 'status', status: result.reason ?? 'ลบคำนี้ไม่สำเร็จ' });
        return;
      }
      onDeleted?.();
    } finally {
      dispatch({ type: 'busy', busy: false });
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
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>
                {isCreate ? '// TERM CREATE' : '// TERM EDIT'}
              </ThemedText>
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

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            {...(Platform.OS === 'web' ? ({ dataSet: { scroll: 'card' } } as any) : null)}>
            <View style={[styles.termBadge, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
              {isCreate ? (
                <FiPlus size={17} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />
              ) : (
                <FiEdit3 size={17} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />
              )}
              <View style={styles.termBadgeText}>
                <ThemedText type="defaultSemiBold" numberOfLines={1}>
                  {isCreate ? deck?.title ?? 'New term' : entry?.t ?? 'Term'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {editable
                    ? officialEditable
                      ? entry?.hasPersonalOverride ? 'Personal Edit · มีการแก้ส่วนตัวแล้ว' : 'Personal Edit · แก้เฉพาะในเครื่องนี้'
                      : isCreate ? 'User Content · เพิ่มคำใหม่ใน deck นี้' : 'User Content · แก้คำนี้ได้'
                    : 'Official Source · แก้ไม่ได้'}
                </ThemedText>
              </View>
            </View>

            <View style={styles.formBlock}>
              <Field label="T" value={t} disabled={!editable || busy} placeholder="คำศัพท์ / term" icon={<FiHash size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />} onChange={(value) => dispatch({ type: 'field', field: 't', value })} />
              <Field label="D" value={d} disabled={!editable || busy} placeholder="ความหมาย" icon={<FiFileText size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />} onChange={(value) => dispatch({ type: 'field', field: 'd', value })} />
              <Field label="P" value={p} disabled={!editable || busy} placeholder="คำอ่าน" icon={<FiFileText size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />} onChange={(value) => dispatch({ type: 'field', field: 'p', value })} />
              <Field
                label="E"
                value={e}
                disabled={!editable || busy}
                placeholder="รายละเอียด / markdown"
                multiline
                icon={<FiFileText size={15} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />}
                actionLabel="ขยาย"
                actionIcon={<FiMaximize2 size={13} color={editable ? Accent.base : colors.textHint} strokeWidth={2} />}
                onAction={() => setExpandedEOpen(true)}
                onChange={(value) => dispatch({ type: 'field', field: 'e', value })}
              />
            </View>

            {!editable ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                Official Source เป็นเนื้อหาหลักของ Nihon Bunkai จึงแก้ เพิ่ม หรือลบคำโดยตรงไม่ได้ใน v1
              </ThemedText>
            ) : officialEditable ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                การแก้นี้เป็น Personal Edit เฉพาะในเครื่องนี้ · Official Source ยังไม่ถูกแก้ และสามารถ reset กลับต้นฉบับได้
              </ThemedText>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
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
                <ThemedText type="defaultSemiBold" style={styles.primaryText}>
                  {isCreate ? 'เพิ่มคำ' : 'บันทึก'}
                </ThemedText>
              </Pressable>
              {!isCreate && officialEditable ? (
                <Pressable
                  onPress={() => void resetTerm()}
                  disabled={!canReset || busy}
                  accessibilityRole="button"
                  accessibilityLabel="รีเซ็ตกลับต้นฉบับ"
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    { borderColor: canReset ? Accent.soft : colors.border, opacity: canReset && !busy ? 1 : 0.45 },
                    pressed && canReset && { opacity: 0.75 },
                  ]}>
                  <FiRotateCcw size={15} color={canReset ? Accent.base : colors.textHint} strokeWidth={2} />
                  <ThemedText type="small" style={{ color: canReset ? Accent.base : colors.textSecondary }}>
                    Reset
                  </ThemedText>
                </Pressable>
              ) : !isCreate ? (
                <Pressable
                  onPress={() => void deleteTerm()}
                  disabled={!userEditable || busy}
                  accessibilityRole="button"
                  accessibilityLabel="ลบคำนี้"
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    { borderColor: userEditable ? Accent.soft : colors.border, opacity: userEditable && !busy ? 1 : 0.45 },
                    confirmDelete && { backgroundColor: Accent.bg },
                    pressed && userEditable && { opacity: 0.75 },
                  ]}>
                  <FiTrash2 size={15} color={userEditable ? Accent.base : colors.textHint} strokeWidth={2} />
                  <ThemedText type="small" style={{ color: userEditable ? Accent.base : colors.textSecondary }}>
                    {confirmDelete ? 'ยืนยันลบ' : 'ลบ'}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>

            {status ? (
              <View style={[styles.status, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                <ThemedText type="small" themeColor="textSecondary">{status}</ThemedText>
              </View>
            ) : null}
          </View>

          <ExpandedEEditor
            visible={expandedEOpen}
            value={e}
            disabled={!editable || busy}
            onChange={(value) => dispatch({ type: 'field', field: 'e', value })}
            onClose={() => setExpandedEOpen(false)}
          />
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
  actionLabel,
  actionIcon,
  onAction,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  placeholder: string;
  multiline?: boolean;
  icon: ReactNode;
  actionLabel?: string;
  actionIcon?: ReactNode;
  onAction?: () => void;
  onChange: (value: string) => void;
}) {
  const colors = useThemePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <ThemedText style={[styles.fieldLabel, { color: focused && !disabled ? Accent.base : colors.textHint }]}>{label}</ThemedText>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${actionLabel}`}
            style={({ pressed }) => [
              styles.fieldAction,
              { opacity: disabled ? 0.45 : 1 },
              pressed && !disabled && { opacity: 0.72 },
            ]}>
            {actionIcon}
            <ThemedText type="small" style={{ color: disabled ? colors.textHint : Accent.base }}>{actionLabel}</ThemedText>
          </Pressable>
        ) : null}
      </View>
      <View style={[
        styles.inputShell,
        multiline && styles.inputShellMulti,
        getEditorInputShellStyle({ colors, focused, disabled }),
      ]}>
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            styles.input,
            multiline && styles.inputMulti,
            { color: colors.text },
            Platform.OS === 'web' ? getEditorTextInputWebStyle() : null,
          ]}
        />
      </View>
    </View>
  );
}

function ExpandedEEditor({
  visible,
  value,
  disabled,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const colors = useThemePalette();
  const [focused, setFocused] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.expandedBackdrop} onPress={onClose}>
        <Pressable
          onPress={(event: any) => event.stopPropagation?.()}
          style={[styles.expandedPanel, { borderColor: colors.border, borderTopColor: Accent.base, backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.pip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.mono, { color: colors.textHint }]}>// E EDITOR</ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิด E editor"
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
          <View style={[
            styles.expandedInputShell,
            getEditorInputShellStyle({ colors, focused, disabled }),
          ]}>
            <TextInput
              value={value}
              editable={!disabled}
              onChangeText={onChange}
              placeholder="รายละเอียด / markdown"
              placeholderTextColor={colors.textHint}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              textAlignVertical="top"
              style={[
                styles.expandedInput,
                { color: colors.text },
                Platform.OS === 'web' ? getEditorTextInputWebStyle() : null,
              ]}
            />
          </View>
          <View style={[styles.expandedFooter, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="กลับไปหน้าฟอร์มแก้คำ"
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: Accent.base }, pressed && { opacity: 0.78 }]}>
              <ThemedText type="defaultSemiBold" style={styles.primaryText}>กลับไปฟอร์ม</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.four,
    paddingBottom: Spacing.three,
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
  bodyScroll: {
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  fieldAction: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
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
    minHeight: 134,
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
    minHeight: 112,
    lineHeight: 21,
  },
  note: {
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
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
  expandedBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  expandedPanel: {
    width: '100%',
    maxWidth: 860,
    height: '92%',
    borderWidth: 1,
    borderTopWidth: 3,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  expandedInputShell: {
    flex: 1,
    marginHorizontal: Spacing.four,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
  },
  expandedInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    padding: 0,
  },
  expandedFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
  },
});
