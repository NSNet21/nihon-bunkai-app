import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiArchive, FiCheckSquare, FiDownload, FiSquare, FiUpload, FiX } from 'react-icons/fi';

import type { Deck } from '@/data/types';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { buildDeckCsv, buildDeckZip, downloadBlob, selectExportableDecks } from '@/lib/import-export/export-library';
import { parseManualImportFiles, saveManualImport, type ManualImportParseResult } from '@/lib/import-export/manual-import';

type Mode = 'actions' | 'export-one' | 'export-batch';

type LibraryActionsModalProps = {
  visible: boolean;
  decks: Deck[];
  onClose: () => void;
  onImported: () => void;
};

const ACTIONS = {
  importOne: 'Import one file',
  importBatch: 'Batch import',
  exportOne: 'Export one deck',
  exportBatch: 'Batch export',
} as const;

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
    setSelected(new Set(exportableDecks.map((deck) => deck.id)));
    setMode('export-batch');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable
          style={[styles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.header}>
            <View>
              <ThemedText type="defaultSemiBold">Library actions</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Import / Export สำหรับ deck ที่พร้อมเรียน</ThemedText>
            </View>
            <Pressable onPress={close} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <FiX size={20} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>

          {mode === 'actions' && (
            <View style={styles.actionList}>
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
                onPress={() => setMode('export-one')}
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

          {mode === 'export-one' && (
            <DeckPicker
              decks={exportableDecks}
              busy={busy}
              onBack={() => setMode('actions')}
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
              onBack={() => setMode('actions')}
              onExport={() => void onExportBatch()}
            />
          )}

          {status && (
            <ThemedView type="backgroundElement" style={styles.status}>
              <ThemedText type="small" themeColor="textSecondary">{status}</ThemedText>
            </ThemedView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
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
  return (
    <View style={styles.picker}>
      <PickerHeader title="เลือก deck ที่จะ export" onBack={onBack} />
      <ScrollView style={styles.deckList} contentContainerStyle={styles.deckListInner}>
        {decks.map((deck) => (
          <ActionRow
            key={deck.id}
            label={deck.title}
            hint={`${deck.entryCount} entries · ${deck.source.toUpperCase()}`}
            icon={<FiDownload size={17} color={Accent.base} />}
            disabled={busy}
            onPress={() => onPick(deck)}
          />
        ))}
      </ScrollView>
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
  const colors = useThemePalette();
  return (
    <View style={styles.picker}>
      <PickerHeader title={`Batch export · ${selected.size}/${decks.length}`} onBack={onBack} />
      <ScrollView style={styles.deckList} contentContainerStyle={styles.deckListInner}>
        {decks.map((deck) => {
          const checked = selected.has(deck.id);
          const Icon = checked ? FiCheckSquare : FiSquare;
          return (
            <Pressable
              key={deck.id}
              onPress={() => onToggle(deck.id)}
              disabled={busy}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              style={({ pressed, hovered }: any) => [
                styles.actionRow,
                { borderBottomColor: colors.border, backgroundColor: hovered ? colors.surface2 : 'transparent' },
                pressed && { opacity: 0.7 },
              ]}>
              <Icon size={17} color={checked ? Accent.base : colors.textHint} />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="defaultSemiBold">{deck.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {deck.entryCount} entries · {deck.source.toUpperCase()}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
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
  picker: { gap: Spacing.three },
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
