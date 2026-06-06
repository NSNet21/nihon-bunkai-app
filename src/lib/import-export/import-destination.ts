import type { Deck } from '../../data/types';
import { getDeckOrganization } from '../user-content';

export type ImportDestinationSectionOption = {
  key: string;
  label: string;
  source: 'user' | 'official';
  disabled?: boolean;
};

export type ImportDestinationGroupOption = {
  key: string;
  label: string;
  source: 'user' | 'official';
  disabled?: boolean;
  sections: ImportDestinationSectionOption[];
};

export type ImportDestinationValue = {
  group: string;
  section: string;
};

export const DEFAULT_IMPORT_GROUP = 'Manual imports';
export const DEFAULT_IMPORT_SECTION = 'Inbox';

const USER_EDITABLE_SOURCES = new Set(['manual', 'custom']);
const OFFICIAL_SOURCES = new Set(['free', 'entitlement']);
const TYPE_LABELS: Record<string, string> = {
  vocab: 'Vocab',
  grammar: 'Grammar',
  kanji: 'Kanji',
  glossary: 'Glossary',
};
const GROUP_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1', 'GLOSSARY'];
const SECTION_ORDER = ['Vocab', 'Grammar', 'Kanji', 'Glossary', 'Decks'];

export function buildImportDestinationOptions(decks: readonly Deck[]): ImportDestinationGroupOption[] {
  const groups = new Map<string, ImportDestinationGroupOption>();

  for (const deck of decks) {
    if (!deck.source) continue;
    if (USER_EDITABLE_SOURCES.has(deck.source)) {
      addUserDestination(groups, deck);
      continue;
    }
    if (OFFICIAL_SOURCES.has(deck.source)) {
      addOfficialDestination(groups, deck);
    }
  }

  return [...groups.values()]
    .sort((a, b) => compareGroups(a, b))
    .map((group) => ({
      ...group,
      sections: [...group.sections].sort((a, b) => compareSections(a, b)),
    }));
}

function addUserDestination(groups: Map<string, ImportDestinationGroupOption>, deck: Deck) {
    const organization = getDeckOrganization(deck);
    const groupLabel = clean(organization.group);
    if (!groupLabel) return;
    const sectionLabel = clean(organization.section) ?? DEFAULT_IMPORT_SECTION;
    const groupKey = slug(groupLabel);
    const sectionKey = `${groupKey}:${slug(sectionLabel)}`;

    let group = groups.get(groupKey);
    if (!group) {
      group = { key: groupKey, label: groupLabel, source: 'user', sections: [] };
      groups.set(groupKey, group);
    }
    if (!group.sections.some((section) => section.key === sectionKey)) {
      group.sections.push({ key: sectionKey, label: sectionLabel, source: 'user' });
    }
}

function addOfficialDestination(groups: Map<string, ImportDestinationGroupOption>, deck: Deck) {
  const groupLabel = deck.level ?? 'GLOSSARY';
  const sectionLabel = TYPE_LABELS[deck.type] ?? 'Decks';
  const groupKey = `official:${slug(groupLabel)}`;
  const sectionKey = `${groupKey}:${slug(sectionLabel)}`;
  let group = groups.get(groupKey);
  if (!group) {
    group = { key: groupKey, label: groupLabel, source: 'official', disabled: true, sections: [] };
    groups.set(groupKey, group);
  }
  if (!group.sections.some((section) => section.key === sectionKey)) {
    group.sections.push({ key: sectionKey, label: sectionLabel, source: 'official', disabled: true });
  }
}

export function normalizeImportDestination(value: Partial<ImportDestinationValue>): ImportDestinationValue {
  const group = clean(value.group) ?? DEFAULT_IMPORT_GROUP;
  const section = clean(value.section) ?? DEFAULT_IMPORT_SECTION;
  return { group, section };
}

export function filterImportDestinationGroups(
  groups: readonly ImportDestinationGroupOption[],
  query: string,
): ImportDestinationGroupOption[] {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return [...groups];
  return groups.filter((group) => matchesSearch(group.label, normalizedQuery));
}

export function filterImportDestinationSections(
  group: ImportDestinationGroupOption,
  query: string,
): ImportDestinationSectionOption[] {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return [...group.sections];
  return group.sections.filter((section) => matchesSearch(section.label, normalizedQuery));
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function matchesSearch(label: string, normalizedQuery: string): boolean {
  return label.toLowerCase().includes(normalizedQuery);
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9ก-๙ぁ-んァ-ン一-龯]+/gi, '-');
}

function compareGroups(a: ImportDestinationGroupOption, b: ImportDestinationGroupOption) {
  if (a.source !== b.source) return a.source === 'user' ? -1 : 1;
  const ai = GROUP_ORDER.indexOf(a.label);
  const bi = GROUP_ORDER.indexOf(b.label);
  if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
  return a.label.localeCompare(b.label, 'en');
}

function compareSections(a: ImportDestinationSectionOption, b: ImportDestinationSectionOption) {
  const ai = SECTION_ORDER.indexOf(a.label);
  const bi = SECTION_ORDER.indexOf(b.label);
  if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
  return a.label.localeCompare(b.label, 'en');
}
