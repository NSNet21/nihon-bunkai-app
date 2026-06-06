import type { Deck, Entry } from '@/data/types';
import { decks as freeDecks } from '../data/free-tier';
import { DECKS_IMPORTED_EVENT } from './deck-import';
import {
  deleteLibraryDeckAndEntries,
  getLibraryEntriesRecord,
  getLibraryDeck,
  listLibraryDecks,
  putLibraryEntriesRecord,
  putLibraryDeck,
  putEntryOverride,
  deleteEntryOverride,
  type LibraryDeckRecord,
} from './download-store';
import { entryOverrideKey } from './personal-overrides';
import { applyDeckOrganization, isOfficialDeck, isUserEditableDeck, type DeckOrganization } from './user-content';

export type LibraryMutationResult = {
  ok: boolean;
  reason?: string;
};

export type LibraryEntryCreateResult = LibraryMutationResult & {
  entry?: Entry;
};

export type LibraryBulkMutationResult = LibraryMutationResult & {
  changed?: number;
};

const OFFICIAL_REJECT_REASON = 'Official Source ลบหรือแก้ metadata ไม่ได้';
const MISSING_DECK_REASON = 'ไม่พบ deck ใน Local Library';
const MISSING_ENTRY_REASON = 'ไม่พบคำนี้ใน Local Library';
const EMPTY_TITLE_REASON = 'ชื่อ deck ว่างไม่ได้';
const EMPTY_GROUP_REASON = 'ชื่อ group ว่างไม่ได้';
const EMPTY_SECTION_REASON = 'ชื่อ section ว่างไม่ได้';
const MISSING_GROUP_REASON = 'ไม่พบ user group นี้ใน Local Library';
const MISSING_SECTION_REASON = 'ไม่พบ user section นี้ใน Local Library';
const DEFAULT_USER_GROUP = 'Manual imports';
const DEFAULT_USER_SECTION = 'Inbox';

export type EditableEntryFields = {
  t: string;
  d: string;
  p: string;
  e: string;
};

export async function renameUserLibraryDeck(deckId: string, title: string): Promise<LibraryMutationResult> {
  const deck = await getMutableLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  const cleanTitle = title.trim();
  if (!cleanTitle) return { ok: false, reason: EMPTY_TITLE_REASON };
  await putLibraryDeck({
    ...deck,
    title: cleanTitle,
    isUserContent: true,
    updatedAt: Date.now(),
  });
  notifyLibraryChanged({ source: 'user-content', action: 'rename', deckId });
  return { ok: true };
}

export async function moveUserLibraryDeck(
  deckId: string,
  organization: DeckOrganization,
): Promise<LibraryMutationResult> {
  const deck = await getMutableLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  await putLibraryDeck(applyDeckOrganization(deck, organization));
  notifyLibraryChanged({ source: 'user-content', action: 'move', deckId });
  return { ok: true };
}

export async function renameUserLibraryGroup(
  group: string,
  nextGroup: string,
): Promise<LibraryBulkMutationResult> {
  const cleanGroup = cleanRequired(group);
  const cleanNextGroup = cleanRequired(nextGroup);
  if (!cleanGroup || !cleanNextGroup) return { ok: false, reason: EMPTY_GROUP_REASON };
  return mutateUserLibraryDecksByOrganization(
    (organization) => organization.group === cleanGroup,
    (deck, organization) => applyDeckOrganization(deck, { group: cleanNextGroup, section: organization.section }),
    { missingReason: MISSING_GROUP_REASON, action: 'group-rename', group: cleanGroup, nextGroup: cleanNextGroup },
  );
}

export async function renameUserLibrarySection(
  group: string,
  section: string,
  nextSection: string,
): Promise<LibraryBulkMutationResult> {
  const cleanGroup = cleanRequired(group);
  const cleanSection = cleanRequired(section);
  const cleanNextSection = cleanRequired(nextSection);
  if (!cleanGroup) return { ok: false, reason: EMPTY_GROUP_REASON };
  if (!cleanSection || !cleanNextSection) return { ok: false, reason: EMPTY_SECTION_REASON };
  return mutateUserLibraryDecksByOrganization(
    (organization) => organization.group === cleanGroup && organization.section === cleanSection,
    (deck, organization) => applyDeckOrganization(deck, { group: organization.group, section: cleanNextSection }),
    {
      missingReason: MISSING_SECTION_REASON,
      action: 'section-rename',
      group: cleanGroup,
      section: cleanSection,
      nextSection: cleanNextSection,
    },
  );
}

export async function removeUserLibrarySection(
  group: string,
  section: string,
): Promise<LibraryBulkMutationResult> {
  const cleanGroup = cleanRequired(group);
  const cleanSection = cleanRequired(section);
  if (!cleanGroup) return { ok: false, reason: EMPTY_GROUP_REASON };
  if (!cleanSection) return { ok: false, reason: EMPTY_SECTION_REASON };
  return mutateUserLibraryDecksByOrganization(
    (organization) => organization.group === cleanGroup && organization.section === cleanSection,
    (deck, organization) => applyDeckOrganization(deck, {
      group: organization.group,
      section: DEFAULT_USER_SECTION,
    }),
    {
      missingReason: MISSING_SECTION_REASON,
      action: 'section-remove',
      group: cleanGroup,
      section: cleanSection,
      nextSection: DEFAULT_USER_SECTION,
    },
  );
}

export async function removeUserLibraryGroup(group: string): Promise<LibraryBulkMutationResult> {
  const cleanGroup = cleanRequired(group);
  if (!cleanGroup) return { ok: false, reason: EMPTY_GROUP_REASON };
  return mutateUserLibraryDecksByOrganization(
    (organization) => organization.group === cleanGroup,
    (deck) => applyDeckOrganization(deck, { group: DEFAULT_USER_GROUP, section: DEFAULT_USER_SECTION }),
    {
      missingReason: MISSING_GROUP_REASON,
      action: 'group-remove',
      group: cleanGroup,
      nextGroup: DEFAULT_USER_GROUP,
      nextSection: DEFAULT_USER_SECTION,
    },
  );
}

export async function deleteUserLibraryDeck(deckId: string): Promise<LibraryMutationResult> {
  const deck = await getMutableLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  const deleted = await deleteLibraryDeckAndEntries(deck.id);
  if (!deleted) return { ok: false, reason: MISSING_DECK_REASON };
  notifyLibraryChanged({ source: 'user-content', action: 'delete', deckId });
  return { ok: true };
}

export async function updateUserLibraryEntry(
  deckId: string,
  no: number,
  fields: EditableEntryFields,
): Promise<LibraryMutationResult> {
  const deck = await getMutableLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  const entryRecord = await getLibraryEntriesRecord(deck.pack);
  if (!entryRecord) return { ok: false, reason: MISSING_ENTRY_REASON };
  const rowIndex = entryRecord.rows.findIndex((row) => row.no === no);
  if (rowIndex < 0) return { ok: false, reason: MISSING_ENTRY_REASON };
  const rows = entryRecord.rows.map((row, index) => (
    index === rowIndex ? { ...row, ...fields, no: row.no } : row
  ));
  await putLibraryEntriesRecord({ ...entryRecord, rows });
  await putLibraryDeck({ ...deck, entryCount: rows.length, isUserContent: true, updatedAt: Date.now() });
  notifyLibraryChanged({ source: 'user-content', action: 'term-update', deckId, no: String(no) });
  return { ok: true };
}

export async function createUserLibraryEntry(
  deckId: string,
  fields: EditableEntryFields,
): Promise<LibraryEntryCreateResult> {
  const deck = await getMutableLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  const entryRecord = await getLibraryEntriesRecord(deck.pack);
  if (!entryRecord) return { ok: false, reason: MISSING_ENTRY_REASON };
  const nextNo = entryRecord.rows.reduce((max, row) => Math.max(max, row.no), 0) + 1;
  const row = { no: nextNo, ...fields };
  const rows = [...entryRecord.rows, row];
  const entry: Entry = {
    ...row,
    id: `${deck.id}-${nextNo}`,
    type: deck.type,
    level: deck.level,
    pack: deck.pack,
    tags: deck.tags,
  };
  await putLibraryEntriesRecord({ ...entryRecord, rows });
  await putLibraryDeck({ ...deck, entryCount: rows.length, isUserContent: true, updatedAt: Date.now() });
  notifyLibraryChanged({ source: 'user-content', action: 'term-create', deckId, no: String(nextNo) });
  return { ok: true, entry };
}

export async function deleteUserLibraryEntry(deckId: string, no: number): Promise<LibraryMutationResult> {
  const deck = await getMutableLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  const entryRecord = await getLibraryEntriesRecord(deck.pack);
  if (!entryRecord) return { ok: false, reason: MISSING_ENTRY_REASON };
  const rows = entryRecord.rows.filter((row) => row.no !== no);
  if (rows.length === entryRecord.rows.length) return { ok: false, reason: MISSING_ENTRY_REASON };
  await putLibraryEntriesRecord({ ...entryRecord, rows });
  await putLibraryDeck({ ...deck, entryCount: rows.length, isUserContent: true, updatedAt: Date.now() });
  notifyLibraryChanged({ source: 'user-content', action: 'term-delete', deckId, no: String(no) });
  return { ok: true };
}

export async function saveOfficialEntryOverride(
  deckId: string,
  no: number,
  fields: EditableEntryFields,
): Promise<LibraryMutationResult> {
  const deck = await getOfficialLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  await putEntryOverride({
    id: entryOverrideKey(deck.id, no),
    deckId: deck.id,
    pack: deck.pack,
    no,
    fields,
    updatedAt: Date.now(),
  });
  notifyLibraryChanged({ source: 'personal-override', action: 'term-override-save', deckId, no: String(no) });
  return { ok: true };
}

export async function resetOfficialEntryOverride(deckId: string, no: number): Promise<LibraryMutationResult> {
  const deck = await getOfficialLibraryDeck(deckId);
  if ('ok' in deck) return deck;
  await deleteEntryOverride(deck.id, no);
  notifyLibraryChanged({ source: 'personal-override', action: 'term-override-reset', deckId, no: String(no) });
  return { ok: true };
}

async function getMutableLibraryDeck(deckId: string): Promise<LibraryDeckRecord | LibraryMutationResult> {
  const deck = await getLibraryDeck(deckId);
  if (!deck) return { ok: false, reason: MISSING_DECK_REASON };
  if (!isUserEditableDeck(deck as Deck)) return { ok: false, reason: OFFICIAL_REJECT_REASON };
  return deck;
}

async function getOfficialLibraryDeck(deckId: string): Promise<Deck | LibraryMutationResult> {
  const deck = (await getLibraryDeck(deckId)) ?? freeDecks.find((item) => item.id === deckId);
  if (!deck) return { ok: false, reason: MISSING_DECK_REASON };
  if (!isOfficialDeck(deck as Deck)) return { ok: false, reason: 'User Content ใช้การแก้คำโดยตรงอยู่แล้ว' };
  return deck as Deck;
}

async function mutateUserLibraryDecksByOrganization(
  match: (organization: DeckOrganization, deck: LibraryDeckRecord) => boolean,
  update: (deck: LibraryDeckRecord, organization: DeckOrganization) => LibraryDeckRecord,
  eventDetail: Record<string, string>,
): Promise<LibraryBulkMutationResult> {
  const decks = await listLibraryDecks();
  const matching = decks.filter((deck) => {
    if (!isUserEditableDeck(deck as Deck)) return false;
    return match(readDeckOrganization(deck), deck);
  });
  if (matching.length === 0) return { ok: false, reason: eventDetail.missingReason };

  for (const deck of matching) {
    await putLibraryDeck(update(deck, readDeckOrganization(deck)));
  }
  notifyLibraryChanged({ source: 'user-content', ...eventDetail, changed: String(matching.length) });
  return { ok: true, changed: matching.length };
}

function readDeckOrganization(deck: LibraryDeckRecord): DeckOrganization {
  return {
    group: cleanRequired(deck.userGroup) ?? cleanTag(deck.tags, 'group'),
    section: cleanRequired(deck.userSection) ?? cleanTag(deck.tags, 'section'),
  };
}

function cleanTag(tags: readonly string[] | undefined, key: string): string | undefined {
  const prefix = `${key}:`;
  const found = (tags ?? []).find((tag) => tag.toLowerCase().startsWith(prefix));
  return cleanRequired(found?.slice(prefix.length));
}

function cleanRequired(value: string | undefined): string | undefined {
  const clean = value?.trim();
  return clean ? clean : undefined;
}

function notifyLibraryChanged(detail: Record<string, string>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DECKS_IMPORTED_EVENT, { detail }));
}
