import type { Deck } from '@/data/types';
import { getLibraryDeckTimestamp, type LibrarySortDirection, type LibrarySortMode } from './library-sort';
import { getDeckOrganization, isUserEditableDeck } from './user-content';

export type BrowseActionContext = {
  source: 'user' | 'official';
  target: 'group' | 'section' | 'deck';
  group?: string;
  section?: string;
  deckId?: string;
  title: string;
  childCount?: number;
  disabled?: boolean;
  reason?: string;
};

export type BrowseRow =
  | { kind: 'levelHeader';    title: string; key: string; level: string; isOpen: boolean; childCount: number; actionContext?: BrowseActionContext }
  | { kind: 'categoryHeader'; title: string; key: string; level: string; category: string; isOpen: boolean; childCount: number; actionContext?: BrowseActionContext }
  | { kind: 'deck';           deck: Deck;    key: string; isLast: boolean; actionContext?: BrowseActionContext };

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

export type BrowseRowSortOptions = {
  mode: LibrarySortMode;
  direction: LibrarySortDirection;
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
  sortOptions: BrowseRowSortOptions = { mode: 'default', direction: 'asc' },
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
  const orderedGroups = [...groups.values()].sort((a, b) => compareGroups(a, b, levelOrder, sortOptions));
  for (const group of orderedGroups) {
    const level = group.key;
    const categories = group.categories;

    const levelOpen = forceOpen || !closedLevels.has(level);
    const totalChildren = Array.from(categories.values()).reduce((sum, category) => sum + category.decks.length, 0);
    rows.push({
      kind: 'levelHeader',
      title: group.title,
      key: `lvl-${level}`,
      level,
      isOpen: levelOpen,
      childCount: totalChildren,
      actionContext: group.source === 'user'
        ? {
          source: 'user',
          target: 'group',
          group: group.title,
          title: group.title,
          childCount: totalChildren,
        }
        : {
          source: 'official',
          target: 'group',
          title: group.title,
          childCount: totalChildren,
          disabled: true,
          reason: 'Official Source แก้ไม่ได้',
        },
    });
    if (!levelOpen) continue;

    const orderedCategories = [...categories.values()].sort((a, b) => compareCategories(a, b, sortOptions));
    for (const category of orderedCategories) {
      const categoryDecks = sortCategoryDecks(category.decks, sortOptions);

      const categoryKey = `${level}/${category.key}`;
      const showCategoryHeader = group.source === 'user' || categories.size > 1 || group.key === 'GLOSSARY';
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
          actionContext: group.source === 'user'
            ? {
              source: 'user',
              target: 'section',
              group: group.title,
              section: category.title,
              title: category.title,
              childCount: categoryDecks.length,
            }
            : {
              source: 'official',
              target: 'section',
              title: category.title,
              childCount: categoryDecks.length,
              disabled: true,
              reason: 'Official Source แก้ไม่ได้',
            },
        });
        if (!categoryOpen) continue;
      }

      categoryDecks.forEach((deck, index) => {
        const organization = isUserEditableDeck(deck) ? getDeckOrganization(deck) : {};
        rows.push({
          kind: 'deck',
          deck,
          key: deck.id,
          isLast: index === categoryDecks.length - 1,
          actionContext: organization.group
            ? {
              source: 'user',
              target: 'deck',
              group: organization.group,
              section: organization.section,
              deckId: deck.id,
              title: deck.title,
              childCount: deck.entryCount,
            }
            : undefined,
        });
      });
    }
  }

  return rows;
}

export function buildBrowseCollapseKeys(allDecks: Deck[]) {
  const levelKeys = new Set<string>();
  const categoryKeys = new Set<string>();

  for (const deck of allDecks) {
    const placement = getBrowsePlacement(deck);
    levelKeys.add(placement.groupKey);
    categoryKeys.add(`${placement.groupKey}/${placement.categoryKey}`);
  }

  return {
    levelKeys: [...levelKeys],
    categoryKeys: [...categoryKeys],
  };
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

function compareGroups(a: BrowseGroup, b: BrowseGroup, levelOrder: string[], sortOptions: BrowseRowSortOptions) {
  if (a.source !== b.source) return a.source === 'official' ? -1 : 1;
  const ai = levelOrder.indexOf(a.key);
  const bi = levelOrder.indexOf(b.key);
  if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
  if (sortOptions.mode === 'date') {
    const dateDiff = compareNumber(groupTimestamp(a), groupTimestamp(b), sortOptions.direction);
    if (dateDiff !== 0) return dateDiff;
  }
  if (sortOptions.mode === 'name') {
    const titleDiff = compareText(a.title, b.title, sortOptions.direction);
    if (titleDiff !== 0) return titleDiff;
  }
  return a.title.localeCompare(b.title, 'en');
}

function compareCategories(a: BrowseCategory, b: BrowseCategory, sortOptions: BrowseRowSortOptions) {
  if (sortOptions.mode === 'date') {
    const dateDiff = compareNumber(categoryTimestamp(a), categoryTimestamp(b), sortOptions.direction);
    if (dateDiff !== 0) return dateDiff;
  }
  if (sortOptions.mode === 'name') {
    const titleDiff = compareText(a.title, b.title, sortOptions.direction);
    if (titleDiff !== 0) return titleDiff;
  }
  const ai = CATEGORY_ORDER.indexOf(a.orderKey as Deck['type']);
  const bi = CATEGORY_ORDER.indexOf(b.orderKey as Deck['type']);
  if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
  return a.title.localeCompare(b.title, 'en');
}

function sortCategoryDecks(decks: Deck[], sortOptions: BrowseRowSortOptions): Deck[] {
  if (sortOptions.mode !== 'date') return decks;
  return [...decks].sort((a, b) => {
    const dateDiff = compareNumber(getLibraryDeckTimestamp(a), getLibraryDeckTimestamp(b), sortOptions.direction);
    if (dateDiff !== 0) return dateDiff;
    return a.title.localeCompare(b.title, ['th', 'ja', 'en'], { numeric: true, sensitivity: 'base' });
  });
}

function groupTimestamp(group: BrowseGroup): number {
  return Math.max(0, ...[...group.categories.values()].map(categoryTimestamp));
}

function categoryTimestamp(category: BrowseCategory): number {
  return Math.max(0, ...category.decks.map(getLibraryDeckTimestamp));
}

function compareNumber(a: number, b: number, direction: LibrarySortDirection): number {
  return direction === 'asc' ? a - b : b - a;
}

function compareText(a: string, b: string, direction: LibrarySortDirection): number {
  const diff = a.localeCompare(b, ['th', 'ja', 'en'], { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? diff : -diff;
}
