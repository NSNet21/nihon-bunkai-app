import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const target = process.env.APP_URL || process.argv[2] || 'http://localhost:8097';
const importedTerm = '輸入テスト';
const importedDeckTitle = 'Vocab N5 · Pack 99';

function urlFor(route) {
  return new URL(route, target).toString();
}

async function clickText(page, text, timeout = 15_000) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ timeout });
  await locator.click();
}

async function clickLastText(page, text, timeout = 15_000) {
  const locator = page.getByText(text, { exact: false }).last();
  await locator.waitFor({ timeout });
  await locator.click();
}

async function openLibraryActions(page) {
  const libraryMatches = await page.getByText('Library', { exact: false }).count();
  await page.keyboard.press('Home').catch(() => null);
  await page.mouse.wheel(0, -5000).catch(() => null);
  let clickError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const action = page.getByLabel('เปิด Import / Export').first();
    try {
      await action.waitFor({ state: 'visible', timeout: 15_000 });
      await action.click({ timeout: 10_000 });
      await page.waitForTimeout(250);
      if (!(await page.getByText('Library actions', { exact: false }).first().isVisible().catch(() => false))) {
        const box = await action.boundingBox();
        if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
      clickError = null;
      break;
    } catch (error) {
      clickError = error;
      await page.waitForTimeout(500);
      await page.keyboard.press('Home').catch(() => null);
      await page.mouse.wheel(0, -5000).catch(() => null);
    }
  }
  if (clickError) {
    const candidates = await describeCandidates(page.getByLabel('เปิด Import / Export'));
    throw new Error(`Library action is not clickable. Matches: ${libraryMatches}. Candidates:\n${candidates}`, { cause: clickError });
  }
  try {
    await page.getByText('Library actions', { exact: false }).waitFor({ state: 'visible', timeout: 10_000 });
  } catch (error) {
    const body = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
    throw new Error(
      `Library modal did not open. Library text matches before click: ${libraryMatches}. Console errors: ${errors.slice(0, 5).join(' | ') || 'none'}. Warnings: ${warnings.slice(0, 5).join(' | ') || 'none'}. Body after click:\n${body.slice(0, 2000)}`,
      { cause: error },
    );
  }
}

async function clickFirstVisible(locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      return true;
    }
  }
  return false;
}

async function describeCandidates(locator) {
  const count = await locator.count();
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    rows.push({
      index,
      visible: await item.isVisible().catch(() => false),
      box: await item.boundingBox().catch(() => null),
      text: await item.innerText().catch(() => ''),
    });
  }
  return JSON.stringify(rows, null, 2);
}

async function ensureBrowseDeckVisible(page, title) {
  const deck = page.getByText(title, { exact: false }).first();
  if (await deck.isVisible().catch(() => false)) return;
  await clickFirstVisible(page.getByLabel('Expand all'));
  try {
    await deck.waitFor({ timeout: 15_000 });
  } catch (error) {
    const body = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
    const importedIds = await readLibraryDecks(page);
    throw new Error(
      `Imported deck title was not visible: ${title}. IndexedDB paidDecks: ${JSON.stringify(importedIds)}. Body:\n${body.slice(0, 2000)}`,
      { cause: error },
    );
  }
}

async function waitForTextOrDump(page, text, label, timeout = 15_000) {
  const locator = page.getByText(text, { exact: false }).first();
  try {
    await locator.waitFor({ timeout });
  } catch (error) {
    const body = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
    const decks = await readLibraryDecks(page);
    throw new Error(
      `${label} did not show text: ${text}. URL: ${page.url()}. IndexedDB paidDecks: ${JSON.stringify(decks)}. Body:\n${body.slice(0, 2000)}`,
      { cause: error },
    );
  }
}

async function waitForDownloadOrDump(page, downloadPromise, label) {
  try {
    return await downloadPromise;
  } catch (error) {
    const body = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
    throw new Error(
      `${label} download did not start. Console errors: ${errors.slice(0, 8).join(' | ') || 'none'}. Body:\n${body.slice(0, 2000)}`,
      { cause: error },
    );
  }
}

async function readLibraryDecks(page) {
  return await page.evaluate(async () => {
    const req = indexedDB.open('nihon-bunkai-downloads');
    const db = await new Promise((resolve, reject) => {
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
    const tx = db.transaction(['paidDecks'], 'readonly');
    const store = tx.objectStore('paidDecks');
    const allReq = store.getAll();
    return await new Promise((resolve, reject) => {
      allReq.onerror = () => reject(allReq.error);
      allReq.onsuccess = () => resolve(allReq.result.map((deck) => ({ id: deck.id, title: deck.title, source: deck.source })));
    });
  }).catch((dbError) => [{ error: String(dbError) }]);
}

const tmp = await mkdtemp(path.join(tmpdir(), 'nihon-bunkai-import-export-'));
const csvPath = path.join(tmp, 'vocab-n5-pack99.csv');
await writeFile(
  csvPath,
  'T,D,P,E\n輸入テスト,ทดสอบนำเข้า,ゆにゅうてすと,### Import smoke\n',
  'utf8',
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1366, height: 820 },
});
const page = await context.newPage();

const warnings = [];
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'warning') warnings.push(message.text());
  if (message.type() === 'error') errors.push(message.text());
});
page.on('dialog', (dialog) => dialog.accept());

await page.addInitScript(() => {
  localStorage.setItem('nb.onboarded', 'true');
});

try {
  await page.goto(urlFor('/'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null);

  await openLibraryActions(page);
  const chooserPromise = page.waitForEvent('filechooser');
  await clickText(page, 'Import one file');
  const chooser = await chooserPromise;
  await chooser.setFiles(csvPath);
  await page.getByText('import 1 decks', { exact: false }).first().waitFor({ timeout: 15_000 });
  await page.mouse.click(12, 12);
  await ensureBrowseDeckVisible(page, importedDeckTitle);

  await page.goto(urlFor('/search'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByPlaceholder('คำญี่ปุ่น · ความหมายไทย · เสียงอ่าน').fill(importedTerm);
  await page.getByText(importedTerm, { exact: false }).waitFor({ timeout: 20_000 });

  await page.goto(urlFor('/deck/vocab-n5-pack99'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await waitForTextOrDump(page, 'PACK 99', 'Deck hub');
  await waitForTextOrDump(page, importedTerm, 'Deck hub sample');

  await page.goto(urlFor('/deck/vocab-n5-pack99/memorize'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByText(importedTerm, { exact: false }).waitFor({ timeout: 15_000 });

  await page.goto(urlFor('/deck/vocab-n5-pack99/quiz'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByText(importedTerm, { exact: false }).waitFor({ timeout: 15_000 });

  await page.goto(urlFor('/'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await openLibraryActions(page);
  await clickText(page, 'Export one deck');
  await page.getByText('เลือก deck ที่จะ export', { exact: false }).waitFor({ timeout: 15_000 });
  const csvDownloadPromise = page.waitForEvent('download');
  await clickLastText(page, importedDeckTitle);
  const csvDownload = await waitForDownloadOrDump(page, csvDownloadPromise, 'CSV export');
  const csvFileName = csvDownload.suggestedFilename();
  if (!csvFileName.endsWith('.csv')) throw new Error(`Expected CSV download, got ${csvFileName}`);

  await page.mouse.click(12, 12);
  await openLibraryActions(page);
  await clickText(page, 'Batch export');
  await page.getByText('Batch export', { exact: false }).last().waitFor({ timeout: 15_000 });
  await clickLastText(page, importedDeckTitle);
  const zipDownloadPromise = page.waitForEvent('download');
  await clickText(page, 'Export ZIP');
  const zipDownload = await waitForDownloadOrDump(page, zipDownloadPromise, 'ZIP export');
  const zipFileName = zipDownload.suggestedFilename();
  if (!zipFileName.endsWith('.zip')) throw new Error(`Expected ZIP download, got ${zipFileName}`);

  const result = {
    target,
    importedDeckTitle,
    csvFileName,
    zipFileName,
    warningCount: warnings.length,
    errorCount: errors.length,
    warnings: warnings.slice(0, 8),
    errors: errors.slice(0, 8),
  };
  if (errors.length > 0) throw new Error(`Console errors found: ${errors.slice(0, 3).join(' | ')}`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
