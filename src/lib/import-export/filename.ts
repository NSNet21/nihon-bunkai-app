import type { ContentType, JlptLevel } from '@/data/types';

const CSV_NAME_RE = /^(?:.*\/)?(vocab|grammar|kanji)-(n[1-5])-(?:pack|vol)(\d+)\.csv$/i;
const GLOSSARY_RE = /^(?:.*\/)?glossary-(?:pack|vol)(\d+)\.csv$/i;

export type LibraryCsvMeta = {
  pack: string;
  type: ContentType;
  level: JlptLevel | null;
  title: string;
  tags: string[];
};

const TYPE_LABELS: Record<ContentType, string> = {
  vocab: 'Vocab',
  grammar: 'Grammar',
  kanji: 'Kanji',
  glossary: 'Glossary',
};

export function parseLibraryCsvFilename(name: string): LibraryCsvMeta | null {
  const clean = name.replace(/\\/g, '/').replace(/^\.\//, '');
  const glossary = clean.match(GLOSSARY_RE);
  if (glossary) {
    const packNum = glossary[1].padStart(2, '0');
    const pack = `glossary-pack${packNum}`;
    return {
      pack,
      type: 'glossary',
      level: null,
      title: `${TYPE_LABELS.glossary} GLOSSARY · Pack ${packNum}`,
      tags: ['glossary', pack],
    };
  }

  const m = clean.match(CSV_NAME_RE);
  if (!m) return null;

  const type = m[1].toLowerCase() as ContentType;
  const level = m[2].toUpperCase() as JlptLevel;
  const packNum = m[3].padStart(2, '0');
  const pack = `${type}-${level.toLowerCase()}-pack${packNum}`;
  return {
    pack,
    type,
    level,
    title: `${TYPE_LABELS[type]} ${level} · Pack ${packNum}`,
    tags: [type, level.toLowerCase(), pack],
  };
}

export function buildManualCsvFallbackMeta(name: string): LibraryCsvMeta {
  const clean = name.replace(/\\/g, '/').replace(/^\.\//, '');
  const baseName = clean.split('/').pop() ?? 'manual-deck.csv';
  const withoutExt = baseName.replace(/\.csv$/i, '').trim() || 'manual-deck';
  const slugBase = slugFileName(withoutExt);
  const pack = slugBase === 'deck'
    ? `manual-deck-${hashString(withoutExt)}`
    : `manual-${slugBase}`;

  return {
    pack,
    type: 'vocab',
    level: null,
    title: titleFromFileName(withoutExt),
    tags: ['manual', 'group:Manual imports', pack],
  };
}

function slugFileName(value: string) {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'deck';
}

function titleFromFileName(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Manual deck';
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).padStart(6, '0');
}
