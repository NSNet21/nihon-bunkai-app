import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { parseManualImportFiles, saveManualImport, type ManualImportParseResult } from '@/lib/import-export/manual-import';

type Mode = 'actions' | 'how-to' | 'export-one' | 'export-batch';

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

export function LibraryActionsModal({ visible, decks, onClose, onImported }: LibraryActionsModalProps) {
  const colors = useThemePalette();
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('actions');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const exportableDecks = useMemo(() => selectExportableDecks(decks), [decks]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const embeddedFreeDeckIds = useMemo(
    () => new Set(decks.filter((deck) => deck.source === 'free').map((deck) => deck.id)),
    [decks],
  );
  const localDeckIds = useMemo(
    () => new Set(decks.filter((deck) => deck.source !== 'free').map((deck) => deck.id)),
    [decks],
  );

  function close() {
    setMode('actions');
    setStatus('');
    setSelected(new Set());
    onClose();
  }

  function openMode(nextMode: Mode) {
    setStatus('');
    setMode(nextMode);
  }

  async function onImport(multiple: boolean) {
    const files = await pickFiles('.csv,.zip,text/csv,application/zip', multiple);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const parsed = await parseManualImportFiles(files, embeddedFreeDeckIds);
      if (!shouldSave(parsed, localDeckIds)) {
        setStatus('ยกเลิก import');
        return;
      }
      await saveManualImport(parsed);
      onImported();
      const message = importSummary(parsed);
      setStatus(message);
      showToast(message, { kind: parsed.ready.length > 0 ? 'success' : 'info' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      setStatus(message);
      showToast(message, { kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function onExportDeck(deck: Deck) {
    setBusy(true);
    try {
      const { fileName, csv } = await buildDeckCsv(deck);
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
      setStatus(`Export ${deck.title} แล้ว`);
    } finally {
      setBusy(false);
    }
  }

  async function onExportBatch() {
    const chosen = exportableDecks.filter((deck) => selected.has(deck.id));
    if (chosen.length === 0) {
      setStatus('เลือกอย่างน้อย 1 deck ก่อน export');
      return;
    }
    setBusy(true);
    try {
      const blob = await buildDeckZip(chosen);
      downloadBlob(blob, 'nihon-bunkai-library-export.zip');
      setStatus(`Export ${chosen.length} decks เป็น ZIP แล้ว`);
    } finally {
      setBusy(false);
    }
  }

  function openBatchExport() {
    setSelected(new Set());
    openMode('export-batch');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable
          style={[
            styles.panel,
            mode === 'how-to' && styles.howToPanel,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
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
                onPress={() => void onImport(false)}
              />
              <ActionRow
                label={ACTIONS.importBatch}
                hint="เลือกหลาย CSV หรือ ZIP เดียว แล้ว import ต่อเนื่อง"
                icon={<FiArchive size={17} color={Accent.base} />}
                disabled={busy}
                onPress={() => void onImport(true)}
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

          {mode === 'how-to' && (
            <ImportHowTo
              busy={busy}
              onBack={() => openMode('actions')}
              onImportOne={() => void onImport(false)}
              onImportBatch={() => void onImport(true)}
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
              onToggle={(deckId) => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(deckId)) next.delete(deckId);
                  else next.add(deckId);
                  return next;
                });
              }}
              onBack={() => openMode('actions')}
              onExport={() => void onExportBatch()}
            />
          )}

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
            pointerEvents="none"
            style={[
              styles.hierarchyCheckDivider,
              compact && styles.hierarchyCheckDividerCompact,
              { backgroundColor: colors.border },
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
      <Pressable onPress={onBack} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
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
