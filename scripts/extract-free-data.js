/**
 * Extract Model C-refined free tier — 1 deck per CSV pack (31 decks total).
 *
 * Free tier:
 *   • Glossary packs 01..03
 *   • Vocab N5 Vol.1 = packs 01..17 of 34
 *   • Grammar N5 packs 01..07
 *   • Kanji N5 packs 01..04
 *
 * Output: src/data/free-tier.json  (single file: { decks, entries })
 *
 * Run: node scripts/extract-free-data.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CONTENT = path.resolve(__dirname, '../../content/_csv-output');
const OUT = path.resolve(__dirname, '../src/data/free-tier.json');

function loadPacks(dir, prefix) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.csv'))
    .sort()
    .map((f) => path.join(dir, f));
}

function readCsv(file) {
  return parse(fs.readFileSync(file, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
}

/** Build a deck-per-pack { meta, rows }. */
function buildDeck(file, type, level, packIndex) {
  const rows = readCsv(file).map((r) => ({
    no: parseInt(r.NO, 10),
    t: r.T,
    d: r.D,
    p: r.P,
    e: r.E,
  }));
  const basename = path.basename(file, '.csv'); // e.g. "vocab-n5-pack03"
  const padNum = String(packIndex).padStart(2, '0');
  const title =
    type === 'glossary'
      ? `Glossary · Pack ${padNum}`
      : `${cap(type)} ${level} · Pack ${padNum}`;
  return {
    meta: {
      id: basename,
      type,
      level: level || null,
      title,
      entryCount: rows.length,
      pack: basename,
      tags: [type, level ? level.toLowerCase() : 'glossary', basename],
    },
    rows,
  };
}

function cap(s) {
  return s[0].toUpperCase() + s.slice(1);
}

function processCategory(packs, type, level, limit = Infinity) {
  const slice = packs.slice(0, limit);
  return slice.map((p, i) => buildDeck(p, type, level, i + 1));
}

console.log('Extracting Model C-refined free tier (per-pack split)...\n');

const glossary = processCategory(loadPacks(path.join(CONTENT, 'glossary'), 'glossary-pack'),  'glossary', null);
const vocabN5  = processCategory(loadPacks(path.join(CONTENT, 'vocab/n5'),  'vocab-n5-pack'), 'vocab',   'N5', 17);
const grammarN5 = processCategory(loadPacks(path.join(CONTENT, 'grammar/n5'), 'grammar-n5-pack'), 'grammar', 'N5');
const kanjiN5  = processCategory(loadPacks(path.join(CONTENT, 'kanji/n5'),  'kanji-n5-pack'),  'kanji',   'N5');

const allDecks = [...kanjiN5, ...grammarN5, ...vocabN5, ...glossary];

const out = {
  decks: allDecks.map((d) => d.meta),
  entries: Object.fromEntries(allDecks.map((d) => [d.meta.id, d.rows])),
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

const totalEntries = allDecks.reduce((s, d) => s + d.rows.length, 0);
console.log(`  ${allDecks.length} decks · ${totalEntries} entries`);
console.log(`  Glossary: ${glossary.length} packs · ${glossary.reduce((s, d) => s + d.rows.length, 0)} entries`);
console.log(`  Vocab N5: ${vocabN5.length} packs · ${vocabN5.reduce((s, d) => s + d.rows.length, 0)} entries`);
console.log(`  Grammar N5: ${grammarN5.length} packs · ${grammarN5.reduce((s, d) => s + d.rows.length, 0)} entries`);
console.log(`  Kanji N5: ${kanjiN5.length} packs · ${kanjiN5.reduce((s, d) => s + d.rows.length, 0)} entries\n`);
console.log(`Wrote: ${OUT}`);
