import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FiBookOpen, FiCheck, FiFileText, FiFolder, FiHash, FiMaximize2, FiPlus, FiX } from 'react-icons/fi';

import { CustomTermDestinationPicker } from '@/components/custom-term-destination-picker';
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
  const [eEditorOpen, setEEditorOpen] = useState(false);
  const [markdownGuideOpen, setMarkdownGuideOpen] = useState(false);
  const [optimisticDecks, setOptimisticDecks] = useState<Deck[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ t: false, d: false, deck: false });
  const previousDestinationRef = useRef('');
  const tInputRef = useRef<TextInput | null>(null);
  const dInputRef = useRef<TextInput | null>(null);
  const deckInputRef = useRef<TextInput | null>(null);

  const availableDecks = useMemo(() => {
    if (optimisticDecks.length === 0) return decks;
    const byId = new Map(decks.map((deck) => [deck.id, deck]));
    for (const deck of optimisticDecks) {
      if (!byId.has(deck.id)) byId.set(deck.id, deck);
    }
    return [...byId.values()];
  }, [decks, optimisticDecks]);
  const destination = useMemo(
    () => normalizeImportDestination({ group, section }),
    [group, section],
  );
  const destinationOptions = useMemo(() => buildImportDestinationOptions(availableDecks), [availableDecks]);
  const editableDecks = useMemo(() => availableDecks.filter((deck) => {
    if (!isUserEditableDeck(deck)) return false;
    const organization = getDeckOrganization(deck);
    return organization.group === destination.group
      && (organization.section ?? DEFAULT_IMPORT_SECTION) === destination.section;
  }), [availableDecks, destination.group, destination.section]);

  const fields = normalizeTermEditingFields({ t, d, p, e });
  const canSaveTerm = canSaveTermEditingForm({ editable: true, t, d, p, e });
  const canSaveDeck = deckMode === 'existing'
    ? Boolean(selectedDeckId)
    : newDeckTitle.trim().length > 0;
  const canSave = canSaveTerm && canSaveDeck && !busy;
  const missingT = fields.t.length === 0;
  const missingD = fields.d.length === 0;
  const missingDeck = !canSaveDeck;
  const showTError = missingT && (submitAttempted || touched.t);
  const showDError = missingD && (submitAttempted || touched.d);
  const showDeckError = missingDeck && (submitAttempted || touched.deck);
  const requirementItems = [
    { key: 't', label: 'T คำศัพท์', done: !missingT },
    { key: 'd', label: 'D ความหมาย', done: !missingD },
    { key: 'deck', label: 'Deck', done: !missingDeck },
  ];

  useEffect(() => {
    const key = `${destination.group}\u0000${destination.section}`;
    const destinationChanged = previousDestinationRef.current !== key;
    previousDestinationRef.current = key;

    if (destinationChanged) {
      if (editableDecks.length > 0) {
        setDeckMode('existing');
        setSelectedDeckId(editableDecks[0].id);
      } else {
        setDeckMode('new');
        setSelectedDeckId('');
      }
      return;
    }

    if (deckMode === 'existing' && editableDecks.length > 0 && !editableDecks.some((deck) => deck.id === selectedDeckId)) {
      setSelectedDeckId(editableDecks[0].id);
    }
    if (deckMode === 'existing' && editableDecks.length === 0) {
      setDeckMode('new');
      setSelectedDeckId('');
    }
  }, [deckMode, destination.group, destination.section, editableDecks, selectedDeckId]);

  async function save() {
    if (!canSave) {
      setSubmitAttempted(true);
      setStatus(nextMissingMessage({ missingT, missingD, missingDeck }));
      if (missingT) {
        tInputRef.current?.focus();
      } else if (missingD) {
        dInputRef.current?.focus();
      } else if (missingDeck && deckMode === 'new') {
        deckInputRef.current?.focus();
      }
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
      setSubmitAttempted(false);
      setTouched({ t: false, d: false, deck: false });
      if (deckMode === 'new') {
        const title = newDeckTitle.trim();
        setOptimisticDecks((current) => upsertDeck(current, {
          id: deckId,
          type: 'vocab',
          level: null,
          title,
          entryCount: 1,
          isFree: false,
          pack: deckId,
          tags: ['custom', deckId, `group:${destination.group}`, `section:${destination.section}`],
          source: 'custom',
          isUserContent: true,
          userGroup: destination.group,
          userSection: destination.section,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));
        setDeckMode('existing');
        setSelectedDeckId(deckId);
      }
      await onCreated?.({ deckId, entry });
      setT('');
      setD('');
      setP('');
      setE('');
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
          <Field
            label="T"
            value={t}
            onChange={(value) => {
              setT(value);
              setStatus('');
            }}
            onBlur={() => setTouched((current) => ({ ...current, t: true }))}
            placeholder="คำศัพท์ / Japanese expression"
            required
            error={showTError ? 'ต้องใส่คำศัพท์ก่อนบันทึก' : undefined}
            inputRef={tInputRef}
            disabled={busy}
          />
          <Field
            label="D"
            value={d}
            onChange={(value) => {
              setD(value);
              setStatus('');
            }}
            onBlur={() => setTouched((current) => ({ ...current, d: true }))}
            placeholder="ความหมายภาษาไทย"
            required
            error={showDError ? 'ต้องใส่ความหมายภาษาไทยก่อนบันทึก' : undefined}
            inputRef={dInputRef}
            disabled={busy}
          />
          <Field label="P" value={p} onChange={setP} placeholder="คำอ่าน / pronunciation" disabled={busy} />
          <Field
            label="E"
            value={e}
            onChange={setE}
            placeholder="รายละเอียด / markdown"
            multiline
            disabled={busy}
            minInputHeight={190}
            actionLabel="เขียน E แบบเต็ม"
            onAction={() => setEEditorOpen(true)}
          />
          <Pressable
            onPress={() => setMarkdownGuideOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="เปิดคู่มือ Markdown สำหรับ E"
            style={({ pressed }) => [
              styles.markdownHelp,
              { borderColor: colors.border, backgroundColor: colors.backgroundElement },
              pressed && { opacity: 0.72 },
            ]}>
            <FiFileText size={14} color={Accent.base} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <ThemedText type="smallBold">Markdown สั้น ๆ สำหรับ E</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ### หัวข้อ · **Label:** รายละเอียด · &gt; note / reading · --- แยกช่วง
              </ThemedText>
            </View>
            <FiMaximize2 size={14} color={colors.textHint} />
          </Pressable>
        </View>

        <View style={styles.step}>
          <SectionHeader index="2" title="เลือกที่เก็บคำ" icon={<FiFolder size={15} color={Accent.base} />} />
          <CustomTermDestinationPicker
            groups={destinationOptions}
            current={destination}
            busy={busy}
            onChange={(value) => {
              const normalized = normalizeImportDestination(value);
              setGroup(normalized.group);
              setSection(normalized.section);
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
            <Field
              label="Deck"
              value={newDeckTitle}
              onChange={(value) => {
                setNewDeckTitle(value);
                setStatus('');
              }}
              onBlur={() => setTouched((current) => ({ ...current, deck: true }))}
              placeholder="ชื่อ deck ใหม่"
              required
              error={showDeckError ? 'ต้องใส่ชื่อ deck ใหม่ก่อนบันทึก' : undefined}
              inputRef={deckInputRef}
              disabled={busy}
            />
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <RequirementSummary items={requirementItems} showMissing={submitAttempted} />
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
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="บันทึกคำ"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: Accent.base, opacity: canSave ? 1 : 0.62 },
            pressed && !busy && { opacity: 0.78 },
          ]}>
          <FiPlus size={16} color="#ffffff" />
          <ThemedText type="defaultSemiBold" style={styles.primaryText}>
            {busy ? 'กำลังบันทึก...' : 'บันทึกคำ'}
          </ThemedText>
        </Pressable>
        {status ? <ThemedText type="small" themeColor="textSecondary">{status}</ThemedText> : null}
      </View>
      <EFullEditor
        visible={eEditorOpen}
        value={e}
        disabled={busy}
        onChange={setE}
        onClose={() => setEEditorOpen(false)}
      />
      <MarkdownGuideModal visible={markdownGuideOpen} onClose={() => setMarkdownGuideOpen(false)} />
    </View>
  );
}

function upsertDeck(decks: Deck[], next: Deck) {
  const index = decks.findIndex((deck) => deck.id === next.id);
  if (index < 0) return [...decks, next];
  const copy = [...decks];
  copy[index] = next;
  return copy;
}

function nextMissingMessage({
  missingT,
  missingD,
  missingDeck,
}: {
  missingT: boolean;
  missingD: boolean;
  missingDeck: boolean;
}) {
  const missing = [
    missingT ? 'T' : '',
    missingD ? 'D' : '',
    missingDeck ? 'deck' : '',
  ].filter(Boolean);
  return missing.length > 0
    ? `กรอก ${missing.join(' / ')} ก่อนบันทึก`
    : 'กรอกช่องที่จำเป็นก่อนบันทึก';
}

function RequirementSummary({
  items,
  showMissing,
}: {
  items: { key: string; label: string; done: boolean }[];
  showMissing: boolean;
}) {
  const colors = useThemePalette();
  const remaining = items.filter((item) => !item.done).length;
  return (
    <View style={[styles.requirementSummary, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
      <View style={styles.requirementHeader}>
        <ThemedText type="smallBold">ต้องมีก่อนบันทึก</ThemedText>
        <ThemedText type="small" themeColor={remaining === 0 ? undefined : 'textSecondary'} style={remaining === 0 ? { color: Accent.base } : undefined}>
          {remaining === 0 ? 'ครบแล้ว' : `เหลือ ${remaining}`}
        </ThemedText>
      </View>
      <View style={styles.requirementChips}>
        {items.map((item) => {
          const missing = !item.done;
          const color = item.done ? Accent.base : showMissing ? Accent.strong : colors.textHint;
          return (
            <View
              key={item.key}
              style={[
                styles.requirementChip,
                {
                  borderColor: item.done ? Accent.soft : showMissing && missing ? Accent.strong : colors.border,
                  backgroundColor: item.done ? Accent.bg : showMissing && missing ? 'rgba(192, 24, 37, 0.08)' : colors.background,
                },
              ]}>
              {item.done ? <FiCheck size={12} color={Accent.base} /> : <View style={[styles.requirementDot, { borderColor: color }]} />}
              <ThemedText type="smallBold" style={{ color }}>{item.label}</ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function GuideLine({ code, note }: { code: string; note: string }) {
  return (
    <View style={styles.guideLine}>
      <ThemedText type="smallBold" style={{ color: Accent.base }}>{code}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText>
    </View>
  );
}

function EFullEditor({
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
      <View style={styles.editorOverlay}>
        <View style={[styles.editorPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.editorHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <ThemedText type="defaultSemiBold">เขียน E แบบเต็ม</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Markdown note สำหรับ term นี้</ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิด editor E"
              style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}>
              <FiX size={18} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.editorBody}>
            <View
              style={[
                styles.editorInputShell,
                getEditorInputShellStyle({ colors, focused, disabled }),
                focused && styles.inputShellFocused,
              ]}>
              <TextInput
                value={value}
                editable={!disabled}
                onChangeText={onChange}
                placeholder={'### หัวข้อ\n**Label:** รายละเอียด\n> note / reading\n---'}
                placeholderTextColor={colors.textHint}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={[
                  styles.editorInput,
                  Platform.OS === 'web' ? styles.editorInputWeb : null,
                  { color: colors.text },
                  Platform.OS === 'web' ? (getEditorTextInputWebStyle() as any) : null,
                ]}
              />
            </View>
          </View>
          <View style={[styles.editorFooter, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ใช้ E นี้"
              style={({ pressed }) => [styles.editorDoneButton, { backgroundColor: Accent.base }, pressed && { opacity: 0.78 }]}>
              <ThemedText type="defaultSemiBold" style={{ color: '#ffffff' }}>ใช้ E นี้</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MarkdownGuideModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useThemePalette();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.editorOverlay}>
        <View style={[styles.guidePanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.editorHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <ThemedText type="defaultSemiBold">คู่มือ Markdown สำหรับ E</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">ใช้จัด note ให้อ่านง่ายใน Term Preview</ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิดคู่มือ Markdown"
              style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}>
              <FiX size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.guideBody}
            contentContainerStyle={styles.guideBodyContent}
            {...(Platform.OS === 'web' ? ({ dataSet: { scroll: 'markdown-guide' } } as any) : null)}>
            <GuideLine code="### วิธีใช้" note="หัวข้อใหญ่ของ note หรือ grammar point" />
            <GuideLine code="**ความหมาย:** ..." note="ทำ label ให้เด่น แล้วตามด้วยรายละเอียด" />
            <GuideLine code="> よみ / memo" note="ใช้กับ reading, quote, หรือ note สั้น ๆ" />
            <GuideLine code="---" note="แบ่งช่วงเนื้อหาให้อ่านง่าย" />
            <View style={[styles.markdownExample, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
              <ThemedText type="smallBold" style={{ color: Accent.base }}>ตัวอย่างเต็ม</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ### ใช้ในประโยค{'\n'}**ความหมาย:** ใช้เมื่ออยากบอกว่าเริ่มทำบางอย่าง{'\n'}&gt; はじめる · เริ่ม{'\n'}---{'\n'}จำคู่กับคำกริยารูปพจนานุกรม
              </ThemedText>
            </View>
          </ScrollView>
          <View style={[styles.editorFooter, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิดคู่มือ Markdown"
              style={({ pressed }) => [styles.editorDoneButton, { backgroundColor: Accent.base }, pressed && { opacity: 0.78 }]}>
              <ThemedText type="defaultSemiBold" style={{ color: '#ffffff' }}>เข้าใจแล้ว</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  onBlur,
  placeholder,
  required,
  multiline,
  disabled,
  actionLabel,
  onAction,
  minInputHeight,
  error,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
  disabled: boolean;
  actionLabel?: string;
  onAction?: () => void;
  minInputHeight?: number;
  error?: string;
  inputRef?: RefObject<TextInput | null>;
}) {
  const colors = useThemePalette();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <ThemedText style={[styles.fieldLabel, { color: hasError ? Accent.strong : colors.textHint }]}>
          {label}{required ? ' · จำเป็น' : ''}
        </ThemedText>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => [styles.fieldAction, pressed && { opacity: 0.6 }, disabled && { opacity: 0.45 }]}>
            <FiMaximize2 size={13} color={Accent.base} />
            <ThemedText type="smallBold" style={{ color: Accent.base }}>{actionLabel}</ThemedText>
          </Pressable>
        ) : null}
      </View>
      <View
        style={[
          styles.inputShell,
          multiline && styles.inputShellMultiline,
          typeof minInputHeight === 'number' ? { minHeight: minInputHeight } : null,
          getEditorInputShellStyle({ colors, focused, disabled }),
          hasError && styles.inputShellError,
          focused && styles.inputShellFocused,
        ]}>
        <TextInput
          ref={inputRef}
          value={value}
          editable={!disabled}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textHint}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityState={hasError ? { invalid: true } as any : undefined}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            multiline && Platform.OS === 'web' ? styles.inputMultilineWeb : null,
            typeof minInputHeight === 'number' ? { minHeight: Math.max(40, minInputHeight - 16) } : null,
            { color: colors.text },
            Platform.OS === 'web' ? (getEditorTextInputWebStyle() as any) : null,
          ]}
        />
      </View>
      {error ? <ThemedText type="smallBold" style={styles.fieldError}>{error}</ThemedText> : null}
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
  fieldHead: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  fieldAction: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  fieldError: {
    color: Accent.strong,
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
  inputShellError: {
    borderColor: Accent.strong,
    backgroundColor: 'rgba(192, 24, 37, 0.05)',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 0 3px rgba(192, 24, 37, 0.11)' } as any) : null),
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
  inputMultilineWeb: {
    paddingRight: 34,
    scrollbarGutter: 'stable',
    overflowY: 'auto',
  } as any,
  markdownHelp: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  guideLine: {
    gap: 2,
  },
  markdownExample: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    gap: Spacing.one,
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
  requirementSummary: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  requirementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  requirementChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  requirementChip: {
    minHeight: 28,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  requirementDot: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderRadius: 5,
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
  editorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.46)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  editorPanel: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '92%',
    borderWidth: 1,
    borderTopWidth: 3,
    borderTopColor: Accent.base,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  guidePanel: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '86%',
    borderWidth: 1,
    borderTopWidth: 3,
    borderTopColor: Accent.base,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  editorHeader: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconButton: {
    padding: Spacing.two,
  },
  editorBody: {
    minHeight: 0,
    padding: Spacing.four,
  },
  guideBody: {
    minHeight: 0,
  },
  guideBodyContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  editorInputShell: {
    minHeight: 360,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
  },
  editorInput: {
    minHeight: 332,
    textAlignVertical: 'top',
    paddingVertical: 0,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Platform.select({ web: '"Sarabun", sans-serif', default: undefined }),
  },
  editorInputWeb: {
    paddingRight: 34,
    scrollbarGutter: 'stable',
    overflowY: 'auto',
  } as any,
  editorFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
  },
  editorDoneButton: {
    minHeight: 46,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
