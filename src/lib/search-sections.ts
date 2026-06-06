import type { SearchResult } from './search-index';

export type SearchSectionKey = string;

export type SearchSectionHeaderItem = {
  __header: true;
  id: string;
  key: SearchSectionKey;
  count: number;
};
export type SearchRowItem = { __header?: false; id: string; result: SearchResult };
export type SearchListItem = SearchSectionHeaderItem | SearchRowItem;

export type SearchSectionLabel = {
  long: string;
  short: string;
};

const OFFICIAL_LABELS: Record<string, SearchSectionLabel> = {
  N5: { long: 'N5 · พื้นฐาน', short: 'N5' },
  N4: { long: 'N4 · ต้น', short: 'N4' },
  N3: { long: 'N3 · กลาง', short: 'N3' },
  N2: { long: 'N2 · สูง', short: 'N2' },
  N1: { long: 'N1 · สูงสุด', short: 'N1' },
  GLOSSARY: { long: 'GLOSSARY · ศัพท์รวม', short: 'GL' },
};

export function buildSearchSectionList(results: SearchResult[]) {
  const items: SearchListItem[] = [];
  const indices = new Map<SearchSectionKey, number>();
  const counts = new Map<SearchSectionKey, number>();
  const labels = new Map<SearchSectionKey, SearchSectionLabel>();
  const stickyHeaderIndices: number[] = [];
  const availableKeys: SearchSectionKey[] = [];

  let currentKey: SearchSectionKey | null = null;
  let lastHeaderIdx = -1;

  for (const result of results) {
    const key = result.entry.searchSectionKey ?? result.entry.level ?? 'GLOSSARY';
    if (key !== currentKey) {
      currentKey = key;
      lastHeaderIdx = items.length;
      availableKeys.push(key);
      indices.set(key, lastHeaderIdx);
      stickyHeaderIndices.push(lastHeaderIdx);
      labels.set(key, getSearchSectionLabel(result.entry));
      items.push({ __header: true, id: `__hdr_${key}`, key, count: 0 });
    }

    items.push({ id: result.entry.id, result });
    const header = items[lastHeaderIdx] as SearchSectionHeaderItem;
    header.count += 1;
    counts.set(key, header.count);
  }

  return {
    items,
    indices,
    counts,
    labels,
    stickyHeaderIndices,
    availableKeys,
  };
}

export function getSearchSectionLabelForKey(
  key: SearchSectionKey,
  labels: Map<SearchSectionKey, SearchSectionLabel> | null | undefined,
) {
  return labels?.get(key) ?? OFFICIAL_LABELS[key] ?? { long: key, short: key };
}

function getSearchSectionLabel(entry: SearchResult['entry']): SearchSectionLabel {
  if (entry.searchSectionLabel) {
    return {
      long: entry.searchSectionLabel,
      short: entry.searchSectionShortLabel ?? entry.searchSectionLabel,
    };
  }
  return OFFICIAL_LABELS[entry.level ?? 'GLOSSARY'] ?? { long: 'GLOSSARY · ศัพท์รวม', short: 'GL' };
}
