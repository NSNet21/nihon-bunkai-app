import type { Deck, JlptLevel } from '../../data/types';

export type ExportHierarchySection = {
  key: string;
  label: string;
  decks: Deck[];
};

export type ExportHierarchyGroup = {
  key: string;
  label: string;
  sections: ExportHierarchySection[];
};

export type ExportSelectionSummary = {
  total: number;
  selected: number;
  state: 'none' | 'partial' | 'all';
  meta: string;
};

const LEVEL_ORDER: Array<JlptLevel | 'GLOSSARY'> = ['N5', 'N4', 'N3', 'N2', 'N1', 'GLOSSARY'];
const TYPE_LABELS: Record<string, string> = {
  vocab: 'Vocab',
  grammar: 'Grammar',
  kanji: 'Kanji',
  glossary: 'Glossary',
};
const OFFICIAL_TAGS = new Set([
  'vocab',
  'grammar',
  'kanji',
  'glossary',
  'n1',
  'n2',
  'n3',
  'n4',
  'n5',
]);

export function buildExportHierarchy(decks: readonly Deck[]): ExportHierarchyGroup[] {
  const groups = new Map<string, ExportHierarchyGroup>();

  for (const deck of decks) {
    const placement = getDeckPlacement(deck);
    let group = groups.get(placement.groupKey);
    if (!group) {
      group = { key: placement.groupKey, label: placement.groupLabel, sections: [] };
      groups.set(placement.groupKey, group);
    }
    let section = group.sections.find((item) => item.key === placement.sectionKey);
    if (!section) {
      section = { key: placement.sectionKey, label: placement.sectionLabel, decks: [] };
      group.sections.push(section);
    }
    section.decks.push(deck);
  }

  return [...groups.values()]
    .sort((a, b) => compareGroups(a.label, b.label))
    .map((group) => ({
      ...group,
      sections: group.sections
        .sort((a, b) => compareSections(a.label, b.label))
        .map((section) => ({
          ...section,
          decks: [...section.decks].sort((a, b) => a.title.localeCompare(b.title, 'en')),
        })),
    }));
}

export function getExportSelectionSummary(
  decks: readonly Pick<Deck, 'id'>[],
  selectedDeckIds: ReadonlySet<string>,
): ExportSelectionSummary {
  const total = decks.length;
  const selected = decks.filter((deck) => selectedDeckIds.has(deck.id)).length;
  const state = selected === 0 ? 'none' : selected === total ? 'all' : 'partial';
  return {
    total,
    selected,
    state,
    meta: state === 'all' ? 'เลือกแล้วทั้งหมด' : state === 'partial' ? `เลือกแล้ว ${selected}/${total}` : `${total} decks`,
  };
}

function getDeckPlacement(deck: Deck) {
  const explicitGroup = findTagValue(deck.tags, ['group', 'set', 'collection']);
  const explicitSection = findTagValue(deck.tags, ['section', 'subgroup', 'level']);
  const customTags = (deck.tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => !tag.includes(':'))
    .filter((tag) => !OFFICIAL_TAGS.has(tag.toLowerCase()))
    .filter((tag) => tag !== deck.id && tag !== deck.pack);

  const customGroup = explicitGroup ?? customTags[0];
  if (customGroup) {
    const sectionLabel = explicitSection ?? deck.level ?? customTags[1] ?? TYPE_LABELS[deck.type] ?? 'Decks';
    return {
      groupKey: `custom:${slug(customGroup)}`,
      groupLabel: customGroup,
      sectionKey: `custom:${slug(customGroup)}:${slug(sectionLabel)}`,
      sectionLabel,
    };
  }

  const groupLabel = deck.level ?? 'GLOSSARY';
  const sectionLabel = TYPE_LABELS[deck.type] ?? 'Decks';
  return {
    groupKey: `official:${groupLabel}`,
    groupLabel,
    sectionKey: `official:${groupLabel}:${sectionLabel}`,
    sectionLabel,
  };
}

function findTagValue(tags: readonly string[] | undefined, keys: readonly string[]): string | undefined {
  for (const tag of tags ?? []) {
    const [key, ...rest] = tag.split(':');
    if (!key || rest.length === 0) continue;
    if (keys.includes(key.trim().toLowerCase())) {
      const value = rest.join(':').trim();
      if (value) return value;
    }
  }
  return undefined;
}

function compareGroups(a: string, b: string) {
  const ai = LEVEL_ORDER.indexOf(a as JlptLevel | 'GLOSSARY');
  const bi = LEVEL_ORDER.indexOf(b as JlptLevel | 'GLOSSARY');
  if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
  return a.localeCompare(b, 'en');
}

function compareSections(a: string, b: string) {
  const ai = LEVEL_ORDER.indexOf(a as JlptLevel | 'GLOSSARY');
  const bi = LEVEL_ORDER.indexOf(b as JlptLevel | 'GLOSSARY');
  if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
  const typeOrder = ['Vocab', 'Grammar', 'Kanji', 'Glossary', 'Decks'];
  const ti = typeOrder.indexOf(a);
  const tj = typeOrder.indexOf(b);
  if (ti >= 0 || tj >= 0) return (ti >= 0 ? ti : 999) - (tj >= 0 ? tj : 999);
  return a.localeCompare(b, 'en');
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9ก-๙ぁ-んァ-ン一-龯]+/gi, '-');
}
