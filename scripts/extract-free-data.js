/**
 * Extract Model C-refined free tier from CSV packs → 4 JSON files.
 *
 * Free tier per [[n5-hybrid-pricing-model]]:
 *   • Glossary (all 3 packs)
 *   • Grammar N5 (all 7 packs)
 *   • Kanji N5 (all 4 packs)
 *   • Vocab N5 Vol.1 (first 17 of 34 packs ≈ 50%)
 *
 * Output: src/data/{glossary,vocab-n5-vol1,grammar-n5,kanji-n5}.json
 *         + src/data/free-tier.ts (loads + exports decks)
 *
 * Run: node scripts/extract-free-data.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CONTENT = path.resolve(__dirname, '../../content/_csv-output');
const OUT = path.resolve(__dirname, '../src/data');

function loadPacks(globPath) {
  const dir = path.dirname(globPath);
  const pattern = path.basename(globPath);
  const re = new RegExp('^' + pattern.replace('*', '.*') + '$');
  return fs
    .readdirSync(dir)
    .filter((f) => re.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  return parse(text, {
    columns: true,           // first row is header
    skip_empty_lines: true,
    relax_column_count: true,
  });
}

function combinePacks(files, limit = Infinity) {
  const all = [];
  for (let i = 0; i < Math.min(files.length, limit); i++) {
    const rows = readCsv(files[i]);
    for (const r of rows) {
      all.push({
        no: parseInt(r.NO, 10),
        t: r.T,
        d: r.D,
        p: r.P,
        e: r.E,
      });
    }
  }
  return all;
}

function writeJson(name, data) {
  const file = path.join(OUT, `${name}.json`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

console.log('Extracting Model C-refined free tier...\n');

/* Glossary — all 3 packs */
const glossaryFiles = loadPacks(path.join(CONTENT, 'glossary/glossary-pack*.csv'));
const glossary = combinePacks(glossaryFiles);
writeJson('glossary', glossary);
console.log(`  glossary           → ${glossary.length} entries (${glossaryFiles.length} packs)`);

/* Vocab N5 Vol.1 — first 17 of 34 packs */
const vocabFiles = loadPacks(path.join(CONTENT, 'vocab/n5/vocab-n5-pack*.csv'));
const vocabN5Vol1 = combinePacks(vocabFiles, 17);
writeJson('vocab-n5-vol1', vocabN5Vol1);
console.log(`  vocab-n5-vol1      → ${vocabN5Vol1.length} entries (17 of ${vocabFiles.length} packs)`);

/* Grammar N5 — all 7 packs */
const grammarFiles = loadPacks(path.join(CONTENT, 'grammar/n5/grammar-n5-pack*.csv'));
const grammarN5 = combinePacks(grammarFiles);
writeJson('grammar-n5', grammarN5);
console.log(`  grammar-n5         → ${grammarN5.length} entries (${grammarFiles.length} packs)`);

/* Kanji N5 — all 4 packs */
const kanjiFiles = loadPacks(path.join(CONTENT, 'kanji/n5/kanji-n5-pack*.csv'));
const kanjiN5 = combinePacks(kanjiFiles);
writeJson('kanji-n5', kanjiN5);
console.log(`  kanji-n5           → ${kanjiN5.length} entries (${kanjiFiles.length} packs)`);

const total = glossary.length + vocabN5Vol1.length + grammarN5.length + kanjiN5.length;
console.log(`\nTOTAL free tier: ${total} entries`);
console.log(`Target (per memory): ~1,569 entries (Model C-refined ~13%)\n`);
console.log('JSON files written to:', OUT);
