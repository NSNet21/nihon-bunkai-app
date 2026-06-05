import type { Deck } from '../../data/types';
import { getDeckOrganization } from '../user-content';

export type ImportDestinationSectionOption = {
  key: string;
  label: string;
};

export type ImportDestinationGroupOption = {
  key: string;
  label: string;
  sections: ImportDestinationSectionOption[];
};

export type ImportDestinationValue = {
  group: string;
  section: string;
};

export const DEFAULT_IMPORT_GROUP = 'Manual imports';
export const DEFAULT_IMPORT_SECTION = 'Inbox';

const USER_EDITABLE_SOURCES = new Set(['manual', 'custom']);

export function buildImportDestinationOptions(decks: readonly Deck[]): ImportDestinationGroupOption[] {
  const groups = new Map<string, ImportDestinationGroupOption>();

  for (const deck of decks) {
    if (!deck.source || !USER_EDITABLE_SOURCES.has(deck.source)) continue;
    const organization = getDeckOrganization(deck);
    const groupLabel = clean(organization.group);
    if (!groupLabel) continue;
    const sectionLabel = clean(organization.section) ?? DEFAULT_IMPORT_SECTION;
    const groupKey = slug(groupLabel);
    const sectionKey = `${groupKey}:${slug(sectionLabel)}`;

    let group = groups.get(groupKey);
    if (!group) {
      group = { key: groupKey, label: groupLabel, sections: [] };
      groups.set(groupKey, group);
    }
    if (!group.sections.some((section) => section.key === sectionKey)) {
      group.sections.push({ key: sectionKey, label: sectionLabel });
    }
  }

  if (groups.size === 0) {
    return [{
      key: slug(DEFAULT_IMPORT_GROUP),
      label: DEFAULT_IMPORT_GROUP,
      sections: [{ key: `${slug(DEFAULT_IMPORT_GROUP)}:${slug(DEFAULT_IMPORT_SECTION)}`, label: DEFAULT_IMPORT_SECTION }],
    }];
  }

  return [...groups.values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'en'))
    .map((group) => ({
      ...group,
      sections: [...group.sections].sort((a, b) => a.label.localeCompare(b.label, 'en')),
    }));
}

export function normalizeImportDestination(value: Partial<ImportDestinationValue>): ImportDestinationValue {
  const group = clean(value.group) ?? DEFAULT_IMPORT_GROUP;
  const section = clean(value.section) ?? DEFAULT_IMPORT_SECTION;
  return { group, section };
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9ก-๙ぁ-んァ-ン一-龯]+/gi, '-');
}
