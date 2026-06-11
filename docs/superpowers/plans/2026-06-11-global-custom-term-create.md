<!-- cspell:disable -->

# Global Custom Term Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม flow สำหรับสร้าง custom term จาก Browse ได้ทั่วทั้ง app โดยไม่ต้องเปิด deck เดิมก่อน พร้อมเลือก/สร้าง group, section, deck และเพิ่มคำต่อได้เร็ว

**Architecture:** แยก logic ออกเป็น helper ที่ test ได้ก่อน แล้วสร้าง shared `CustomTermCreateFlow` ที่ mobile route และ desktop/tablet modal ใช้ร่วมกัน. Destination picker จะถูก extract จาก Library Actions เพื่อไม่ให้ import/batch import กับ custom create drift กัน ส่วน toast จะขยายแบบ backward-compatible ให้กด action ไป Term Preview ได้.

**Tech Stack:** Expo Router, React Native Web, TypeScript, Dexie Local Library, Vitest, Playwright smoke scripts

---

## Resume State

- อ่านแล้ว: `AGENTS.md`, project brief, `PROJECT.md`, `PRODUCT-ROADMAP.md`, `CONTEXT-MAP.md`, `companion-app/CONTEXT.md`, handoff compact-before, และ spec ไทย
- Current phase: Companion App launch-prep
- Current truth: landing/web pass จบแล้ว; งานถัดไปคือ Global Custom Term Create ใน `companion-app/`
- Stale/historical notes: Onevoca/Anki/Quizlet/Vocat compatibility เป็น historical เท่านั้น; native app, Google OAuth, Google Drive backup, full TH/EN toggle ยัง deferred
- Next recommended task: implement ตามแผนนี้โดยเริ่มจาก storage helper + tests
- Risk: modal/footer/double-scroll เคย regress และ Official Source ต้องไม่กลายเป็น save target

## File Structure

- Modify: `companion-app/src/lib/library-management.ts`
  - เพิ่ม `createGlobalUserLibraryEntry()` และ type input/result สำหรับ existing deck หรือ new deck + first entry
  - reuse `createUserLibraryEntry()`, `putLibraryDeck()`, `putLibraryEntriesRecord()`, `listLibraryDecks()`, `applyDeckOrganization()`, `notifyLibraryChanged()`
- Modify: `companion-app/src/lib/library-management.test.ts`
  - เพิ่ม tests สำหรับ global create: existing deck, new deck, official reject, next NO, metadata/event
- Create: `companion-app/src/components/import-destination-picker.tsx`
  - ย้าย `ImportDestinationPicker` ออกจาก `library-actions-modal.tsx` ให้ import flow และ custom create ใช้ร่วมกัน
- Modify: `companion-app/src/components/library-actions-modal.tsx`
  - import shared picker แทน component ฝังในไฟล์เดิม
- Create: `companion-app/src/components/custom-term-create-flow.tsx`
  - owns term fields, destination selection, deck choice, new deck title, save status, markdown help, save-and-continue reset behavior
- Create: `companion-app/src/components/custom-term-create-modal.tsx`
  - desktop/tablet modal shell ที่ mount shared flow
- Create: `companion-app/src/app/term/_layout.tsx`
  - route group shell สำหรับ `/term/new`
- Create: `companion-app/src/app/term/new.tsx`
  - mobile page shell ที่ใช้ shared flow และ back fallback ไป Browse
- Modify: `companion-app/src/app/_layout.tsx`
  - register `term` stack
- Modify: `companion-app/src/app/(tabs)/index.tsx`
  - เพิ่ม entry point `เพิ่มคำ`, mobile push `/term/new`, tablet/desktop เปิด modal
- Modify: `companion-app/src/components/toast.tsx`
  - เพิ่ม optional action callback/label แบบไม่กระทบ existing toasts
- Optional Create: `companion-app/tools/global-custom-term-create-smoke.mjs`
  - focused Playwright smoke ถ้า implementation UI เสร็จและต้องการ regression ที่ repeat ได้

## Task 1: Global Create Helper + Tests

**Files:**
- Modify: `companion-app/src/lib/library-management.test.ts`
- Modify: `companion-app/src/lib/library-management.ts`

- [ ] **Step 1: เพิ่ม failing tests สำหรับ global create**

เพิ่ม import:

```ts
import {
  createGlobalUserLibraryEntry,
  createUserLibraryEntry,
  // existing imports...
} from './library-management';
```

เพิ่ม tests ใน `describe('library management operations', () => { ... })`:

```ts
it('globally creates a term in an existing user deck and preserves next NO', async () => {
  entries.set(manualDeck.pack, [
    { no: 2, t: '編集テスト', d: 'ทดสอบแก้ไข', p: 'へんしゅうてすと', e: '### Edit smoke' },
    { no: 7, t: '間隔テスト', d: 'ทดสอบช่องว่างเลข', p: 'かんかくてすと', e: '' },
  ]);

  const result = await createGlobalUserLibraryEntry({
    target: { kind: 'existing-deck', deckId: manualDeck.id },
    fields: { t: '追加テスト', d: 'ทดสอบเพิ่ม', p: 'ついかてすと', e: '### Add smoke' },
  });

  expect(result).toMatchObject({
    ok: true,
    deckId: manualDeck.id,
    entry: { id: `${manualDeck.id}-8`, no: 8, t: '追加テスト', d: 'ทดสอบเพิ่ม' },
  });
  expect(entries.get(manualDeck.pack)?.at(-1)).toEqual({
    no: 8,
    t: '追加テスト',
    d: 'ทดสอบเพิ่ม',
    p: 'ついかてすと',
    e: '### Add smoke',
  });
  expect(decks.get(manualDeck.id)?.entryCount).toBe(3);
});

it('globally creates a new custom deck with the first term and organization metadata', async () => {
  const result = await createGlobalUserLibraryEntry({
    target: {
      kind: 'new-deck',
      title: 'คำที่เจอบ่อย',
      organization: { group: 'My practice', section: 'Week 1' },
    },
    fields: { t: '始める', d: 'เริ่ม', p: 'はじめる', e: '### Note' },
  });

  expect(result.ok).toBe(true);
  expect(result.deckId).toMatch(/^custom-/);
  expect(result.entry).toMatchObject({ no: 1, t: '始める', d: 'เริ่ม' });
  const deck = decks.get(result.deckId ?? '');
  expect(deck).toMatchObject({
    title: 'คำที่เจอบ่อย',
    source: 'custom',
    isUserContent: true,
    entryCount: 1,
    userGroup: 'My practice',
    userSection: 'Week 1',
  });
  expect(deck?.tags).toContain('custom');
  expect(deck?.tags).toContain('group:My practice');
  expect(deck?.tags).toContain('section:Week 1');
  expect(entries.get(deck?.pack ?? '')).toEqual([
    { no: 1, t: '始める', d: 'เริ่ม', p: 'はじめる', e: '### Note' },
  ]);
});

it('rejects global creation into Official Source', async () => {
  decks.set('official', { ...manualDeck, id: 'official', pack: 'official', source: 'entitlement' });
  entries.set('official', [{ no: 1, t: '公式', d: 'official', p: 'こうしき', e: '' }]);

  await expect(createGlobalUserLibraryEntry({
    target: { kind: 'existing-deck', deckId: 'official' },
    fields: { t: 'Nope', d: 'Nope', p: '', e: '' },
  })).resolves.toEqual({
    ok: false,
    reason: 'Official Source ลบหรือแก้ metadata ไม่ได้',
  });
  expect(entries.get('official')).toHaveLength(1);
});

it('rejects new custom deck with blank title or blank destination names', async () => {
  await expect(createGlobalUserLibraryEntry({
    target: { kind: 'new-deck', title: '   ', organization: { group: 'A', section: 'B' } },
    fields: { t: '語', d: 'คำ', p: '', e: '' },
  })).resolves.toEqual({ ok: false, reason: 'ชื่อ deck ว่างไม่ได้' });

  await expect(createGlobalUserLibraryEntry({
    target: { kind: 'new-deck', title: 'Deck', organization: { group: '   ', section: 'B' } },
    fields: { t: '語', d: 'คำ', p: '', e: '' },
  })).resolves.toEqual({ ok: false, reason: 'ชื่อ group ว่างไม่ได้' });

  await expect(createGlobalUserLibraryEntry({
    target: { kind: 'new-deck', title: 'Deck', organization: { group: 'A', section: '   ' } },
    fields: { t: '語', d: 'คำ', p: '', e: '' },
  })).resolves.toEqual({ ok: false, reason: 'ชื่อ section ว่างไม่ได้' });
});
```

- [ ] **Step 2: Run test ให้ fail**

Run:

```bash
pnpm vitest run src/lib/library-management.test.ts
```

Expected: FAIL เพราะ `createGlobalUserLibraryEntry` ยังไม่มี export

- [ ] **Step 3: เพิ่ม implementation แบบแคบใน `library-management.ts`**

เพิ่ม types ใกล้ `LibraryEntryCreateResult`:

```ts
export type GlobalUserLibraryCreateTarget =
  | { kind: 'existing-deck'; deckId: string }
  | { kind: 'new-deck'; title: string; organization: Required<DeckOrganization> };

export type GlobalUserLibraryEntryCreateInput = {
  target: GlobalUserLibraryCreateTarget;
  fields: EditableEntryFields;
};

export type GlobalUserLibraryEntryCreateResult = LibraryEntryCreateResult & {
  deckId?: string;
};
```

เพิ่ม function หลัง `createUserLibraryEntry()`:

```ts
export async function createGlobalUserLibraryEntry(
  input: GlobalUserLibraryEntryCreateInput,
): Promise<GlobalUserLibraryEntryCreateResult> {
  if (input.target.kind === 'existing-deck') {
    const result = await createUserLibraryEntry(input.target.deckId, input.fields);
    return { ...result, deckId: result.ok ? input.target.deckId : undefined };
  }

  const title = cleanRequired(input.target.title);
  const group = cleanRequired(input.target.organization.group);
  const section = cleanRequired(input.target.organization.section);
  if (!title) return { ok: false, reason: EMPTY_TITLE_REASON };
  if (!group) return { ok: false, reason: EMPTY_GROUP_REASON };
  if (!section) return { ok: false, reason: EMPTY_SECTION_REASON };

  const now = Date.now();
  const deckId = await nextCustomDeckId(title);
  const baseDeck: LibraryDeckRecord = {
    id: deckId,
    type: 'vocab',
    level: null,
    title,
    entryCount: 1,
    isFree: false,
    pack: deckId,
    tags: ['custom', deckId],
    source: 'custom',
    isUserContent: true,
    importedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const deck = applyDeckOrganization(baseDeck, { group, section });
  const row = { no: 1, ...input.fields };
  const entry: Entry = {
    ...row,
    id: `${deck.id}-1`,
    type: deck.type,
    level: deck.level,
    pack: deck.pack,
    tags: deck.tags,
  };

  await putLibraryDeck(deck);
  await putLibraryEntriesRecord({ pack: deck.pack, source: 'custom', rows: [row] });
  notifyLibraryChanged({ source: 'user-content', action: 'deck-create', deckId: deck.id });
  notifyLibraryChanged({ source: 'user-content', action: 'term-create', deckId: deck.id, no: '1' });
  return { ok: true, deckId: deck.id, entry };
}
```

เพิ่ม helpers ใกล้ `cleanRequired()`:

```ts
async function nextCustomDeckId(title: string): Promise<string> {
  const decks = await listLibraryDecks();
  const base = `custom-${slugId(title) || 'deck'}`;
  const existing = new Set(decks.map((deck) => deck.id));
  if (!existing.has(base)) return base;
  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function slugId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙ぁ-んァ-ン一-龯]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Run targeted test ให้ pass**

Run:

```bash
pnpm vitest run src/lib/library-management.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/library-management.ts src/lib/library-management.test.ts
git commit -m "feat: add global custom term library helper"
```

## Task 2: Extract Shared Import Destination Picker

**Files:**
- Create: `companion-app/src/components/import-destination-picker.tsx`
- Modify: `companion-app/src/components/library-actions-modal.tsx`

- [ ] **Step 1: Create shared component file**

สร้าง `src/components/import-destination-picker.tsx` โดยย้าย `ImportDestinationPicker`, `PickerHeader`, และ style ที่ใช้เฉพาะ picker จาก `library-actions-modal.tsx` มาไว้ที่นี่. Export signature:

```ts
export function ImportDestinationPicker({
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
  // ย้าย body เดิมมาโดยไม่เปลี่ยน behavior
}
```

ต้องคง behavior เดิม:

```ts
if (group.disabled) return;
```

และ apply:

```ts
if (creatingGroup) {
  onApply({ group: newGroup, section: newSection });
  return;
}
if (creatingSection) {
  onApply({ group: selectedGroup?.label ?? current.group, section: newSection });
  return;
}
onApply({ group: selectedGroup?.label ?? current.group, section: selectedSection?.label ?? DEFAULT_IMPORT_SECTION });
```

- [ ] **Step 2: Replace embedded picker in Library Actions**

ใน `library-actions-modal.tsx` เพิ่ม import:

```ts
import { ImportDestinationPicker } from '@/components/import-destination-picker';
```

ลบ function `ImportDestinationPicker` เดิมออกจากไฟล์ และลบ imports ที่ไม่ใช้แล้ว เช่น `filterImportDestinationGroups`, `filterImportDestinationSections`, `ImportDestinationGroupOption` ถ้าเหลือเฉพาะ shared file ใช้.

- [ ] **Step 3: Run import/export tests**

Run:

```bash
pnpm vitest run src/lib/import-export/__tests__/import-export.test.ts
```

Expected: PASS

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS หรือเฉพาะ existing baseline ถ้ามี ให้แก้เฉพาะ error ที่เกิดจาก extraction นี้

- [ ] **Step 5: Commit**

```bash
git add src/components/import-destination-picker.tsx src/components/library-actions-modal.tsx
git commit -m "refactor: share import destination picker"
```

## Task 3: Clickable Toast Action

**Files:**
- Modify: `companion-app/src/components/toast.tsx`

- [ ] **Step 1: Extend toast types แบบ backward-compatible**

แก้ types:

```ts
type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastOptions = {
  kind?: ToastKind;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
};
```

แก้ `showToast()`:

```ts
setToasts((prev) => [...prev, {
  id,
  message,
  kind,
  actionLabel: opts?.actionLabel,
  onAction: opts?.onAction,
}]);
```

- [ ] **Step 2: Add action rendering**

ใน `Toast()` เพิ่ม handler:

```ts
function runAction() {
  item.onAction?.();
  onDismiss();
}
```

แทน text block ด้วย:

```tsx
<Pressable
  onPress={item.onAction ? runAction : undefined}
  disabled={!item.onAction}
  style={({ pressed }) => [styles.toastTextWrap, pressed && item.onAction && { opacity: 0.72 }]}>
  <ThemedText type="defaultSemiBold" style={styles.toastText}>
    {item.actionLabel ? `${item.message} · ${item.actionLabel}` : item.message}
  </ThemedText>
</Pressable>
```

เพิ่ม style:

```ts
toastTextWrap: {
  flex: 1,
},
```

- [ ] **Step 3: Run focused TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS หรือไม่มี error ใหม่จาก `toast.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/components/toast.tsx
git commit -m "feat: add toast action callback"
```

## Task 4: Shared Custom Term Create Flow

**Files:**
- Create: `companion-app/src/components/custom-term-create-flow.tsx`

- [ ] **Step 1: Create component state + derived options**

สร้าง file ด้วย imports:

```ts
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FiBookOpen, FiCheck, FiFileText, FiFolder, FiHash, FiPlus, FiTarget } from 'react-icons/fi';

import { ImportDestinationPicker } from '@/components/import-destination-picker';
import { ThemedText } from '@/components/themed-text';
import type { Deck, Entry } from '@/data/types';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { useToast } from '@/components/toast';
import { buildImportDestinationOptions, normalizeImportDestination } from '@/lib/import-export/import-destination';
import { createGlobalUserLibraryEntry } from '@/lib/library-management';
import { canSaveTermEditingForm, normalizeTermEditingFields } from '@/lib/term-editing-form';
import { getDeckOrganization, isUserEditableDeck } from '@/lib/user-content';
import { getEditorInputShellStyle, getEditorTextInputWebStyle } from '@/lib/editor-input-style';
```

ใช้ props:

```ts
type CustomTermCreateFlowProps = {
  decks: Deck[];
  variant: 'page' | 'modal';
  onCreated?: (payload: { deckId: string; entry: Entry }) => void;
  onOpenCreated: (payload: { deckId: string; entryId: string }) => void;
};
```

เพิ่ม state:

```ts
const [t, setT] = useState('');
const [d, setD] = useState('');
const [p, setP] = useState('');
const [e, setE] = useState('');
const [group, setGroup] = useState('Manual imports');
const [section, setSection] = useState('Inbox');
const [deckMode, setDeckMode] = useState<'existing' | 'new'>('new');
const [selectedDeckId, setSelectedDeckId] = useState('');
const [newDeckTitle, setNewDeckTitle] = useState('');
const [busy, setBusy] = useState(false);
const [status, setStatus] = useState('');
```

คำนวณ editable decks:

```ts
const destination = normalizeImportDestination({ group, section });
const destinationOptions = useMemo(() => buildImportDestinationOptions(decks), [decks]);
const editableDecks = useMemo(() => decks.filter((deck) => {
  if (!isUserEditableDeck(deck)) return false;
  const organization = getDeckOrganization(deck);
  return organization.group === destination.group && (organization.section ?? 'Inbox') === destination.section;
}), [decks, destination.group, destination.section]);
```

- [ ] **Step 2: Implement save behavior**

เพิ่ม normalized/canSave:

```ts
const fields = normalizeTermEditingFields({ t, d, p, e });
const canSaveTerm = canSaveTermEditingForm({ editable: true, t, d, p, e });
const canSaveDeck =
  deckMode === 'existing'
    ? Boolean(selectedDeckId)
    : newDeckTitle.trim().length > 0;
const canSave = canSaveTerm && canSaveDeck && !busy;
```

เพิ่ม save:

```ts
async function save() {
  if (!canSave) return;
  setBusy(true);
  setStatus('');
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
    const payload = { deckId: result.deckId, entry: result.entry };
    onCreated?.(payload);
    setT('');
    setD('');
    setP('');
    setE('');
    if (deckMode === 'new') {
      setDeckMode('existing');
      setSelectedDeckId(result.deckId);
    }
    showToast('บันทึกคำแล้ว', {
      kind: 'success',
      durationMs: 6500,
      actionLabel: 'เปิดดู',
      onAction: () => onOpenCreated({ deckId: result.deckId!, entryId: result.entry!.id }),
    });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'บันทึกคำไม่สำเร็จ');
  } finally {
    setBusy(false);
  }
}
```

- [ ] **Step 3: Add Step 1 UI + E markdown help**

Render Step 1 fields with shared `Field` helper:

```tsx
<SectionHeader index="1" title="เขียนคำ" icon={<FiHash size={15} color={Accent.base} />} />
<Field label="T" value={t} onChange={setT} placeholder="คำศัพท์ / Japanese expression" required />
<Field label="D" value={d} onChange={setD} placeholder="ความหมายภาษาไทย" required />
<Field label="P" value={p} onChange={setP} placeholder="คำอ่าน / pronunciation" />
<Field label="E" value={e} onChange={setE} placeholder="รายละเอียด / markdown" multiline />
<View style={[styles.markdownHelp, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
  <ThemedText type="smallBold">Markdown สั้น ๆ สำหรับ E</ThemedText>
  <ThemedText type="small" themeColor="textSecondary">### หัวข้อ · **Label:** รายละเอียด · &gt; note / reading · --- แยกช่วง</ThemedText>
</View>
```

- [ ] **Step 4: Add Step 2 destination picker**

Render:

```tsx
<SectionHeader index="2" title="เก็บไว้ที่ไหน" icon={<FiFolder size={15} color={Accent.base} />} />
<ImportDestinationPicker
  groups={destinationOptions}
  current={destination}
  busy={busy}
  onBack={() => undefined}
  onApply={(value) => {
    const normalized = normalizeImportDestination(value);
    setGroup(normalized.group);
    setSection(normalized.section);
    setSelectedDeckId('');
    setDeckMode('new');
  }}
/>
```

ใน shared picker ถ้า `onBack` เป็น no-op ให้ปุ่ม back ยังแสดงได้แต่ไม่เสีย flow; ถ้าดูรกตอน implement ให้เพิ่ม prop `showBack?: boolean` ใน component extract และตั้ง `showBack={false}` จาก custom flow.

- [ ] **Step 5: Add Step 3 deck choice**

Render:

```tsx
<SectionHeader index="3" title="เลือก deck" icon={<FiBookOpen size={15} color={Accent.base} />} />
<View style={styles.segmentRow}>
  <SegmentButton label="Existing" active={deckMode === 'existing'} disabled={editableDecks.length === 0 || busy} onPress={() => setDeckMode('existing')} />
  <SegmentButton label="New deck" active={deckMode === 'new'} disabled={busy} onPress={() => setDeckMode('new')} />
</View>
{deckMode === 'existing' ? (
  <View style={styles.deckList}>
    {editableDecks.map((deck) => (
      <Pressable key={deck.id} onPress={() => setSelectedDeckId(deck.id)} disabled={busy}>
        <ThemedText type="smallBold">{deck.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{deck.entryCount} terms</ThemedText>
      </Pressable>
    ))}
  </View>
) : (
  <Field label="Deck" value={newDeckTitle} onChange={setNewDeckTitle} placeholder="ชื่อ deck ใหม่" required />
)}
```

- [ ] **Step 6: Add footer save/status**

Render:

```tsx
<View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
  <Pressable
    onPress={() => void save()}
    disabled={!canSave}
    accessibilityRole="button"
    accessibilityLabel="บันทึกคำ"
    style={({ pressed }) => [styles.primaryButton, { opacity: canSave ? 1 : 0.45 }, pressed && canSave && { opacity: 0.78 }]}>
    <FiCheck size={16} color="#fff" />
    <ThemedText type="defaultSemiBold" style={styles.primaryText}>บันทึกคำ</ThemedText>
  </Pressable>
  {status ? <ThemedText type="small" themeColor="textSecondary">{status}</ThemedText> : null}
</View>
```

- [ ] **Step 7: Run TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS หรือแก้เฉพาะ type/style errors ที่เกิดจาก component ใหม่

- [ ] **Step 8: Commit**

```bash
git add src/components/custom-term-create-flow.tsx
git commit -m "feat: add shared custom term create flow"
```

## Task 5: Mobile Route `/term/new`

**Files:**
- Create: `companion-app/src/app/term/_layout.tsx`
- Create: `companion-app/src/app/term/new.tsx`
- Modify: `companion-app/src/app/_layout.tsx`

- [ ] **Step 1: Add term stack**

`src/app/term/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function TermLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

ใน `_layout.tsx` เพิ่ม:

```tsx
<Stack.Screen name="term" />
```

- [ ] **Step 2: Add mobile page shell**

`src/app/term/new.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { FiChevronLeft } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomTermCreateFlow } from '@/components/custom-term-create-flow';
import { RouteLoadingIndicator } from '@/components/route-loading-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { useAllDecks } from '@/hooks/use-decks';

export default function NewTermScreen() {
  const router = useRouter();
  const colors = useThemePalette();
  const { decks, loading, refresh } = useAllDecks();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/' as never);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="กลับ Browse" style={styles.backButton}>
            <FiChevronLeft size={18} color={colors.text} />
          </Pressable>
          <View>
            <ThemedText type="defaultSemiBold">เพิ่มคำใหม่</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">// CUSTOM TERM · local library</ThemedText>
          </View>
        </View>
        {loading ? (
          <RouteLoadingIndicator />
        ) : (
          <CustomTermCreateFlow
            decks={decks}
            variant="page"
            onCreated={refresh}
            onOpenCreated={({ deckId, entryId }) => router.push(`/deck/${deckId}/term/${entryId}` as never)}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  backButton: { padding: Spacing.two },
});
```

ลบ unused `Accent`, `BottomTabInset` ถ้าไม่ได้ใช้จริงตอน implement.

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/_layout.tsx src/app/term/_layout.tsx src/app/term/new.tsx
git commit -m "feat: add global custom term mobile route"
```

## Task 6: Browse Desktop/Tablet Modal Entry

**Files:**
- Create: `companion-app/src/components/custom-term-create-modal.tsx`
- Modify: `companion-app/src/app/(tabs)/index.tsx`

- [ ] **Step 1: Add modal shell**

`src/components/custom-term-create-modal.tsx`:

```tsx
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { FiX } from 'react-icons/fi';
import { useRouter } from 'expo-router';

import { CustomTermCreateFlow } from '@/components/custom-term-create-flow';
import { ThemedText } from '@/components/themed-text';
import type { Deck } from '@/data/types';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';

export function CustomTermCreateModal({
  visible,
  decks,
  onClose,
  onCreated,
}: {
  visible: boolean;
  decks: Deck[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const colors = useThemePalette();
  const router = useRouter();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          onPress={(event: any) => event.stopPropagation?.()}
          style={[styles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <ThemedText type="defaultSemiBold">เพิ่มคำใหม่</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">User Content · Custom deck</ThemedText>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="ปิดเพิ่มคำ" style={styles.closeButton}>
              <FiX size={18} color={colors.text} />
            </Pressable>
          </View>
          <CustomTermCreateFlow
            decks={decks}
            variant="modal"
            onCreated={onCreated}
            onOpenCreated={({ deckId, entryId }) => {
              onClose();
              router.push(`/deck/${deckId}/term/${entryId}` as never);
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  panel: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '92%',
    borderWidth: 1,
    borderTopWidth: 3,
    borderTopColor: Accent.base,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  header: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: { padding: Spacing.two },
});
```

- [ ] **Step 2: Add Browse state and route/modal decision**

ใน `BrowseScreen()` เพิ่ม:

```ts
const [customTermCreateOpen, setCustomTermCreateOpen] = useState(false);
const { width: viewportW } = useWindowDimensions();
const customTermCreateUsesRoute = viewportW < 768;
```

เพิ่ม handler:

```ts
function openCustomTermCreate() {
  if (customTermCreateUsesRoute) {
    router.push('/term/new' as never);
    return;
  }
  setCustomTermCreateOpen(true);
}
```

ต้องเปลี่ยน `const router = useRouter();` หรือ destructure ที่มีอยู่ให้ใช้ `router.push`.

- [ ] **Step 3: Add toolbar entry**

เพิ่ม prop ใน `Toolbar`:

```ts
onOpenCustomTermCreate: () => void;
```

ส่ง prop จาก Browse:

```tsx
<Toolbar
  ...
  onOpenCustomTermCreate={openCustomTermCreate}
/>
```

เพิ่ม button ใกล้ Library actions:

```tsx
<ScaleButton
  onPress={onOpenCustomTermCreate}
  accessibilityLabel="เพิ่มคำใหม่"
  style={[styles.toolBtn, { borderColor: colors.border }]}>
  <View style={styles.toolBtnContent}>
    <FiEdit3 size={14} color={Accent.base} />
    <ThemedText type="small" themeColor="textSecondary">{isCompact ? 'คำ' : 'เพิ่มคำ'}</ThemedText>
  </View>
</ScaleButton>
```

- [ ] **Step 4: Mount modal**

หลัง `LibraryActionsModal`:

```tsx
<CustomTermCreateModal
  visible={customTermCreateOpen}
  decks={decks}
  onClose={() => setCustomTermCreateOpen(false)}
  onCreated={refresh}
/>
```

- [ ] **Step 5: Run TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/custom-term-create-modal.tsx "src/app/(tabs)/index.tsx"
git commit -m "feat: open custom term create from browse"
```

## Task 7: Focused Browser Smoke

**Files:**
- Optional Create: `companion-app/tools/global-custom-term-create-smoke.mjs`
- Modify only if needed: smoke script package scripts

- [ ] **Step 1: Start local web server**

Run:

```bash
pnpm dev -- --port 8097
```

Expected: Expo web ready on `http://localhost:8097`

- [ ] **Step 2: Mobile manual/Playwright check**

Check viewport `390x844`:

```text
Browse -> เพิ่มคำ -> /term/new
T = 試作語
D = คำทดสอบ
P = しさくご
E = ### Note
create group = Manual Smoke Group
create section = Regression
new deck = Smoke custom deck
save
toast shows "บันทึกคำแล้ว · เปิดดู"
toast opens /deck/<deckId>/term/<entryId>
back/open Browse and verify deck appears
Search query "試作語" finds the term
console errors = 0
horizontal overflow = 0
```

- [ ] **Step 3: Desktop/tablet modal check**

Check viewport `1365x768` and `820x1180`:

```text
Browse -> เพิ่มคำ opens modal
select existing Manual Smoke Group / Regression / Smoke custom deck
save another term
modal stays open
T/D/P/E clear
destination/deck remain selected
footer visible
no double page scrollbar caused by modal
toast opens Term Preview and closes modal
console errors = 0
horizontal overflow = 0
```

- [ ] **Step 4: Existing import/export smoke if extraction touched Library Actions**

Run:

```bash
pnpm smoke:import-export http://localhost:8097
```

Expected: PASS

- [ ] **Step 5: Core regression commands**

Run:

```bash
pnpm vitest run
pnpm smoke:deck-route http://localhost:8097
pnpm smoke:term-card http://localhost:8097/deck/kanji-n5-pack02/term/kanji-n5-pack02-21
pnpm smoke:perf http://localhost:8097
```

Expected: PASS; accepted warnings remain `props.pointerEvents is deprecated` and `Animated: useNativeDriver is not supported...`

- [ ] **Step 6: Fix defects found by smoke**

If smoke finds one of these defects, fix in the relevant file and rerun the failing smoke:

```text
Browse hierarchy not refreshing -> ensure onCreated calls refresh and helper dispatches DECKS_IMPORTED_EVENT
Search cannot find created term -> ensure deck is in Local Library and event refresh path fires
Official Source selectable -> ensure deck list filters isUserEditableDeck and destination picker disabled official options stay blocked
Modal footer clipped -> reduce modal body maxHeight and keep footer outside ScrollView
Toast action cannot be clicked -> ensure Toast Pressable has pointer events and dismiss button still works
```

- [ ] **Step 7: Commit verification/smoke fixes**

```bash
git add .
git commit -m "test: cover global custom term create flow"
```

Skip this commit if no files changed during smoke.

## Task 8: Final Review + Push

**Files:**
- All changed files in `companion-app/`

- [ ] **Step 1: Check git status**

Run:

```bash
git status --short
```

Expected: only files touched by this feature are changed

- [ ] **Step 2: Review diff**

Run:

```bash
git diff --stat
git diff
```

Expected:

```text
No unrelated landing/content/root changes
No Official Source mutation path
No copied second destination picker
No hardcoded third-party compatibility claim
```

- [ ] **Step 3: Final test command set**

Run:

```bash
pnpm vitest run
pnpm smoke:import-export http://localhost:8097
pnpm smoke:deck-route http://localhost:8097
pnpm smoke:term-card http://localhost:8097/deck/kanji-n5-pack02/term/kanji-n5-pack02-21
pnpm smoke:perf http://localhost:8097
```

Expected: PASS

- [ ] **Step 4: Push**

Run:

```bash
git status --short
git push
git rev-parse HEAD
git ls-remote origin main
```

Expected: remote `refs/heads/main` hash matches local HEAD

## Self-Review

- Spec coverage: covers mobile route, desktop/tablet modal, shared flow, existing/new group/section, existing/new deck, Official Source rejection, save-and-continue toast, Term Preview navigation, E markdown help, Browse/Search refresh, import destination reuse, and focused regression.
- Placeholder scan: ไม่มี placeholder ว่าง, ไม่มีคำสั่งให้เติมทีหลัง, ไม่มี error handling แบบกำกวม.
- Type consistency: helper uses `GlobalUserLibraryEntryCreateInput`, component uses `createGlobalUserLibraryEntry`, toast uses `actionLabel/onAction`, route target is `/deck/:deckId/term/:entryId`.

<!-- cspell:enable -->
