import type { Entry } from '@/data/types';

export function normalizeDeckTermQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function filterDeckEntries(entries: Entry[], query: string) {
  const normalized = normalizeDeckTermQuery(query);
  if (!normalized) return entries;

  const tokens = normalized.split(' ');
  return entries.filter((entry) => {
    const haystack = [
      entry.id,
      entry.pack,
      entry.type,
      entry.level ?? '',
      entry.no,
      entry.t,
      entry.d,
      entry.p,
      entry.e,
      ...entry.tags,
    ]
      .join(' ')
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
}
