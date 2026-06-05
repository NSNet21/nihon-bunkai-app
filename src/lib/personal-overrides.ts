import type { Entry } from '@/data/types';
import type { EditableEntryFields } from './library-management';

export type EntryOverrideRecord = {
  id: string;
  deckId: string;
  pack: string;
  no: number;
  fields: EditableEntryFields;
  updatedAt: number;
};

export function entryOverrideKey(deckId: string, no: number): string {
  return `${deckId}::${no}`;
}

export function applyEntryOverrides(
  deckId: string,
  entries: readonly Entry[],
  overrides: readonly EntryOverrideRecord[],
): Entry[] {
  if (entries.length === 0 || overrides.length === 0) return [...entries];
  const byNo = new Map<number, EntryOverrideRecord>();
  for (const override of overrides) {
    if (override.deckId !== deckId) continue;
    byNo.set(override.no, override);
  }
  if (byNo.size === 0) return [...entries];
  return entries.map((entry) => {
    const override = byNo.get(entry.no);
    if (!override) return entry;
    return {
      ...entry,
      ...override.fields,
      hasPersonalOverride: true,
    };
  });
}
