import type { Deck } from '@/data/types';
import { getDeckOrganization, isUserEditableDeck } from './user-content';

export type BrowseRow =
  | { kind: 'levelHeader';    title: string; key: string; level: string; isOpen: boolean; childCount: number }
  | { kind: 'categoryHeader'; title: string; key: string; level: string; category: string; isOpen: boolean; childCount: number }
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
  custom: 'custom user content',
};

type BrowseGroup = {
  key: string;
  title: string;
  source: 'official' | 'user';
  categories: Map<string, BrowseCategory>;
};

type BrowseCategory = {
  key: string;
  title: string;
  orderKey: Deck['type'] | string;
  decks: Deck[];
};

export function normalizeGroupSearchQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function groupSearchHasQuery(query: string) {
  return normalizeGroupSearchQuery(query).length > 0;
}

export type LibrarySearchFocusRailState = 'idle' | 'focused';

export function getLibrarySearchFocusRailState(inputFocused: boolean): LibrarySearchFocusRailState {
  return inputFocused ? 'focused' : 'idle';
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
  const groups = new Map<string, BrowseGroup>();
  for (const deck of allDecks) {
    const placement = getBrowsePlacement(deck);
    let group = groups.get(placement.groupKey);
    if (!group) {
      group = { key: placement.groupKey, title: placement.groupTitle, source: placement.source, categories: new Map() };
      groups.set(placement.groupKey, group);
    }
    let category = group.categories.get(placement.categoryKey);
    if (!category) {
      category = {
        key: placement.categoryKey,
        title: placement.categoryTitle,
        orderKey: placement.categoryOrderKey,
        decks: [],
      };
      group.categories.set(placement.categoryKey, category);
    }
    category.decks.push(deck);
  }

  const rows: BrowseRow[] = [];
  const levelOrder = ['N5', 'N4', 'N3', 'N2', 'N1', 'GLOSSARY'];
  const orderedGroups = [...groups.values()].sort((a, b) => compareGroups(a, b, levelOrder));
  for (const group of orderedGroups) {
    const level = group.key;
    const categories = group.categories;

    const levelOpen = forceOpen || !closedLevels.has(level);
    const totalChildren = Array.from(categories.values()).reduce((sum, category) => sum + category.decks.length, 0);
    rows.push({ kind: 'levelHeader', title: group.title, key: `lvl-${level}`, level, isOpen: levelOpen, childCount: totalChildren });
    if (!levelOpen) continue;

    const orderedCategories = [...categories.values()].sort((a, b) => compareCategories(a, b));
    for (const category of orderedCategories) {
      const categoryDecks = category.decks;

      const categoryKey = `${level}/${category.key}`;
      const showCategoryHeader = group.source === 'user' || categories.size > 1;
      const categoryOpen = forceOpen || !closedCategories.has(categoryKey);

      if (showCategoryHeader) {
        rows.push({
          kind: 'categoryHeader',
          title: category.title,
          key: `cat-${categoryKey}`,
          level,
          category: category.key,
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

function getBrowsePlacement(deck: Deck) {
  if (isUserEditableDeck(deck)) {
    const organization = getDeckOrganization(deck);
    if (organization.group) {
      const section = organization.section ?? CATEGORY_LABEL[deck.type];
      return {
        source: 'user' as const,
        groupKey: organization.group,
        groupTitle: organization.group,
        categoryKey: section,
        categoryTitle: section,
        categoryOrderKey: section,
      };
    }
  }
  const level = deck.level ?? 'GLOSSARY';
  return {
    source: 'official' as const,
    groupKey: level,
    groupTitle: level,
    categoryKey: deck.type,
    categoryTitle: CATEGORY_LABEL[deck.type],
    categoryOrderKey: deck.type,
  };
}

function compareGroups(a: BrowseGroup, b: BrowseGroup, levelOrder: string[]) {
  if (a.source !== b.source) return a.source === 'official' ? -1 : 1;
  const ai = levelOrder.indexOf(a.key);
  const bi = levelOrder.indexOf(b.key);
  if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
  return a.title.localeCompare(b.title, 'en');
}

function compareCategories(a: BrowseCategory, b: BrowseCategory) {
  const ai = CATEGORY_ORDER.indexOf(a.orderKey as Deck['type']);
  const bi = CATEGORY_ORDER.indexOf(b.orderKey as Deck['type']);
  if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
  return a.title.localeCompare(b.title, 'en');
}
