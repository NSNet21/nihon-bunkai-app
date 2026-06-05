import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const target = process.env.APP_URL || process.argv[2] || 'http://localhost:8097';
const importedTerm = '輸入テスト';
const secondImportedTerm = '削除テスト';
const editedTerm = '編集済みテスト';
const importedDeckId = 'manual-self-imported-file';
const importedDeckTitle = 'self imported file';
const renamedDeckTitle = 'Manual Smoke Deck';
const movedGroup = 'Manual Smoke Group';
const movedSection = 'Regression';

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

async function openDeckActions(page) {
  const action = page.getByLabel('เปิด Deck Actions').first();
  await action.waitFor({ state: 'visible', timeout: 15_000 });
  await action.click();
  await page.getByText('DECK ACTIONS', { exact: false }).first().waitFor({ timeout: 10_000 });
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
    const tx = db.transaction(['paidDecks', 'paidEntries'], 'readonly');
    const deckReq = tx.objectStore('paidDecks').getAll();
    const entriesReq = tx.objectStore('paidEntries').getAll();
    const decks = await new Promise((resolve, reject) => {
      deckReq.onerror = () => reject(deckReq.error);
      deckReq.onsuccess = () => resolve(deckReq.result.map((deck) => ({
        id: deck.id,
        pack: deck.pack,
        title: deck.title,
        source: deck.source,
        userGroup: deck.userGroup,
        userSection: deck.userSection,
      })));
    });
    const entries = await new Promise((resolve, reject) => {
      entriesReq.onerror = () => reject(entriesReq.error);
      entriesReq.onsuccess = () => resolve(entriesReq.result.map((entry) => ({
        pack: entry.pack,
        source: entry.source,
        rows: entry.rows?.length ?? 0,
        first: entry.rows?.[0]?.t,
        terms: entry.rows?.map((row) => row.t) ?? [],
      })));
    });
    return { decks, entries };
  }).catch((dbError) => [{ error: String(dbError) }]);
}

async function expectLibraryTerms(page, deckId, expectedTerms) {
  const library = await readLibraryDecks(page);
  const entry = library.entries?.find((item) => item.pack === deckId);
  if (!entry) throw new Error(`Expected entry pack ${deckId}, got ${JSON.stringify(library)}`);
  if (JSON.stringify(entry.terms) !== JSON.stringify(expectedTerms)) {
    throw new Error(`Expected terms ${JSON.stringify(expectedTerms)}, got ${JSON.stringify(entry.terms)}. Library: ${JSON.stringify(library)}`);
  }
}

async function expectLibraryDeck(page, deckId, expected) {
  const library = await readLibraryDecks(page);
  const deck = library.decks?.find((item) => item.id === deckId);
  if (!deck) throw new Error(`Expected library deck ${deckId}, got ${JSON.stringify(library)}`);
  for (const [field, value] of Object.entries(expected)) {
    if (deck[field] !== value) {
      throw new Error(`Expected ${deckId}.${field} to be ${value}, got ${deck[field]}. Library: ${JSON.stringify(library)}`);
    }
  }
}

async function expectLibraryDeckDeleted(page, deckId) {
  const library = await readLibraryDecks(page);
  const deck = library.decks?.find((item) => item.id === deckId);
  const entry = library.entries?.find((item) => item.pack === deckId);
  if (deck || entry) {
    throw new Error(`Expected deleted deck ${deckId} to be gone. Library: ${JSON.stringify(library)}`);
  }
}

const tmp = await mkdtemp(path.join(tmpdir(), 'nihon-bunkai-import-export-'));
const csvPath = path.join(tmp, 'self-imported-file.csv');
await writeFile(
  csvPath,
  'T,D,P,E\n輸入テスト,ทดสอบนำเข้า,ゆにゅうてすと,### Import smoke\n削除テスト,ทดสอบลบ,さくじょてすと,### Delete smoke\n',
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
  await page.waitForSelector('input[placeholder*="คำญี่ปุ่น"]', { timeout: 20_000 });
  await page.waitForFunction(() => !document.body.innerText.includes('กำลังสร้าง index'), null, { timeout: 30_000 });
  await page.click('input[placeholder*="คำญี่ปุ่น"]');
  await page.keyboard.type(importedTerm);
  await waitForTextOrDump(page, importedTerm, 'Search imported self-made file result', 20_000);

  await page.goto(urlFor(`/deck/${importedDeckId}`), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await waitForTextOrDump(page, importedDeckTitle, 'Deck hub title');
  await waitForTextOrDump(page, importedTerm, 'Deck hub sample');
  await waitForTextOrDump(page, secondImportedTerm, 'Deck hub second imported term');
  await openDeckActions(page);
  await page.getByText('User Content · แก้ metadata ได้', { exact: false }).first().waitFor({ timeout: 10_000 });
  await page.getByPlaceholder('ชื่อ deck').fill(renamedDeckTitle);
  await page.getByPlaceholder('เช่น Manual imports').fill(movedGroup);
  await page.getByPlaceholder('เช่น N2 / Week 1').fill(movedSection);
  await page.getByLabel('บันทึก deck').click();
  await page.getByText(renamedDeckTitle, { exact: false }).first().waitFor({ timeout: 15_000 });
  await expectLibraryDeck(page, importedDeckId, {
    title: renamedDeckTitle,
    source: 'manual',
    userGroup: movedGroup,
    userSection: movedSection,
  });

  await page.goto(urlFor(`/deck/${importedDeckId}/term/${importedDeckId}-1`), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByLabel('เปิดเมนูคำนี้').click({ timeout: 10_000 });
  await page.getByLabel('แก้ไขคำนี้').click({ timeout: 10_000 });
  await page.getByText('TERM EDIT', { exact: false }).first().waitFor({ timeout: 10_000 });
  await page.getByPlaceholder('คำศัพท์ / term').fill(editedTerm);
  await page.getByPlaceholder('ความหมาย').fill('แก้ไขผ่าน smoke');
  await page.getByPlaceholder('คำอ่าน').fill('へんしゅうずみてすと');
  await page.getByPlaceholder('รายละเอียด / markdown').fill('### Edited through smoke');
  await page.getByLabel('บันทึกคำ').click({ timeout: 10_000 });
  await waitForTextOrDump(page, editedTerm, 'Edited term card');
  await expectLibraryTerms(page, importedDeckId, [editedTerm, secondImportedTerm]);

  await page.goto(urlFor(`/deck/${importedDeckId}/term/${importedDeckId}-2`), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByLabel('เปิดเมนูคำนี้').click({ timeout: 10_000 });
  await page.getByLabel('แก้ไขคำนี้').click({ timeout: 10_000 });
  await page.getByText('TERM EDIT', { exact: false }).first().waitFor({ timeout: 10_000 });
  await page.getByLabel('ลบคำนี้').click({ timeout: 10_000 });
  await page.getByText('กดลบอีกครั้งเพื่อยืนยัน', { exact: false }).waitFor({ timeout: 10_000 });
  await page.getByLabel('ลบคำนี้').click({ timeout: 10_000 });
  await waitForTextOrDump(page, editedTerm, 'Term card after deleting another term');
  await expectLibraryTerms(page, importedDeckId, [editedTerm]);

  await page.goto(urlFor('/search'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForSelector('input[placeholder*="คำญี่ปุ่น"]', { timeout: 20_000 });
  await page.waitForFunction(() => !document.body.innerText.includes('กำลังสร้าง index'), null, { timeout: 30_000 });
  await page.click('input[placeholder*="คำญี่ปุ่น"]');
  await page.keyboard.type(editedTerm);
  await waitForTextOrDump(page, editedTerm, 'Search edited self-made term result', 20_000);

  await page.goto(urlFor(`/deck/${importedDeckId}/memorize`), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByText(editedTerm, { exact: false }).waitFor({ timeout: 15_000 });

  await page.goto(urlFor(`/deck/${importedDeckId}/quiz`), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByText(editedTerm, { exact: false }).waitFor({ timeout: 15_000 });

  await page.goto(urlFor('/'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await ensureBrowseDeckVisible(page, renamedDeckTitle);
  await openLibraryActions(page);
  await clickText(page, 'Export one deck');
  await page.getByText('เลือก deck ที่จะ export', { exact: false }).waitFor({ timeout: 15_000 });
  await waitForTextOrDump(page, 'Groups only', 'Single export hierarchy controls');
  const csvDownloadPromise = page.waitForEvent('download');
  await clickLastText(page, renamedDeckTitle);
  const csvDownload = await waitForDownloadOrDump(page, csvDownloadPromise, 'CSV export');
  const csvFileName = csvDownload.suggestedFilename();
  if (!csvFileName.endsWith('.csv')) throw new Error(`Expected CSV download, got ${csvFileName}`);

  await page.mouse.click(12, 12);
  await openLibraryActions(page);
  await clickText(page, 'Batch export');
  await page.getByText('Batch export', { exact: false }).last().waitFor({ timeout: 15_000 });
  await waitForTextOrDump(page, 'Groups only', 'Batch export hierarchy controls');
  await clickLastText(page, renamedDeckTitle);
  await waitForTextOrDump(page, 'Batch export · 1/', 'Batch export partial selection');
  const zipDownloadPromise = page.waitForEvent('download');
  await clickText(page, 'Export ZIP');
  const zipDownload = await waitForDownloadOrDump(page, zipDownloadPromise, 'ZIP export');
  const zipFileName = zipDownload.suggestedFilename();
  if (!zipFileName.endsWith('.zip')) throw new Error(`Expected ZIP download, got ${zipFileName}`);

  await page.goto(urlFor(`/deck/${importedDeckId}`), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await waitForTextOrDump(page, renamedDeckTitle, 'Renamed deck title before delete');
  await openDeckActions(page);
  await page.getByLabel('ลบ deck').click();
  await page.getByText('กดลบอีกครั้งเพื่อยืนยัน', { exact: false }).waitFor({ timeout: 10_000 });
  await page.getByLabel('ลบ deck').click();
  await page.waitForURL(urlFor('/'), { timeout: 15_000 }).catch(async () => {
    await page.getByText('Library', { exact: false }).first().waitFor({ timeout: 10_000 });
  });
  await expectLibraryDeckDeleted(page, importedDeckId);

  const result = {
    target,
    importedDeckTitle,
    editedTerm,
    renamedDeckTitle,
    movedGroup,
    movedSection,
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
