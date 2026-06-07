import { describe, expect, it } from 'vitest';

import type { LibraryDeckRecord } from './download-store';
import { withLibraryDeckTimestamps } from './download-store';

const deck = (overrides: Partial<LibraryDeckRecord>): LibraryDeckRecord => ({
  id: overrides.id ?? 'manual-one',
  type: overrides.type ?? 'vocab',
  level: overrides.level ?? null,
  title: overrides.title ?? 'Manual one',
  entryCount: overrides.entryCount ?? 1,
  isFree: overrides.isFree ?? false,
  pack: overrides.pack ?? overrides.id ?? 'manual-one',
  tags: overrides.tags ?? ['manual'],
  source: overrides.source ?? 'manual',
  importedAt: overrides.importedAt ?? 1000,
  ...overrides,
});

describe('library deck timestamps', () => {
  it('sets createdAt and updatedAt from importedAt for a new library deck', () => {
    expect(withLibraryDeckTimestamps(undefined, deck({ importedAt: 1200 }), 9999)).toMatchObject({
      importedAt: 1200,
      createdAt: 1200,
      updatedAt: 1200,
    });
  });

  it('preserves the original createdAt when a deck is imported again', () => {
    const existing = deck({ importedAt: 1000, createdAt: 1000, updatedAt: 1000 });
    const incoming = deck({ importedAt: 2200, entryCount: 3 });

    expect(withLibraryDeckTimestamps(existing, incoming, 9999)).toMatchObject({
      importedAt: 2200,
      createdAt: 1000,
      updatedAt: 2200,
      entryCount: 3,
    });
  });

  it('keeps an explicit metadata updatedAt from user library mutations', () => {
    const existing = deck({ importedAt: 1000, createdAt: 1000, updatedAt: 1000 });
    const incoming = deck({ importedAt: 1000, createdAt: 1000, updatedAt: 3300, title: 'Renamed' });

    expect(withLibraryDeckTimestamps(existing, incoming, 9999)).toMatchObject({
      createdAt: 1000,
      updatedAt: 3300,
      title: 'Renamed',
    });
  });
});
