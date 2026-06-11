import { useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FiBookOpen, FiCheck, FiFileText, FiFolder, FiHash, FiPlus } from 'react-icons/fi';

import { ImportDestinationPicker } from '@/components/import-destination-picker';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import type { Deck, Entry } from '@/data/types';
import { useToast } from '@/components/toast';
import {
  DEFAULT_IMPORT_GROUP,
  DEFAULT_IMPORT_SECTION,
  buildImportDestinationOptions,
  normalizeImportDestination,
} from '@/lib/import-export/import-destination';
import { createGlobalUserLibraryEntry } from '@/lib/library-management';
import { canSaveTermEditingForm, normalizeTermEditingFields } from '@/lib/term-editing-form';
import { getDeckOrganization, isUserEditableDeck } from '@/lib/user-content';
import { getEditorInputShellStyle, getEditorTextInputWebStyle } from '@/lib/editor-input-style';

type CustomTermCreateFlowProps = {
  decks: Deck[];
  variant: 'page' | 'modal';
  onCreated?: (payload: { deckId: string; entry: Entry }) => void | Promise<void>;
  onOpenCreated: (payload: { deckId: string; entryId: string }) => void;
};

export function CustomTermCreateFlow({
  decks,
  variant,
  onCreated,
  onOpenCreated,
}: CustomTermCreateFlowProps) {
  const colors = useThemePalette();
  const { showToast } = useToast();
  const [t, setT] = useState('');
  const [d, setD] = useState('');
  const [p, setP] = useState('');
  const [e, setE] = useState('');
  const [group, setGroup] = useState(DEFAULT_IMPORT_GROUP);
  const [section, setSection] = useState(DEFAULT_IMPORT_SECTION);
  const [deckMode, setDeckMode] = useState<'existing' | 'new'>('new');
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [latestCreated, setLatestCreated] = useState<{ deckId: string; entryId: string } | null>(null);

  const destination = useMemo(
    () => normalizeImportDestination({ group, section }),
    [group, section],
  );
  const destinationOptions = useMemo(() => buildImportDestinationOptions(decks), [decks]);
  const editableDecks = useMemo(() => decks.filter((deck) => {
    if (!isUserEditableDeck(deck)) return false;
    const organization = getDeckOrganization(deck);
    return organization.group === destination.group
      && (organization.section ?? DEFAULT_IMPORT_SECTION) === destination.section;
  }), [decks, destination.group, destination.section]);

  const fields = normalizeTermEditingFields({ t, d, p, e });
  const canSaveTerm = canSaveTermEditingForm({ editable: true, t, d, p, e });
  const canSaveDeck = deckMode === 'existing'
    ? Boolean(selectedDeckId)
    : newDeckTitle.trim().length > 0;
  const canSave = canSaveTerm && canSaveDeck && !busy;

  async function save() {
    if (!canSave) {
      setStatus('กรอก T / D และเลือก deck ก่อนบันทึก');
      return;
    }
    setBusy(true);
    setStatus('');
    setLatestCreated(null);
    try {
      const result = await createGlobalUserLibraryEntry({
        target: deckMode === 'existing'
          ? { kind: 'existing-deck', deckId: selectedDeckId }
          : { kind: 'new-deck', title: newDeckTitle, organization: destination },
        fields,
      });
      if (!result.ok || !result.entry || !result.deckId) {
        setStatus(result.reason ?? 'บันทึกคำไม่สำเร็จ');
        return;
      }

      const entry = result.entry;
      const deckId = result.deckId;
      await onCreated?.({ deckId, entry });
      setT('');
      setD('');
      setP('');
      setE('');
      if (deckMode === 'new') {
        setDeckMode('existing');
        setSelectedDeckId(deckId);
      }
      setLatestCreated({ deckId, entryId: entry.id });
      showToast('บันทึกคำแล้ว', {
        kind: 'success',
        durationMs: 6500,
        actionLabel: 'เปิดดู',
        onAction: () => onOpenCreated({ deckId, entryId: entry.id }),
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'บันทึกคำไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, variant === 'modal' && styles.rootModal]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, variant === 'page' && styles.pageContent]}
        keyboardShouldPersistTaps="handled"
        {...(Platform.OS === 'web' ? ({ dataSet: { scroll: 'custom-term-create' } } as any) : null)}>
        <View style={[styles.intro, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
          <ThemedText type="smallBold" style={{ color: Accent.base }}>// CUSTOM TERM · local library</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            เพิ่มคำลง Custom Deck โดยไม่แตะ Official Source
          </ThemedText>
        </View>

        <View style={styles.step}>
          <SectionHeader index="1" title="เขียนคำ" icon={<FiHash size={15} color={Accent.base} />} />
          <Field label="T" value={t} onChange={setT} placeholder="คำศัพท์ / Japanese expression" required disabled={busy} />
          <Field label="D" value={d} onChange={setD} placeholder="ความหมายภาษาไทย" required disabled={busy} />
          <Field label="P" value={p} onChange={setP} placeholder="คำอ่าน / pronunciation" disabled={busy} />
          <Field label="E" value={e} onChange={setE} placeholder="รายละเอียด / markdown" multiline disabled={busy} />
          <View style={[styles.markdownHelp, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
            <FiFileText size={14} color={Accent.base} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <ThemedText type="smallBold">Markdown สั้น ๆ สำหรับ E</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ### หัวข้อ · **Label:** รายละเอียด · &gt; note / reading · --- แยกช่วง
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.step}>
          <SectionHeader index="2" title="เก็บไว้ที่ไหน" icon={<FiFolder size={15} color={Accent.base} />} />
          <View style={[styles.destinationSummary, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <ThemedText type="smallBold">{destination.group}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{destination.section}</ThemedText>
          </View>
          <ImportDestinationPicker
            title="เลือกที่เก็บคำ"
            showBack={false}
            groups={destinationOptions}
            current={destination}
            busy={busy}
            onApply={(value) => {
              const normalized = normalizeImportDestination(value);
              setGroup(normalized.group);
              setSection(normalized.section);
              setSelectedDeckId('');
              setDeckMode('new');
              setStatus('');
            }}
          />
        </View>

        <View style={styles.step}>
          <SectionHeader index="3" title="เลือก deck" icon={<FiBookOpen size={15} color={Accent.base} />} />
          <View style={styles.segmentRow}>
            <SegmentButton
              label="Existing"
              active={deckMode === 'existing'}
              disabled={editableDecks.length === 0 || busy}
              onPress={() => {
                setDeckMode('existing');
                setSelectedDeckId((current) => current || editableDecks[0]?.id || '');
                setStatus('');
              }}
            />
            <SegmentButton
              label="New deck"
              active={deckMode === 'new'}
              disabled={busy}
              onPress={() => {
                setDeckMode('new');
                setStatus('');
              }}
            />
          </View>
          {deckMode === 'existing' ? (
            <View style={[styles.deckList, { borderColor: colors.border }]}>
              {editableDecks.length > 0 ? editableDecks.map((deck) => {
                const selected = selectedDeckId === deck.id;
                return (
                  <Pressable
                    key={deck.id}
                    onPress={() => {
                      setSelectedDeckId(deck.id);
                      setStatus('');
                    }}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed, hovered }: any) => [
                      styles.deckRow,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: selected ? 'rgba(224, 32, 44, 0.07)' : hovered ? colors.surface2 : 'transparent',
                      },
                      pressed && { opacity: 0.72 },
                    ]}>
                    <View style={styles.deckRowIcon}>
                      {selected ? <FiCheck size={15} color={Accent.base} /> : <FiBookOpen size={15} color={colors.textHint} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <ThemedText type="smallBold" numberOfLines={1}>{deck.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{deck.entryCount} terms</ThemedText>
                    </View>
                  </Pressable>
                );
              }) : (
                <View style={styles.emptyDecks}>
                  <ThemedText type="small" themeColor="textSecondary">
                    ยังไม่มี custom deck ในที่เก็บนี้ สร้าง deck ใหม่ได้เลย
                  </ThemedText>
                </View>
              )}
            </View>
          ) : (
            <Field label="Deck" value={newDeckTitle} onChange={setNewDeckTitle} placeholder="ชื่อ deck ใหม่" required disabled={busy} />
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        {latestCreated ? (
          <Pressable
            onPress={() => onOpenCreated(latestCreated)}
            accessibilityRole="button"
            accessibilityLabel="เปิดคำที่เพิ่งบันทึก"
            style={({ pressed }) => [
              styles.savedAction,
              { borderColor: colors.border, backgroundColor: colors.backgroundElement },
              pressed && { opacity: 0.72 },
            ]}>
            <FiCheck size={15} color={Accent.base} />
            <ThemedText type="smallBold" style={{ color: Accent.base }}>บันทึกคำแล้ว · เปิดดู</ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => void save()}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="บันทึกคำ"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: Accent.base, opacity: canSave ? 1 : 0.45 },
            pressed && canSave && { opacity: 0.78 },
          ]}>
          <FiPlus size={16} color="#ffffff" />
          <ThemedText type="defaultSemiBold" style={styles.primaryText}>
            {busy ? 'กำลังบันทึก...' : 'บันทึกคำ'}
          </ThemedText>
        </Pressable>
        {status ? <ThemedText type="small" themeColor="textSecondary">{status}</ThemedText> : null}
      </View>
    </View>
  );
}

function SectionHeader({ index, title, icon }: { index: string; title: string; icon: ReactNode }) {
  const colors = useThemePalette();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.stepBadge, { borderColor: colors.border }]}>
        <ThemedText type="smallBold" style={{ color: Accent.base }}>{index}</ThemedText>
      </View>
      {icon}
      <ThemedText type="defaultSemiBold">{title}</ThemedText>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  multiline,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
  disabled: boolean;
}) {
  const colors = useThemePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>
        {label}{required ? ' · REQUIRED' : ''}
      </ThemedText>
      <View
        style={[
          styles.inputShell,
          multiline && styles.inputShellMultiline,
          getEditorInputShellStyle({ colors, focused, disabled }),
          focused && styles.inputShellFocused,
        ]}>
        <TextInput
          value={value}
          editable={!disabled}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textHint}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            { color: colors.text },
            Platform.OS === 'web' ? (getEditorTextInputWebStyle() as any) : null,
          ]}
        />
      </View>
    </View>
  );
}

function SegmentButton({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => [
        styles.segmentButton,
        {
          borderColor: active ? Accent.base : colors.border,
          backgroundColor: active ? Accent.bg : colors.background,
          opacity: disabled ? 0.45 : 1,
        },
        pressed && !disabled && { opacity: 0.72 },
      ]}>
      <ThemedText type="smallBold" style={{ color: active ? Accent.base : colors.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  rootModal: {
    maxHeight: '100%',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    gap: Spacing.four,
    padding: Spacing.four,
  },
  pageContent: {
    paddingBottom: Spacing.six,
  },
  intro: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  step: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  inputShell: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  inputShellMultiline: {
    minHeight: 108,
    paddingVertical: Spacing.two,
    justifyContent: 'flex-start',
  },
  inputShellFocused: {
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 0 3px rgba(224, 32, 44, 0.14)' } as any) : null),
  },
  input: {
    minHeight: 40,
    paddingVertical: 0,
    fontSize: 15,
    fontFamily: Platform.select({ web: '"Sarabun", sans-serif', default: undefined }),
  },
  inputMultiline: {
    minHeight: 92,
    textAlignVertical: 'top',
    paddingTop: Spacing.one,
  },
  markdownHelp: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  destinationSummary: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    gap: 2,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segmentButton: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckList: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  deckRow: {
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  deckRowIcon: {
    width: 22,
    alignItems: 'center',
  },
  emptyDecks: {
    minHeight: 64,
    padding: Spacing.three,
    justifyContent: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  savedAction: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  primaryText: {
    color: '#ffffff',
  },
});
