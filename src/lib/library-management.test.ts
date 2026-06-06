import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Deck } from '@/data/types';

const decks = new Map<string, Deck>();
const entries = new Map<string, Array<{ no: number; t: string; d: string; p: string; e: string }>>();
const overrides = new Map<string, { id: string; deckId: string; pack: string; no: number; fields: { t: string; d: string; p: string; e: string }; updatedAt: number }>();

vi.mock('./download-store', () => ({
  deleteLibraryDeckAndEntries: vi.fn(async (deckId: string) => {
    const deck = decks.get(deckId);
    if (!deck) return false;
    decks.delete(deckId);
    entries.delete(deck.pack);
    return true;
  }),
  listLibraryDecks: vi.fn(async () => Array.from(decks.values())),
  getLibraryDeck: vi.fn(async (deckId: string) => decks.get(deckId)),
  putLibraryDeck: vi.fn(async (deck: Deck) => {
    decks.set(deck.id, deck);
  }),
  getLibraryEntriesRecord: vi.fn(async (pack: string) => {
    const deck = Array.from(decks.values()).find((item) => item.pack === pack);
    const rows = entries.get(pack);
    if (!deck || !rows) return undefined;
    return { pack, source: deck.source, rows };
  }),
  putLibraryEntriesRecord: vi.fn(async (record: { pack: string; rows: Array<{ no: number; t: string; d: string; p: string; e: string }> }) => {
    entries.set(record.pack, record.rows);
  }),
  putEntryOverride: vi.fn(async (record: { id: string; deckId: string; pack: string; no: number; fields: { t: string; d: string; p: string; e: string }; updatedAt: number }) => {
    overrides.set(record.id, record);
  }),
  deleteEntryOverride: vi.fn(async (deckId: string, no: number) => overrides.delete(`${deckId}::${no}`)),
}));

import {
  createUserLibraryEntry,
  deleteUserLibraryEntry,
  deleteUserLibraryDeck,
  deleteUserLibraryGroup,
  deleteUserLibrarySection,
  removeUserLibraryGroup,
  removeUserLibrarySection,
  moveUserLibraryDeck,
  renameUserLibraryGroup,
  renameUserLibrarySection,
  renameUserLibraryDeck,
  resetOfficialEntryOverride,
  saveOfficialEntryOverride,
  updateUserLibraryEntry,
} from './library-management';

const manualDeck: Deck = {
  id: 'manual-self-imported-file',
  type: 'vocab',
  level: null,
  title: 'self imported file',
  entryCount: 2,
  isFree: false,
  pack: 'manual-self-imported-file',
  tags: ['manual', 'group:Manual imports'],
  source: 'manual',
};

beforeEach(() => {
  decks.clear();
  entries.clear();
  overrides.clear();
  decks.set(manualDeck.id, manualDeck);
  entries.set(manualDeck.pack, [
    { no: 1, t: '輸入テスト', d: 'ทดสอบนำเข้า', p: 'ゆにゅうてすと', e: '### Import smoke' },
    { no: 2, t: '編集テスト', d: 'ทดสอบแก้ไข', p: 'へんしゅうてすと', e: '### Edit smoke' },
  ]);
  vi.stubGlobal('window', new EventTarget());
});

describe('library management operations', () => {
  it('renames manual decks without changing pack identity', async () => {
    const result = await renameUserLibraryDeck(manualDeck.id, 'My renamed deck');
    expect(result).toEqual({ ok: true });
    expect(decks.get(manualDeck.id)?.title).toBe('My renamed deck');
    expect(decks.get(manualDeck.id)?.pack).toBe(manualDeck.pack);
  });

  it('moves manual decks into explicit user group and section metadata', async () => {
    const result = await moveUserLibraryDeck(manualDeck.id, {
      group: 'Kanji practice',
      section: 'Week 1',
    });
    expect(result).toEqual({ ok: true });
    expect(decks.get(manualDeck.id)?.userGroup).toBe('Kanji practice');
    expect(decks.get(manualDeck.id)?.userSection).toBe('Week 1');
    expect(decks.get(manualDeck.id)?.tags).toContain('group:Kanji practice');
    expect(decks.get(manualDeck.id)?.tags).toContain('section:Week 1');
  });

  it('renames a user group across every manual/custom deck in that group', async () => {
    decks.set('manual-two', {
      ...manualDeck,
      id: 'manual-two',
      pack: 'manual-two',
      title: 'Manual two',
      userGroup: 'Manual imports',
      userSection: 'Inbox',
      tags: ['manual', 'group:Manual imports', 'section:Inbox'],
    });
    decks.set('custom-one', {
      ...manualDeck,
      id: 'custom-one',
      pack: 'custom-one',
      title: 'Custom one',
      source: 'custom',
      userGroup: 'Manual imports',
      userSection: 'Week 1',
      tags: ['custom', 'group:Manual imports', 'section:Week 1'],
    });
    decks.set('official', {
      ...manualDeck,
      id: 'official',
      pack: 'official',
      source: 'entitlement',
      userGroup: 'Manual imports',
      userSection: 'Inbox',
    });

    const result = await renameUserLibraryGroup('Manual imports', 'My practice');

    expect(result).toEqual({ ok: true, changed: 3 });
    expect(decks.get(manualDeck.id)?.userGroup).toBe('My practice');
    expect(decks.get('manual-two')?.userGroup).toBe('My practice');
    expect(decks.get('custom-one')?.userGroup).toBe('My practice');
    expect(decks.get('custom-one')?.userSection).toBe('Week 1');
    expect(decks.get('official')?.userGroup).toBe('Manual imports');
  });

  it('renames one section inside a user group without touching sibling sections', async () => {
    decks.set(manualDeck.id, {
      ...manualDeck,
      userGroup: 'Manual imports',
      userSection: 'Inbox',
      tags: ['manual', 'group:Manual imports', 'section:Inbox'],
    });
    decks.set('manual-two', {
      ...manualDeck,
      id: 'manual-two',
      pack: 'manual-two',
      title: 'Manual two',
      userGroup: 'Manual imports',
      userSection: 'Inbox',
      tags: ['manual', 'group:Manual imports', 'section:Inbox'],
    });
    decks.set('manual-week', {
      ...manualDeck,
      id: 'manual-week',
      pack: 'manual-week',
      title: 'Manual week',
      userGroup: 'Manual imports',
      userSection: 'Week 1',
      tags: ['manual', 'group:Manual imports', 'section:Week 1'],
    });

    const result = await renameUserLibrarySection('Manual imports', 'Inbox', 'Regression');

    expect(result).toEqual({ ok: true, changed: 2 });
    expect(decks.get(manualDeck.id)?.userSection).toBe('Regression');
    expect(decks.get('manual-two')?.userSection).toBe('Regression');
    expect(decks.get('manual-week')?.userSection).toBe('Week 1');
  });

  it('removes a user section by moving matching decks to Inbox inside the same group', async () => {
    await moveUserLibraryDeck(manualDeck.id, { group: 'Kanji practice', section: 'Week 1' });

    const result = await removeUserLibrarySection('Kanji practice', 'Week 1');

    expect(result).toEqual({ ok: true, changed: 1 });
    expect(decks.get(manualDeck.id)?.userGroup).toBe('Kanji practice');
    expect(decks.get(manualDeck.id)?.userSection).toBe('Inbox');
  });

  it('removes a user group by moving matching decks to the manual import inbox', async () => {
    await moveUserLibraryDeck(manualDeck.id, { group: 'Kanji practice', section: 'Week 1' });

    const result = await removeUserLibraryGroup('Kanji practice');

    expect(result).toEqual({ ok: true, changed: 1 });
    expect(decks.get(manualDeck.id)?.userGroup).toBe('Manual imports');
    expect(decks.get(manualDeck.id)?.userSection).toBe('Inbox');
  });

  it('deletes a user section and matching entry rows without touching sibling sections or official decks', async () => {
    decks.set(manualDeck.id, {
      ...manualDeck,
      userGroup: 'Manual imports',
      userSection: 'Regression',
      tags: ['manual', 'group:Manual imports', 'section:Regression'],
    });
    decks.set('manual-sibling', {
      ...manualDeck,
      id: 'manual-sibling',
      pack: 'manual-sibling',
      title: 'Manual sibling',
      userGroup: 'Manual imports',
      userSection: 'Inbox',
      tags: ['manual', 'group:Manual imports', 'section:Inbox'],
    });
    entries.set('manual-sibling', [{ no: 1, t: '残す', d: 'คงไว้', p: 'のこす', e: '' }]);
    decks.set('official-overlap', {
      ...manualDeck,
      id: 'official-overlap',
      pack: 'official-overlap',
      title: 'Official overlap',
      source: 'entitlement',
      userGroup: 'Manual imports',
      userSection: 'Regression',
      tags: ['vocab', 'group:Manual imports', 'section:Regression'],
    });
    entries.set('official-overlap', [{ no: 1, t: '公式', d: 'ทางการ', p: 'こうしき', e: '' }]);

    const result = await deleteUserLibrarySection('Manual imports', 'Regression');

    expect(result).toEqual({ ok: true, changed: 1 });
    expect(decks.has(manualDeck.id)).toBe(false);
    expect(entries.has(manualDeck.pack)).toBe(false);
    expect(decks.has('manual-sibling')).toBe(true);
    expect(entries.has('manual-sibling')).toBe(true);
    expect(decks.has('official-overlap')).toBe(true);
    expect(entries.has('official-overlap')).toBe(true);
  });

  it('deletes a user group and matching entry rows without touching official decks', async () => {
    decks.set(manualDeck.id, {
      ...manualDeck,
      userGroup: 'Manual imports',
      userSection: 'Regression',
      tags: ['manual', 'group:Manual imports', 'section:Regression'],
    });
    decks.set('custom-target', {
      ...manualDeck,
      id: 'custom-target',
      pack: 'custom-target',
      title: 'Custom target',
      source: 'custom',
      userGroup: 'Manual imports',
      userSection: 'Inbox',
      tags: ['custom', 'group:Manual imports', 'section:Inbox'],
    });
    entries.set('custom-target', [{ no: 1, t: '消す', d: 'ลบ', p: 'けす', e: '' }]);
    decks.set('manual-other-group', {
      ...manualDeck,
      id: 'manual-other-group',
      pack: 'manual-other-group',
      title: 'Manual other group',
      userGroup: 'Other group',
      userSection: 'Inbox',
      tags: ['manual', 'group:Other group', 'section:Inbox'],
    });
    entries.set('manual-other-group', [{ no: 1, t: '残る', d: 'เหลือ', p: 'のこる', e: '' }]);
    decks.set('official-overlap', {
      ...manualDeck,
      id: 'official-overlap',
      pack: 'official-overlap',
      title: 'Official overlap',
      source: 'entitlement',
      userGroup: 'Manual imports',
      userSection: 'Regression',
      tags: ['vocab', 'group:Manual imports', 'section:Regression'],
    });
    entries.set('official-overlap', [{ no: 1, t: '公式', d: 'ทางการ', p: 'こうしき', e: '' }]);

    const result = await deleteUserLibraryGroup('Manual imports');

    expect(result).toEqual({ ok: true, changed: 2 });
    expect(decks.has(manualDeck.id)).toBe(false);
    expect(entries.has(manualDeck.pack)).toBe(false);
    expect(decks.has('custom-target')).toBe(false);
    expect(entries.has('custom-target')).toBe(false);
    expect(decks.has('manual-other-group')).toBe(true);
    expect(entries.has('manual-other-group')).toBe(true);
    expect(decks.has('official-overlap')).toBe(true);
    expect(entries.has('official-overlap')).toBe(true);
  });

  it('rejects official deck mutation', async () => {
    decks.set('official', { ...manualDeck, id: 'official', pack: 'official', source: 'entitlement' });
    await expect(renameUserLibraryDeck('official', 'Nope')).resolves.toEqual({
      ok: false,
      reason: 'Official Source ลบหรือแก้ metadata ไม่ได้',
    });
    expect(decks.get('official')?.title).toBe('self imported file');
  });

  it('deletes user decks and matching entry rows', async () => {
    const result = await deleteUserLibraryDeck(manualDeck.id);
    expect(result).toEqual({ ok: true });
    expect(decks.has(manualDeck.id)).toBe(false);
    expect(entries.has(manualDeck.pack)).toBe(false);
  });

  it('updates one term row in a user deck and preserves row number', async () => {
    const result = await updateUserLibraryEntry(manualDeck.id, 2, {
      t: '編集済み',
      d: 'แก้แล้ว',
      p: 'へんしゅうずみ',
      e: '### Edited',
    });
    expect(result).toEqual({ ok: true });
    expect(entries.get(manualDeck.pack)?.[1]).toEqual({
      no: 2,
      t: '編集済み',
      d: 'แก้แล้ว',
      p: 'へんしゅうずみ',
      e: '### Edited',
    });
    expect(decks.get(manualDeck.id)?.entryCount).toBe(2);
  });

  it('deletes one term row in a user deck and updates entry count', async () => {
    const result = await deleteUserLibraryEntry(manualDeck.id, 1);
    expect(result).toEqual({ ok: true });
    expect(entries.get(manualDeck.pack)).toEqual([
      { no: 2, t: '編集テスト', d: 'ทดสอบแก้ไข', p: 'へんしゅうてすと', e: '### Edit smoke' },
    ]);
    expect(decks.get(manualDeck.id)?.entryCount).toBe(1);
  });

  it('creates a term in a user deck with the next highest row number', async () => {
    entries.set(manualDeck.pack, [
      { no: 2, t: '編集テスト', d: 'ทดสอบแก้ไข', p: 'へんしゅうてすと', e: '### Edit smoke' },
      { no: 7, t: '間隔テスト', d: 'ทดสอบช่องว่างเลข', p: 'かんかくてすと', e: '' },
    ]);
    const result = await createUserLibraryEntry(manualDeck.id, {
      t: '追加テスト',
      d: 'ทดสอบเพิ่ม',
      p: 'ついかてすと',
      e: '### Add smoke',
    });
    expect(result).toEqual({
      ok: true,
      entry: {
        id: `${manualDeck.id}-8`,
        no: 8,
        t: '追加テスト',
        d: 'ทดสอบเพิ่ม',
        p: 'ついかてすと',
        e: '### Add smoke',
        type: manualDeck.type,
        level: manualDeck.level,
        pack: manualDeck.pack,
        tags: manualDeck.tags,
      },
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

  it('creates the first term in an empty user deck', async () => {
    entries.set(manualDeck.pack, []);
    const result = await createUserLibraryEntry(manualDeck.id, {
      t: '最初',
      d: 'คำแรก',
      p: 'さいしょ',
      e: '',
    });
    expect(result).toMatchObject({
      ok: true,
      entry: {
        id: `${manualDeck.id}-1`,
        no: 1,
        t: '最初',
        d: 'คำแรก',
      },
    });
    expect(entries.get(manualDeck.pack)).toHaveLength(1);
    expect(decks.get(manualDeck.id)?.entryCount).toBe(1);
  });

  it('rejects term edits for official decks', async () => {
    decks.set('official', { ...manualDeck, id: 'official', pack: 'official', source: 'entitlement' });
    entries.set('official', [{ no: 1, t: '公式', d: 'official', p: 'こうしき', e: '' }]);
    await expect(updateUserLibraryEntry('official', 1, {
      t: 'Nope',
      d: 'Nope',
      p: '',
      e: '',
    })).resolves.toEqual({
      ok: false,
      reason: 'Official Source ลบหรือแก้ metadata ไม่ได้',
    });
    expect(entries.get('official')?.[0]?.t).toBe('公式');
  });

  it('rejects term creation for official decks', async () => {
    decks.set('official', { ...manualDeck, id: 'official', pack: 'official', source: 'entitlement' });
    entries.set('official', [{ no: 1, t: '公式', d: 'official', p: 'こうしき', e: '' }]);
    await expect(createUserLibraryEntry('official', {
      t: 'Nope',
      d: 'Nope',
      p: '',
      e: '',
    })).resolves.toEqual({
      ok: false,
      reason: 'Official Source ลบหรือแก้ metadata ไม่ได้',
    });
    expect(entries.get('official')).toHaveLength(1);
  });

  it('saves an official personal edit as an override without mutating source rows', async () => {
    decks.set('official', { ...manualDeck, id: 'official', pack: 'official', source: 'entitlement' });
    entries.set('official', [{ no: 1, t: '公式', d: 'official', p: 'こうしき', e: '### Source' }]);

    await expect(saveOfficialEntryOverride('official', 1, {
      t: '公式メモ',
      d: 'official personal note',
      p: 'こうしき',
      e: '### Personal',
    })).resolves.toEqual({ ok: true });

    expect(entries.get('official')?.[0]).toEqual({
      no: 1,
      t: '公式',
      d: 'official',
      p: 'こうしき',
      e: '### Source',
    });
    expect(overrides.get('official::1')?.fields).toEqual({
      t: '公式メモ',
      d: 'official personal note',
      p: 'こうしき',
      e: '### Personal',
    });
  });

  it('resets an official personal edit by deleting only the override', async () => {
    decks.set('official', { ...manualDeck, id: 'official', pack: 'official', source: 'entitlement' });
    entries.set('official', [{ no: 1, t: '公式', d: 'official', p: 'こうしき', e: '### Source' }]);
    overrides.set('official::1', {
      id: 'official::1',
      deckId: 'official',
      pack: 'official',
      no: 1,
      fields: { t: '公式メモ', d: 'memo', p: 'こうしき', e: '### Personal' },
      updatedAt: 1,
    });

    await expect(resetOfficialEntryOverride('official', 1)).resolves.toEqual({ ok: true });

    expect(overrides.has('official::1')).toBe(false);
    expect(entries.get('official')?.[0]?.t).toBe('公式');
  });
});
