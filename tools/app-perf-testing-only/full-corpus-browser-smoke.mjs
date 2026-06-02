import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'csv-parse/sync';
import { chromium } from 'playwright';

const target = process.argv[2] || 'https://app.nihon-bunkai.com';
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..', '..');
const workspaceRoot = path.resolve(appRoot, '..');
const csvRoot = process.env.NB_CSV_ROOT
  ? path.resolve(process.env.NB_CSV_ROOT)
  : path.join(workspaceRoot, 'content', '_csv-output');
const freeMetaPath = path.join(appRoot, 'src', 'data', 'free-tier-meta.json');

const TYPE_LABELS = {
  vocab: 'Vocab',
  grammar: 'Grammar',
  kanji: 'Kanji',
  glossary: 'Glossary',
};

function now() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

async function walkCsvFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkCsvFiles(full));
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) files.push(full);
  }
  return files;
}

function parsePackMeta(filePath) {
  const base = path.basename(filePath).toLowerCase();
  let match = base.match(/^(vocab|grammar|kanji)-(n[1-5])-(?:pack|vol)(\d+)\.csv$/);
  if (match) {
    const [, type, levelToken, rawNum] = match;
    const packNum = rawNum.padStart(2, '0');
    const level = levelToken.toUpperCase();
    const pack = `${type}-${levelToken}-pack${packNum}`;
    return {
      pack,
      type,
      level,
      title: `${TYPE_LABELS[type]} ${level} · Pack ${packNum}`,
      tags: [type, levelToken, pack],
    };
  }

  match = base.match(/^glossary-(?:pack|vol)(\d+)\.csv$/);
  if (match) {
    const packNum = match[1].padStart(2, '0');
    const pack = `glossary-pack${packNum}`;
    return {
      pack,
      type: 'glossary',
      level: null,
      title: `${TYPE_LABELS.glossary} GLOSSARY · Pack ${packNum}`,
      tags: ['glossary', 'glossary', pack],
    };
  }

  return null;
}

function normalizeRows(records) {
  const rows = [];
  for (const row of records) {
    const no = Number.parseInt(String(row.NO ?? row.no ?? ''), 10);
    if (!Number.isFinite(no)) continue;
    rows.push({
      no,
      t: String(row.T ?? row.t ?? '').trim(),
      d: String(row.D ?? row.d ?? '').trim(),
      p: String(row.P ?? row.p ?? '').trim(),
      e: String(row.E ?? row.e ?? '').trim(),
    });
  }
  return rows;
}

async function loadCorpus() {
  const freeMeta = JSON.parse(await readFile(freeMetaPath, 'utf8'));
  const freePackIds = new Set((freeMeta.decks || []).map((deck) => deck.id));
  const files = await walkCsvFiles(csvRoot);

  const paidDecks = [];
  const paidEntries = [];
  let skippedFreePacks = 0;
  let skippedUnknown = 0;

  for (const file of files) {
    const meta = parsePackMeta(file);
    if (!meta) {
      skippedUnknown += 1;
      continue;
    }
    if (freePackIds.has(meta.pack)) {
      skippedFreePacks += 1;
      continue;
    }

    const text = await readFile(file, 'utf8');
    const records = parse(text, { columns: true, skip_empty_lines: true });
    const rows = normalizeRows(records);
    if (rows.length === 0) continue;

    paidDecks.push({
      id: meta.pack,
      type: meta.type,
      level: meta.level,
      title: meta.title,
      entryCount: rows.length,
      isFree: false,
      pack: meta.pack,
      tags: meta.tags,
      skuId: 'smoke-full-corpus',
      importedAt: Date.now(),
    });
    paidEntries.push({
      pack: meta.pack,
      skuId: 'smoke-full-corpus',
      rows,
    });
  }

  paidDecks.sort((a, b) => a.id.localeCompare(b.id));
  paidEntries.sort((a, b) => a.pack.localeCompare(b.pack));

  return {
    paidDecks,
    paidEntries,
    stats: {
      csvRoot,
      totalCsvFiles: files.length,
      seededPaidPacks: paidDecks.length,
      seededPaidEntries: paidEntries.reduce((sum, item) => sum + item.rows.length, 0),
      skippedFreePacks,
      skippedUnknown,
    },
  };
}

async function seedBrowserCorpus(page, corpus) {
  await page.evaluate(async ({ paidDecks, paidEntries }) => {
    function openDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('nihon-bunkai-downloads');
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('zips')) {
            const zips = db.createObjectStore('zips', { keyPath: 'name' });
            zips.createIndex('skuId', 'skuId');
            zips.createIndex('downloadedAt', 'downloadedAt');
          }
          if (!db.objectStoreNames.contains('paidDecks')) {
            const paidDecksStore = db.createObjectStore('paidDecks', { keyPath: 'id' });
            paidDecksStore.createIndex('skuId', 'skuId');
            paidDecksStore.createIndex('level', 'level');
            paidDecksStore.createIndex('type', 'type');
          }
          if (!db.objectStoreNames.contains('paidEntries')) {
            const paidEntriesStore = db.createObjectStore('paidEntries', { keyPath: 'pack' });
            paidEntriesStore.createIndex('skuId', 'skuId');
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    function requestDone(req) {
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    function transactionDone(tx) {
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }

    async function clearStore(db, name) {
      const tx = db.transaction(name, 'readwrite');
      tx.objectStore(name).clear();
      await transactionDone(tx);
    }

    async function putAll(db, name, records) {
      const tx = db.transaction(name, 'readwrite');
      const store = tx.objectStore(name);
      for (const record of records) store.put(record);
      await transactionDone(tx);
    }

    const db = await openDB();
    await clearStore(db, 'paidDecks');
    await clearStore(db, 'paidEntries');
    await putAll(db, 'paidDecks', paidDecks);

    const chunkSize = 20;
    for (let i = 0; i < paidEntries.length; i += chunkSize) {
      await putAll(db, 'paidEntries', paidEntries.slice(i, i + chunkSize));
    }

    const deckCount = await requestDone(db.transaction('paidDecks').objectStore('paidDecks').count());
    const entryPackCount = await requestDone(db.transaction('paidEntries').objectStore('paidEntries').count());
    db.close();
    localStorage.setItem('nb.onboarded', 'true');
    localStorage.setItem('nb.fullCorpusSmokeSeededAt', String(Date.now()));
    return { deckCount, entryPackCount };
  }, corpus);
}

async function getBodyText(page) {
  return page.locator('body').innerText({ timeout: 20_000 });
}

async function measureRoute(page, route) {
  const started = now();
  await page.goto(new URL(route, target).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const domcontentloadedMs = now() - started;
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null);
  const settledMs = now() - started;
  const bodyText = await getBodyText(page);

  return {
    route,
    domcontentloadedMs,
    settledMs,
    bodyTextLength: bodyText.length,
    hasFullCorpusCount: /1[01],[0-9]{3}|11815|11,815/.test(bodyText),
    textSample: bodyText.slice(0, 600),
  };
}

async function measureSearch(page) {
  const started = now();
  await page.goto(new URL('/search', target).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('input[placeholder*="คำญี่ปุ่น"]', { timeout: 30_000 });
  const inputReadyMs = now() - started;

  const indexStarted = now();
  await page.waitForFunction(() => document.body.innerText.includes('11,815') || document.body.innerText.includes('11815'), {
    timeout: 45_000,
  }).catch(() => null);
  const indexReadyMs = now() - indexStarted;

  const typeStarted = now();
  await page.click('input[placeholder*="คำญี่ปุ่น"]');
  await page.keyboard.type('去年');
  await page.waitForFunction(() => document.body.innerText.includes('きょねん') || document.body.innerText.includes('ปีที่แล้ว'), {
    timeout: 30_000,
  }).catch(() => null);
  const bodyText = await getBodyText(page);

  return {
    route: '/search',
    inputReadyMs,
    indexReadyMs,
    queryFeedbackMs: now() - typeStarted,
    hasPaidResult: bodyText.includes('きょねん') || bodyText.includes('ปีที่แล้ว') || bodyText.includes('去年'),
    bodyTextLength: bodyText.length,
    textSample: bodyText.slice(0, 600),
  };
}

async function measureDeckFlow(page, deckId) {
  const results = [];
  for (const route of [`/deck/${deckId}`, `/deck/${deckId}/memorize`, `/deck/${deckId}/quiz`]) {
    const started = now();
    await page.goto(new URL(route, target).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const domcontentloadedMs = now() - started;
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null);
    const settledMs = now() - started;
    const bodyText = await getBodyText(page);
    results.push({
      route,
      domcontentloadedMs,
      settledMs,
      bodyTextLength: bodyText.length,
      hasDeckContent: bodyText.includes('Vocab') || bodyText.includes('CARD') || bodyText.includes('ลืม'),
      textSample: bodyText.slice(0, 500),
    });
  }
  return results;
}

const corpus = await loadCorpus();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

const warnings = [];
const errors = [];
page.on('console', (message) => {
  const text = message.text();
  if (message.type() === 'warning') warnings.push(text);
  if (message.type() === 'error') errors.push(text);
});

await page.addInitScript(() => {
  localStorage.setItem('nb.onboarded', 'true');
});

await page.goto(new URL('/', target).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
await seedBrowserCorpus(page, corpus);

const routeResults = [];
for (const route of ['/', '/search', '/shop', '/settings']) {
  routeResults.push(await measureRoute(page, route));
}

const searchResult = await measureSearch(page);
const deckId = corpus.paidDecks.find((deck) => deck.id === 'vocab-n1-pack01')?.id
  ?? corpus.paidDecks.find((deck) => deck.type === 'vocab')?.id
  ?? corpus.paidDecks[0]?.id;
const deckFlowResults = deckId ? await measureDeckFlow(page, deckId) : [];

await browser.close();

console.log(JSON.stringify({
  target,
  measuredAt: new Date().toISOString(),
  seedStats: corpus.stats,
  deckId,
  routeResults,
  searchResult,
  deckFlowResults,
  warningCount: warnings.length,
  errorCount: errors.length,
  warnings: [...new Set(warnings)].slice(0, 8),
  errors: [...new Set(errors)].slice(0, 8),
}, null, 2));
