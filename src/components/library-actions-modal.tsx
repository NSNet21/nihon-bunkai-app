import { useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FiArchive, FiCheckSquare, FiDownload, FiHelpCircle, FiMinus, FiPlus, FiSquare, FiUpload, FiX } from 'react-icons/fi';

import { ImportHowToContent } from '@/components/import-how-to-content';
import type { Deck } from '@/data/types';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { buildExportHierarchy, getExportSelectionSummary, type ExportHierarchyGroup, type ExportSelectionSummary } from '@/lib/import-export/export-hierarchy';
import { buildDeckCsv, buildDeckZip, downloadBlob, selectExportableDecks } from '@/lib/import-export/export-library';
import {
  DEFAULT_IMPORT_GROUP,
  DEFAULT_IMPORT_SECTION,
  buildImportDestinationOptions,
  normalizeImportDestination,
  type ImportDestinationGroupOption,
} from '@/lib/import-export/import-destination';
import { parseManualImportFiles, saveManualImport, type ManualImportParseResult } from '@/lib/import-export/manual-import';

type Mode = 'actions' | 'how-to' | 'import-destination' | 'export-one' | 'export-batch';
type PendingImportMode = 'single' | 'batch' | null;

type LibraryActionsModalProps = {
  visible: boolean;
  decks: Deck[];
  onClose: () => void;
  onImported: () => void;
};

const ACTIONS = {
  howTo: 'How to import',
  importOne: 'Import one file',
  importBatch: 'Batch import',
  exportOne: 'Export one deck',
  exportBatch: 'Batch export',
} as const;

const webNoTextSelect = Platform.OS === 'web' ? ({ userSelect: 'none' } as any) : null;

type LibraryActionsState = {
  mode: Mode;
  busy: boolean;
  status: string;
  importGroup: string;
  importSection: string;
  pendingImportMode: PendingImportMode;
  selected: Set<string>;
};

type LibraryActionsAction =
  | { type: 'close' }
  | { type: 'mode'; mode: Mode }
  | { type: 'busy'; busy: boolean }
  | { type: 'status'; status: string }
  | { type: 'import-field'; field: 'importGroup' | 'importSection'; value: string }
  | { type: 'pending-import'; mode: PendingImportMode }
  | { type: 'toggle-selected'; deckId: string }
  | { type: 'reset-selected' };

function createLibraryActionsState(): LibraryActionsState {
  return {
    mode: 'actions',
    busy: false,
    status: '',
    importGroup: DEFAULT_IMPORT_GROUP,
    importSection: DEFAULT_IMPORT_SECTION,
    pendingImportMode: null,
    selected: new Set(),
  };
}

function libraryActionsReducer(state: LibraryActionsState, action: LibraryActionsAction): LibraryActionsState {
  switch (action.type) {
    case 'close':
      return { ...state, mode: 'actions', status: '', pendingImportMode: null, selected: new Set() };
    case 'mode':
      return { ...state, mode: action.mode, status: '' };
    case 'busy':
      return { ...state, busy: action.busy };
    case 'status':
      return { ...state, status: action.status };
    case 'import-field':
      return { ...state, [action.field]: action.value };
    case 'pending-import':
      return { ...state, pendingImportMode: action.mode };
    case 'toggle-selected': {
      const selected = new Set(state.selected);
      if (selected.has(action.deckId)) selected.delete(action.deckId);
      else selected.add(action.deckId);
      return { ...state, selected };
    }
    case 'reset-selected':
      return { ...state, selected: new Set() };
    default:
      return state;
  }
}

export function LibraryActionsModal({ visible, decks, onClose, onImported }: LibraryActionsModalProps) {
  const colors = useThemePalette();
  const { showToast } = useToast();
  const [state, dispatch] = useReducer(libraryActionsReducer, undefined, createLibraryActionsState);
  const { mode, busy, status, importGroup, importSection, pendingImportMode, selected } = state;
  const suppressNextOverlayCloseRef = useRef(false);
  const exportableDecks = useMemo(() => selectExportableDecks(decks), [decks]);
  const destinationOptions = useMemo(() => buildImportDestinationOptions(decks), [decks]);
  const currentDestination = normalizeImportDestination({ group: importGroup, section: importSection });
  const deckIdSets = useMemo(() => {
    const embeddedFree = new Set<string>();
    const local = new Set<string>();
    for (const deck of decks) {
      if (deck.source === 'free') embeddedFree.add(deck.id);
      else local.add(deck.id);
    }
    return { embeddedFree, local };
  }, [decks]);

  function close() {
    dispatch({ type: 'close' });
    onClose();
  }

  function closeFromOverlay() {
    if (suppressNextOverlayCloseRef.current) {
      suppressNextOverlayCloseRef.current = false;
      return;
    }
    close();
  }

  function markPanelInteractionStart() {
    suppressNextOverlayCloseRef.current = true;
  }

  function markPanelInteractionEnd() {
    if (Platform.OS !== 'web') {
      suppressNextOverlayCloseRef.current = false;
      return;
    }
    window.setTimeout(() => {
      suppressNextOverlayCloseRef.current = false;
    }, 500);
  }

  function openMode(nextMode: Mode) {
    dispatch({ type: 'mode', mode: nextMode });
  }

  function startImport(mode: Exclude<PendingImportMode, null>) {
    dispatch({ type: 'pending-import', mode });
    openMode('import-destination');
  }

  async function onImport(multiple: boolean, destination = currentDestination) {
    const files = await pickFiles('.csv,.zip,text/csv,application/zip', multiple);
    if (files.length === 0) return;
    dispatch({ type: 'busy', busy: true });
    try {
      const parsed = await parseManualImportFiles(files, deckIdSets.embeddedFree, {
        group: destination.group,
        section: destination.section,
      });
      if (!shouldSave(parsed, deckIdSets.local)) {
        dispatch({ type: 'status', status: 'ยกเลิก import' });
        return;
      }
      await saveManualImport(parsed);
      onImported();
      const message = importSummary(parsed);
      dispatch({ type: 'status', status: message });
      showToast(message, { kind: parsed.ready.length > 0 ? 'success' : 'info' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      dispatch({ type: 'status', status: message });
      showToast(message, { kind: 'error' });
    } finally {
      dispatch({ type: 'busy', busy: false });
    }
  }

  async function onExportDeck(deck: Deck) {
    dispatch({ type: 'busy', busy: true });
    try {
      const { fileName, csv } = await buildDeckCsv(deck);
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
      dispatch({ type: 'status', status: `Export ${deck.title} แล้ว` });
    } finally {
      dispatch({ type: 'busy', busy: false });
    }
  }

  async function onExportBatch() {
    const chosen = exportableDecks.filter((deck) => selected.has(deck.id));
    if (chosen.length === 0) {
      dispatch({ type: 'status', status: 'เลือกอย่างน้อย 1 deck ก่อน export' });
      return;
    }
    dispatch({ type: 'busy', busy: true });
    try {
      const blob = await buildDeckZip(chosen);
      downloadBlob(blob, 'nihon-bunkai-library-export.zip');
      dispatch({ type: 'status', status: `Export ${chosen.length} decks เป็น ZIP แล้ว` });
    } finally {
      dispatch({ type: 'busy', busy: false });
    }
  }

  function openBatchExport() {
    dispatch({ type: 'reset-selected' });
    openMode('export-batch');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        style={styles.overlay}
        onPress={Platform.OS === 'web' ? undefined : closeFromOverlay}
        {...(Platform.OS === 'web'
          ? ({
              onMouseDown: (event: any) => {
                if (event.target === event.currentTarget) close();
              },
            } as any)
          : null)}>
        <Pressable
          style={[
            styles.panel,
            mode === 'how-to' && styles.howToPanel,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
          onPressIn={markPanelInteractionStart}
          onPressOut={markPanelInteractionEnd}
          onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.header}>
            <View>
              <ThemedText type="defaultSemiBold">Library actions</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Import / Export สำหรับ deck ที่พร้อมเรียน</ThemedText>
            </View>
            <Pressable
              onPress={close}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="ปิด Library actions"
              style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}>
              <FiX size={20} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyScrollInner}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            {...(Platform.OS === 'web' ? ({ dataSet: { scroll: 'card' } } as any) : null)}>
            {mode === 'actions' && (
              <View style={styles.actionList}>
                <ActionRow
                  label={ACTIONS.howTo}
                  hint="เตรียม CSV ใน Sheets/Excel แล้วนำเข้าแอปโดยตรง"
                  icon={<FiHelpCircle size={17} color={Accent.base} />}
                  disabled={busy}
                  onPress={() => openMode('how-to')}
                />
                <ActionRow
                  label={ACTIONS.importOne}
                  hint="เพิ่ม CSV หรือ ZIP 1 ไฟล์เข้า Library เครื่องนี้"
                  icon={<FiUpload size={17} color={Accent.base} />}
                  disabled={busy}
                  onPress={() => startImport('single')}
                />
                <ActionRow
                  label={ACTIONS.importBatch}
                  hint="เลือกหลาย CSV หรือ ZIP เดียว แล้ว import ต่อเนื่อง"
                  icon={<FiArchive size={17} color={Accent.base} />}
                  disabled={busy}
                  onPress={() => startImport('batch')}
                />
                <ActionRow
                  label={ACTIONS.exportOne}
                  hint="เลือก 1 deck ที่พร้อมเรียน แล้ว save เป็น CSV"
                  icon={<FiDownload size={17} color={Accent.base} />}
                  disabled={busy || exportableDecks.length === 0}
                  onPress={() => openMode('export-one')}
                />
                <ActionRow
                  label={ACTIONS.exportBatch}
                  hint="เลือกหลาย deck แล้ว save รวมเป็น ZIP"
                  icon={<FiArchive size={17} color={Accent.base} />}
                  disabled={busy || exportableDecks.length === 0}
                  onPress={openBatchExport}
                />
              </View>
            )}

            {mode === 'import-destination' && (
              <ImportDestinationPicker
                groups={destinationOptions}
                current={currentDestination}
                busy={busy}
                onBack={() => {
                  dispatch({ type: 'pending-import', mode: null });
                  openMode('actions');
                }}
                onApply={(value) => {
                  const normalized = normalizeImportDestination(value);
                  dispatch({ type: 'import-field', field: 'importGroup', value: normalized.group });
                  dispatch({ type: 'import-field', field: 'importSection', value: normalized.section });
                  if (!pendingImportMode) {
                    openMode('actions');
                    return;
                  }
                  void (async () => {
                    await onImport(pendingImportMode === 'batch', normalized);
                    dispatch({ type: 'pending-import', mode: null });
                    openMode('actions');
                  })();
                }}
              />
            )}

            {mode === 'how-to' && (
              <ImportHowTo
                busy={busy}
                onBack={() => openMode('actions')}
                onImportOne={() => startImport('single')}
                onImportBatch={() => startImport('batch')}
              />
            )}

            {mode === 'export-one' && (
              <DeckPicker
                decks={exportableDecks}
                busy={busy}
                onBack={() => openMode('actions')}
                onPick={(deck) => void onExportDeck(deck)}
              />
            )}

            {mode === 'export-batch' && (
              <BatchPicker
                decks={exportableDecks}
                selected={selected}
                busy={busy}
                onToggle={(deckId) => dispatch({ type: 'toggle-selected', deckId })}
                onBack={() => openMode('actions')}
                onExport={() => void onExportBatch()}
              />
            )}
          </ScrollView>

          {status ? (
            <ThemedView type="backgroundElement" style={styles.status}>
              <ThemedText type="small" themeColor="textSecondary">{status}</ThemedText>
            </ThemedView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ImportHowTo({
  busy,
  onBack,
  onImportOne,
  onImportBatch,
}: {
  busy: boolean;
  onBack: () => void;
  onImportOne: () => void;
  onImportBatch: () => void;
}) {
  return (
    <View style={styles.picker}>
      <PickerHeader title="เตรียม CSV เพื่อนำเข้า" onBack={onBack} />
      <ImportHowToContent
        busy={busy}
        showImportActions
        onImportOne={onImportOne}
        onImportBatch={onImportBatch}
      />
    </View>
  );
}

function ImportDestinationPicker({
  groups,
  current,
  busy,
  onBack,
  onApply,
}: {
  groups: ImportDestinationGroupOption[];
  current: { group: string; section: string };
  busy: boolean;
  onBack: () => void;
  onApply: (value: { group: string; section: string }) => void;
}) {
  const colors = useThemePalette();
  const [selectedGroupKey, setSelectedGroupKey] = useState(() => {
    const currentGroup = groups.find((group) => !group.disabled && group.label === current.group);
    const firstUserGroup = groups.find((group) => !group.disabled);
    return currentGroup?.key ?? firstUserGroup?.key ?? '';
  });
  const [selectedSectionKey, setSelectedSectionKey] = useState(() => {
    const group = groups.find((item) => item.key === selectedGroupKey);
    return group?.sections.find((section) => !section.disabled && section.label === current.section)?.key
      ?? group?.sections.find((section) => !section.disabled)?.key
      ?? '';
  });
  const [creatingGroup, setCreatingGroup] = useState(() => !groups.some((group) => !group.disabled));
  const [creatingSection, setCreatingSection] = useState(() => !groups.some((group) => !group.disabled));
  const [newGroup, setNewGroup] = useState('');
  const [newSection, setNewSection] = useState(DEFAULT_IMPORT_SECTION);

  const selectedGroup = groups.find((group) => group.key === selectedGroupKey);
  const selectedSection = selectedGroup?.sections.find((section) => !section.disabled && section.key === selectedSectionKey);
  const applyLabel = creatingGroup
    ? `Use ${newGroup.trim() || 'New group'} / ${newSection.trim() || DEFAULT_IMPORT_SECTION}`
    : creatingSection
      ? `Use ${selectedGroup?.label ?? current.group} / ${newSection.trim() || DEFAULT_IMPORT_SECTION}`
      : `Use ${selectedGroup?.label ?? current.group} / ${selectedSection?.label ?? DEFAULT_IMPORT_SECTION}`;

  function chooseGroup(group: ImportDestinationGroupOption) {
    if (group.disabled) return;
    setCreatingGroup(false);
    setSelectedGroupKey(group.key);
    setSelectedSectionKey(group.sections.find((section) => !section.disabled)?.key ?? '');
    setCreatingSection(false);
    setNewSection(DEFAULT_IMPORT_SECTION);
  }

  function apply() {
    if (creatingGroup) {
      onApply({ group: newGroup, section: newSection });
      return;
    }
    if (creatingSection) {
      onApply({ group: selectedGroup?.label ?? current.group, section: newSection });
      return;
    }
    onApply({ group: selectedGroup?.label ?? current.group, section: selectedSection?.label ?? DEFAULT_IMPORT_SECTION });
  }

  return (
    <View style={styles.picker}>
      <PickerHeader title="เลือก import destination" onBack={onBack} />
      <View style={styles.destinationPickerGrid}>
        <View style={styles.destinationPickerColumn}>
          <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>GROUP</ThemedText>
          <ScrollView style={[styles.destinationPickerList, { borderColor: colors.border }]}>
            {groups.map((group) => (
              <DestinationChoiceRow
                key={group.key}
                label={group.label}
                meta={group.disabled ? `Official Source · ${group.sections.length} sections` : `${group.sections.length} sections`}
                checked={!creatingGroup && selectedGroupKey === group.key}
                disabled={busy || Boolean(group.disabled)}
                onPress={() => chooseGroup(group)}
              />
            ))}
            <DestinationCreateRow
              label="+ Create new group"
              active={creatingGroup}
              disabled={busy}
              onPress={() => {
                setCreatingGroup(true);
                setCreatingSection(true);
                setNewSection(DEFAULT_IMPORT_SECTION);
              }}
            />
          </ScrollView>
          {creatingGroup ? (
            <TextInput
              value={newGroup}
              editable={!busy}
              onChangeText={setNewGroup}
              placeholder="ชื่อ group ใหม่"
              placeholderTextColor={colors.textHint}
              style={[styles.importInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
            />
          ) : null}
        </View>

        <View style={styles.destinationPickerColumn}>
          <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>SECTION</ThemedText>
          {creatingGroup ? (
            <View style={styles.destinationCreatePanel}>
              <ThemedText type="small" themeColor="textSecondary">
                Group ใหม่ยังไม่มี section เดิม ระบบจะสร้าง section ใหม่สำหรับ import รอบนี้
              </ThemedText>
              <TextInput
                value={newSection}
                editable={!busy}
                onChangeText={setNewSection}
                placeholder={DEFAULT_IMPORT_SECTION}
                placeholderTextColor={colors.textHint}
                style={[styles.importInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
              />
            </View>
          ) : selectedGroup ? (
            <ScrollView style={[styles.destinationPickerList, { borderColor: colors.border }]}>
              {selectedGroup.sections.map((section) => (
                <DestinationChoiceRow
                  key={section.key}
                  label={section.label}
                  meta={section.disabled ? 'Official Source · เลือกไม่ได้' : undefined}
                  checked={!creatingSection && selectedSectionKey === section.key}
                  disabled={busy || Boolean(section.disabled)}
                  onPress={() => {
                    if (section.disabled) return;
                    setCreatingSection(false);
                    setSelectedSectionKey(section.key);
                  }}
                />
              ))}
              <DestinationCreateRow
                label="+ Create new section"
                active={creatingSection}
                disabled={busy}
                onPress={() => {
                  setCreatingSection(true);
                  setNewSection(DEFAULT_IMPORT_SECTION);
                }}
              />
            </ScrollView>
          ) : (
            <View style={styles.destinationCreatePanel}>
              <ThemedText type="small" themeColor="textSecondary">เลือก group ก่อน แล้ว section จะขึ้นตาม group นั้น</ThemedText>
            </View>
          )}
          {creatingSection && !creatingGroup ? (
            <TextInput
              value={newSection}
              editable={!busy}
              onChangeText={setNewSection}
              placeholder={DEFAULT_IMPORT_SECTION}
              placeholderTextColor={colors.textHint}
              style={[styles.importInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
            />
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={apply}
        disabled={busy || (creatingGroup && !newGroup.trim()) || Boolean(selectedGroup?.disabled)}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: Accent.base },
          (pressed || busy || (creatingGroup && !newGroup.trim()) || selectedGroup?.disabled) && { opacity: 0.65 },
        ]}>
        <ThemedText type="defaultSemiBold" style={{ color: '#fff' }}>{applyLabel}</ThemedText>
      </Pressable>
    </View>
  );
}

function DestinationChoiceRow({
  label,
  meta,
  checked,
  disabled,
  onPress,
}: {
  label: string;
  meta?: string;
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemePalette();
  const Icon = checked ? FiCheckSquare : FiSquare;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed, hovered }: any) => [
        styles.destinationChoiceRow,
        { borderBottomColor: colors.border, backgroundColor: checked ? 'rgba(224, 32, 44, 0.07)' : hovered ? colors.surface2 : 'transparent' },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.72 },
      ]}>
      <Icon size={16} color={checked ? Accent.base : colors.textHint} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <ThemedText type="smallBold" numberOfLines={1}>{label}</ThemedText>
        {meta ? <ThemedText type="small" themeColor="textHint">{meta}</ThemedText> : null}
      </View>
    </Pressable>
  );
}

function DestinationCreateRow({
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
      accessibilityLabel={label}
      style={({ pressed, hovered }: any) => [
        styles.destinationChoiceRow,
        { borderBottomColor: colors.border, backgroundColor: active ? 'rgba(224, 32, 44, 0.07)' : hovered ? colors.surface2 : 'transparent' },
        pressed && { opacity: 0.72 },
      ]}>
      <FiPlus size={16} color={Accent.base} />
      <ThemedText type="smallBold" style={{ color: Accent.base }}>{label}</ThemedText>
    </Pressable>
  );
}

function ImportField({
  label,
  value,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const colors = useThemePalette();
  return (
    <View style={styles.importField}>
      <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>{label}</ThemedText>
      <TextInput
        value={value}
        editable={!disabled}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textHint}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.importInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
      />
    </View>
  );
}

function ActionRow({
  label,
  hint,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  hint: string;
  icon: ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useThemePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed, hovered }: any) => [
        styles.actionRow,
        { borderBottomColor: colors.border, backgroundColor: hovered ? colors.surface2 : 'transparent' },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.7 },
      ]}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="defaultSemiBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText>
      </View>
    </Pressable>
  );
}

function DeckPicker({
  decks,
  busy,
  onBack,
  onPick,
}: {
  decks: Deck[];
  busy: boolean;
  onBack: () => void;
  onPick: (deck: Deck) => void;
}) {
  const hierarchy = useMemo(() => buildExportHierarchy(decks), [decks]);
  return (
    <View style={styles.picker}>
      <PickerHeader title="เลือก deck ที่จะ export" onBack={onBack} />
      <HierarchyDeckList
        groups={hierarchy}
        busy={busy}
        selected={new Set()}
        mode="single"
        onPick={onPick}
      />
    </View>
  );
}

function BatchPicker({
  decks,
  selected,
  busy,
  onToggle,
  onBack,
  onExport,
}: {
  decks: Deck[];
  selected: Set<string>;
  busy: boolean;
  onToggle: (deckId: string) => void;
  onBack: () => void;
  onExport: () => void;
}) {
  const hierarchy = useMemo(() => buildExportHierarchy(decks), [decks]);
  return (
    <View style={styles.picker}>
      <PickerHeader title={`Batch export · ${selected.size}/${decks.length}`} onBack={onBack} />
      <HierarchyDeckList
        groups={hierarchy}
        busy={busy}
        selected={selected}
        mode="batch"
        onToggle={onToggle}
      />
      <Pressable
        onPress={onExport}
        disabled={busy || selected.size === 0}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: Accent.base },
          (pressed || busy || selected.size === 0) && { opacity: 0.65 },
        ]}>
        <ThemedText type="defaultSemiBold" style={{ color: '#fff' }}>
          Export ZIP
        </ThemedText>
      </Pressable>
    </View>
  );
}

function HierarchyDeckList({
  groups,
  busy,
  selected,
  mode,
  onPick,
  onToggle,
}: {
  groups: ExportHierarchyGroup[];
  busy: boolean;
  selected: Set<string>;
  mode: 'single' | 'batch';
  onPick?: (deck: Deck) => void;
  onToggle?: (deckId: string) => void;
}) {
  const colors = useThemePalette();
  const [openGroups, setOpenGroups] = useState(() => new Set(groups.map((group) => group.key)));
  const [openSections, setOpenSections] = useState(
    () => new Set(groups.flatMap((group) => group.sections.map((section) => section.key))),
  );
  const allGroupKeys = useMemo(() => groups.map((group) => group.key), [groups]);
  const allSectionKeys = useMemo(
    () => groups.flatMap((group) => group.sections.map((section) => section.key)),
    [groups],
  );

  function expandAll() {
    setOpenGroups(new Set(allGroupKeys));
    setOpenSections(new Set(allSectionKeys));
  }
  function collapseAll() {
    setOpenGroups(new Set());
    setOpenSections(new Set());
  }
  function showGroupsOnly() {
    setOpenGroups(new Set(allGroupKeys));
    setOpenSections(new Set());
  }
  function toggleGroup(group: ExportHierarchyGroup) {
    setOpenGroups((prev) => toggleSet(prev, group.key));
  }
  function toggleSection(key: string) {
    setOpenSections((prev) => toggleSet(prev, key));
  }
  function setDecks(deckIds: string[], checked: boolean) {
    if (!onToggle) return;
    for (const deckId of deckIds) {
      if (selected.has(deckId) !== checked) onToggle(deckId);
    }
  }

  const allExpanded = openGroups.size === allGroupKeys.length && openSections.size === allSectionKeys.length;
  const groupsOnly = openGroups.size === allGroupKeys.length && openSections.size === 0;
  const collapsed = openGroups.size === 0;
  const controlStyle = { borderColor: colors.border, backgroundColor: colors.surface2 };
  const activeControlStyle = { borderColor: Accent.base, backgroundColor: colors.surface2 };

  return (
    <View style={styles.hierarchyWrap}>
      <View style={styles.hierarchyControlStack}>
        <View style={styles.hierarchyControlRow}>
          <Pressable onPress={expandAll} style={[styles.indexChip, controlStyle, allExpanded && activeControlStyle]}>
            <ThemedText type="small" style={allExpanded ? { color: Accent.base } : undefined} themeColor={allExpanded ? undefined : 'textSecondary'}>
              Expand all
            </ThemedText>
          </Pressable>
          <Pressable onPress={showGroupsOnly} style={[styles.indexChip, controlStyle, groupsOnly && activeControlStyle]}>
            <ThemedText type="small" style={groupsOnly ? { color: Accent.base } : undefined} themeColor={groupsOnly ? undefined : 'textSecondary'}>
              Groups only
            </ThemedText>
          </Pressable>
          <Pressable onPress={collapseAll} style={[styles.indexChip, controlStyle, collapsed && activeControlStyle]}>
            <ThemedText type="small" style={collapsed ? { color: Accent.base } : undefined} themeColor={collapsed ? undefined : 'textSecondary'}>
              Collapse
            </ThemedText>
          </Pressable>
        </View>
      </View>
      <ScrollView style={[styles.deckList, { borderTopColor: colors.border }]} contentContainerStyle={styles.deckListInner}>
        {groups.map((group) => {
          const groupOpen = openGroups.has(group.key);
          const groupDecks = group.sections.flatMap((section) => section.decks);
          const groupSummary = getExportSelectionSummary(groupDecks, selected);
          return (
            <View key={group.key} style={[styles.hierarchyGroup, { borderBottomColor: colors.border }]}>
              <HierarchyHeader
                label={group.label}
                summary={groupSummary}
                checkable={mode === 'batch'}
                open={groupOpen}
                disabled={busy}
                onToggleOpen={() => toggleGroup(group)}
                onToggleChecked={() => setDecks(groupDecks.map((deck) => deck.id), groupSummary.state !== 'all')}
              />
              {groupOpen && group.sections.map((section) => {
                const sectionOpen = openSections.has(section.key);
                const sectionSummary = getExportSelectionSummary(section.decks, selected);
                return (
                  <View key={section.key} style={styles.hierarchySection}>
                    <HierarchyHeader
                      label={section.label}
                      summary={sectionSummary}
                      checkable={mode === 'batch'}
                      open={sectionOpen}
                      disabled={busy}
                      compact
                      onToggleOpen={() => toggleSection(section.key)}
                      onToggleChecked={() => setDecks(section.decks.map((deck) => deck.id), sectionSummary.state !== 'all')}
                    />
                    {sectionOpen && section.decks.map((deck) => (
                      <DeckChoiceRow
                        key={deck.id}
                        deck={deck}
                        busy={busy}
                        checked={selected.has(deck.id)}
                        mode={mode}
                        onPick={onPick}
                        onToggle={onToggle}
                      />
                    ))}
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function HierarchyHeader({
  label,
  summary,
  checkable,
  open,
  disabled,
  compact,
  onToggleOpen,
  onToggleChecked,
}: {
  label: string;
  summary: ExportSelectionSummary;
  checkable: boolean;
  open: boolean;
  disabled: boolean;
  compact?: boolean;
  onToggleOpen: () => void;
  onToggleChecked: () => void;
}) {
  const colors = useThemePalette();
  const checked = summary.state === 'all';
  const partial = summary.state === 'partial';
  const Icon = checked ? FiCheckSquare : FiSquare;
  return (
    <View
      style={[
        styles.hierarchyHeader,
        webNoTextSelect,
        !checkable && styles.hierarchyHeaderNoCheck,
        !checkable && compact && styles.hierarchyHeaderCompactNoCheck,
        { borderBottomColor: colors.border, backgroundColor: colors.surface2 },
      ]}>
      {checkable ? (
        <Pressable
          onPress={onToggleChecked}
          disabled={disabled}
          accessibilityRole="checkbox"
          accessibilityLabel={`เลือก ${label}`}
          accessibilityState={{ checked: partial ? ('mixed' as any) : checked }}
          style={({ pressed }) => [
            styles.hierarchyCheck,
            webNoTextSelect,
            compact && styles.hierarchyCheckCompact,
            pressed && { opacity: 0.72 },
          ]}>
          {partial ? (
            <FiMinus size={16} color={Accent.base} />
          ) : (
            <Icon size={16} color={checked ? Accent.base : colors.textHint} />
          )}
          <View
            style={[
              styles.hierarchyCheckDivider,
              compact && styles.hierarchyCheckDividerCompact,
              { backgroundColor: colors.border, pointerEvents: 'none' },
            ]}
          />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onToggleOpen}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'ย่อ' : 'ขยาย'} ${label}`}
        style={({ pressed }) => [
          styles.hierarchyTitleButton,
          webNoTextSelect,
          compact && styles.hierarchyTitleButtonCompact,
          pressed && { opacity: 0.7 },
        ]}>
        {open ? <FiMinus
          size={compact ? 15 : 17}
          color={colors.textHint}
          style={styles.hierarchyToggleIcon}
        /> : <FiPlus
          size={compact ? 15 : 17}
          color={colors.textHint}
          style={styles.hierarchyToggleIcon}
        />}
        <View style={styles.hierarchyTitleText}>
          <ThemedText type={compact ? 'smallBold' : 'defaultSemiBold'}>{label}</ThemedText>
          <ThemedText
            type="small"
            themeColor={summary.state === 'partial' ? undefined : 'textHint'}
            style={summary.state === 'partial' ? { color: Accent.base } : undefined}>
            {summary.meta}
          </ThemedText>
        </View>
      </Pressable>
    </View>
  );
}

function DeckChoiceRow({
  deck,
  busy,
  checked,
  mode,
  onPick,
  onToggle,
}: {
  deck: Deck;
  busy: boolean;
  checked: boolean;
  mode: 'single' | 'batch';
  onPick?: (deck: Deck) => void;
  onToggle?: (deckId: string) => void;
}) {
  const colors = useThemePalette();
  const Icon = checked ? FiCheckSquare : FiSquare;
  return (
    <Pressable
      onPress={() => (mode === 'single' ? onPick?.(deck) : onToggle?.(deck.id))}
      disabled={busy}
      accessibilityRole={mode === 'batch' ? 'checkbox' : 'button'}
      accessibilityState={mode === 'batch' ? { checked } : undefined}
      style={({ pressed, hovered }: any) => [
        styles.actionRow,
        styles.hierarchyDeckRow,
        webNoTextSelect,
        {
          borderBottomColor: colors.border,
          backgroundColor: checked && mode === 'batch'
            ? 'rgba(224, 32, 44, 0.07)'
            : hovered ? colors.surface2 : 'transparent',
        },
        pressed && { opacity: 0.7 },
      ]}>
      {mode === 'batch' ? (
        <Icon size={17} color={checked ? Accent.base : colors.textHint} />
      ) : (
        <FiDownload size={17} color={Accent.base} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="defaultSemiBold">{deck.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {deck.entryCount} entries · {deck.source.toUpperCase()}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function PickerHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.pickerHeader}>
      <ThemedText type="defaultSemiBold">{title}</ThemedText>
      <Pressable onPress={onBack} hitSlop={8} style={({ pressed }) => [styles.pickerBackButton, pressed && { opacity: 0.6 }]}>
        <ThemedText type="small" style={{ color: Accent.base }}>Back</ThemedText>
      </Pressable>
    </View>
  );
}

async function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  if (typeof document === 'undefined') return [];
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

function shouldSave(parsed: ManualImportParseResult, localDeckIds: ReadonlySet<string>): boolean {
  if (parsed.ready.length === 0) return false;
  const duplicates = parsed.ready.filter((item) => localDeckIds.has(item.deck.id));
  if (duplicates.length === 0) return true;
  if (typeof window === 'undefined') return false;
  return window.confirm(`พบ deck เดิม ${duplicates.length} รายการ ต้องการเขียนทับไหม?`);
}

function importSummary(parsed: ManualImportParseResult): string {
  const parts = [
    parsed.ready.length > 0 && `import ${parsed.ready.length} decks`,
    parsed.skipped.length > 0 && `skip ${parsed.skipped.length}`,
    parsed.failed.length > 0 && `fail ${parsed.failed.length}`,
  ].filter(Boolean);
  return parts.join(' · ') || 'ไม่มีไฟล์ที่ import ได้';
}

function toggleSet(values: Set<string>, key: string) {
  const next = new Set(values);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  panel: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '82%',
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.four,
    gap: Spacing.three,
    overflow: 'hidden',
    flexShrink: 1,
  },
  howToPanel: {
    maxWidth: 600,
    maxHeight: '82%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.sm,
    marginTop: -4,
    marginRight: -4,
  },
  actionList: { borderTopWidth: StyleSheet.hairlineWidth },
  bodyScroll: {
    flexShrink: 1,
    minHeight: 0,
    ...(Platform.OS === 'web' ? ({ scrollbarGutter: 'stable', scrollbarWidth: 'thin' } as any) : null),
  },
  bodyScrollInner: {
    paddingBottom: Spacing.one,
  },
  destinationPickerGrid: {
    flexDirection: 'column',
    gap: Spacing.three,
  },
  destinationPickerColumn: {
    width: '100%',
    gap: Spacing.two,
  },
  destinationPickerList: {
    maxHeight: 220,
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  destinationChoiceRow: {
    minHeight: 44,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  destinationCreatePanel: {
    minHeight: 88,
    gap: Spacing.two,
  },
  importField: {
    flex: 1,
    minWidth: 150,
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  importInput: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
    fontFamily: Platform.select({ web: '"Sarabun", sans-serif', default: undefined }),
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  picker: {
    flexShrink: 1,
    minHeight: 0,
    gap: Spacing.three,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pickerBackButton: {
    marginRight: Spacing.four,
  },
  deckList: {
    maxHeight: 320,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deckListInner: { paddingBottom: Spacing.two },
  hierarchyWrap: { gap: Spacing.two },
  hierarchyControlStack: {
    gap: Spacing.two,
  },
  hierarchyControlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  indexChip: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  hierarchyGroup: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hierarchySection: {
    paddingLeft: Spacing.two,
  },
  hierarchyHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hierarchyHeaderNoCheck: {
    paddingLeft: 0,
  },
  hierarchyHeaderCompactNoCheck: {
    paddingLeft: Spacing.one,
  },
  hierarchyCheck: {
    width: 56,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  hierarchyCheckCompact: {
    width: 52,
    minHeight: 48,
  },
  hierarchyCheckDivider: {
    position: 'absolute',
    right: 0,
    width: 2,
    height: 24,
    top: '50%',
    transform: [{ translateY: -12 }],
    borderRadius: 1,
  },
  hierarchyCheckDividerCompact: {
    height: 20,
    transform: [{ translateY: -10 }],
  },
  hierarchyTitleButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  hierarchyTitleButtonCompact: {
    minHeight: 48,
    paddingLeft: Spacing.two,
  },
  hierarchyTitleText: {
    flex: 1,
    gap: 1,
  },
  hierarchyToggleIcon: {
    flexShrink: 0,
    marginRight: Spacing.one,
  },
  hierarchyDeckRow: {
    paddingLeft: Spacing.five,
  },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radii.sm,
  },
  status: {
    padding: Spacing.three,
    borderRadius: Radii.sm,
  },
});
