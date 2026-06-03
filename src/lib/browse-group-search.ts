import type { Deck } from '@/data/types';

export type BrowseRow =
  | { kind: 'levelHeader';    title: string; key: string; level: string; isOpen: boolean; childCount: number }
  | { kind: 'categoryHeader'; title: string; key: string; level: string; category: Deck['type']; isOpen: boolean; childCount: number }
  | { kind: 'deck';           deck: Deck;    key: string; isLast: boolean };

const CATEGORY_ORDER: Deck['type'][] = ['kanji', 'grammar', 'vocab', 'glossary'];
const CATEGORY_LABEL: Record<Deck['type'], string> = {
  kanji:    'KANJI',
  grammar:  'GRAMMAR',
  vocab:    'VOCAB',
  glossary: 'GLOSSARY',
};

const TYPE_SEARCH_LABEL: Record<Deck['type'], string> = {
  kanji: 'kanji 漢字',
  grammar: 'grammar 文法',
  vocab: 'vocab vocabulary คำศัพท์',
  glossary: 'glossary terms พจนานุกรม 辞典',
};

const SOURCE_SEARCH_LABEL: Record<Deck['source'], string> = {
  free: 'free starter ฟรี',
  entitlement: 'owned paid entitlement ซื้อแล้ว',
  manual: 'manual import custom user content',
};

export function normalizeGroupSearchQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function groupSearchHasQuery(query: string) {
  return normalizeGroupSearchQuery(query).length > 0;
}

export function filterBrowseDecks(decks: Deck[], query: string) {
  const normalized = normalizeGroupSearchQuery(query);
  if (!normalized) return decks;

  const tokens = normalized.split(' ');
  return decks.filter((deck) => {
    const haystack = [
      deck.id,
      deck.pack,
      deck.title,
      deck.level ?? 'glossary',
      deck.type,
      TYPE_SEARCH_LABEL[deck.type],
      SOURCE_SEARCH_LABEL[deck.source],
      ...deck.tags,
    ]
      .join(' ')
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
}

export function buildBrowseRows(
  allDecks: Deck[],
  closedLevels: Set<string>,
  closedCategories: Set<string>,
  forceOpen = false,
): BrowseRow[] {
  const byLevel = new Map<string, Map<Deck['type'], Deck[]>>();
  for (const deck of allDecks) {
    const level = deck.level ?? 'GLOSSARY';
    if (!byLevel.has(level)) byLevel.set(level, new Map());
    const categories = byLevel.get(level)!;
    if (!categories.has(deck.type)) categories.set(deck.type, []);
    categories.get(deck.type)!.push(deck);
  }

  const rows: BrowseRow[] = [];
  const levelOrder = ['N5', 'N4', 'N3', 'N2', 'N1', 'GLOSSARY'];
  for (const level of levelOrder) {
    const categories = byLevel.get(level);
    if (!categories) continue;

    const levelOpen = forceOpen || !closedLevels.has(level);
    const totalChildren = Array.from(categories.values()).reduce((sum, decks) => sum + decks.length, 0);
    rows.push({ kind: 'levelHeader', title: level, key: `lvl-${level}`, level, isOpen: levelOpen, childCount: totalChildren });
    if (!levelOpen) continue;

    for (const category of CATEGORY_ORDER) {
      const categoryDecks = categories.get(category);
      if (!categoryDecks?.length) continue;

      const categoryKey = `${level}/${category}`;
      const showCategoryHeader = categories.size > 1;
      const categoryOpen = forceOpen || !closedCategories.has(categoryKey);

      if (showCategoryHeader) {
        rows.push({
          kind: 'categoryHeader',
          title: CATEGORY_LABEL[category],
          key: `cat-${categoryKey}`,
          level,
          category,
          isOpen: categoryOpen,
          childCount: categoryDecks.length,
        });
        if (!categoryOpen) continue;
      }

      categoryDecks.forEach((deck, index) => {
        rows.push({ kind: 'deck', deck, key: deck.id, isLast: index === categoryDecks.length - 1 });
      });
    }
  }

  return rows;
}
