import { chromium } from 'playwright';

const target = process.argv[2] || 'http://localhost:8097';
const deckId = process.argv[3] || 'vocab-n5-pack01';

function urlFor(route) {
  return new URL(route, target).toString();
}

const tenCardConfig = {
  count: 10,
  order: 'normal',
  goal: 'meaning',
  hints: { term: true, meaning: false, reading: true },
  configured: true,
};

async function readStore(page, storeName) {
  return page.evaluate((name) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('nihon-bunkai-srs');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(name, 'readonly');
        const getAll = tx.objectStore(name).getAll();
        getAll.onerror = () => reject(getAll.error);
        getAll.onsuccess = () => resolve(getAll.result);
      };
    });
  }, storeName);
}

async function answerMultipleChoice(page) {
  await page.goto(urlFor(`/deck/${deckId}/multiple-choice`), {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await page.waitForSelector('text=เลือกคำตอบ', { timeout: 25_000 });

  for (let i = 0; i < 10; i += 1) {
    await page.locator('[aria-label^="ตัวเลือก "]').first().click({ timeout: 10_000 });
    const nextLabel = i === 9 ? 'ดูผลลัพธ์' : 'ข้อต่อไป';
    await page.getByText(nextLabel, { exact: true }).click({ timeout: 10_000 });
  }

  await page.waitForSelector('text=จบรอบปรนัย', { timeout: 15_000 });
}

async function answerDictation(page) {
  await page.goto(urlFor(`/deck/${deckId}/dictation`), {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await page.waitForSelector('text=เขียนคำตอบ', { timeout: 25_000 });

  for (let i = 0; i < 10; i += 1) {
    await page.getByPlaceholder('พิมพ์คำตอบ').fill(`wrong-${i}`);
    await page.getByText('ส่งคำตอบ', { exact: true }).click({ timeout: 10_000 });
    const nextLabel = i === 9 ? 'ดูผลลัพธ์' : 'ข้อต่อไป';
    await page.getByText(nextLabel, { exact: true }).click({ timeout: 10_000 });
  }

  await page.waitForSelector('text=จบรอบเขียนตอบ', { timeout: 15_000 });
}

async function summarize(page) {
  await page.waitForFunction(async () => {
    const open = indexedDB.open('nihon-bunkai-srs');
    const db = await new Promise((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    const tx = db.transaction(['sessionLogs', 'cardStates', 'streakMeta'], 'readonly');
    const sessionCount = await new Promise((resolve, reject) => {
      const req = tx.objectStore('sessionLogs').count();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
    const cardCount = await new Promise((resolve, reject) => {
      const req = tx.objectStore('cardStates').count();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
    return sessionCount >= 2 && cardCount >= 10;
  }, null, { timeout: 15_000 });

  const sessions = await readStore(page, 'sessionLogs');
  const cardStates = await readStore(page, 'cardStates');
  const streak = await readStore(page, 'streakMeta');
  return { sessions, cardStates, streak };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 446, height: 628 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const warnings = [];
const errors = [];

page.on('console', (message) => {
  if (message.type() === 'warning') warnings.push(message.text());
  if (message.type() === 'error') errors.push(message.text());
});

await page.addInitScript(({ config }) => {
  localStorage.setItem('nb.onboarded', 'true');
  localStorage.setItem('nb.study-mode-config.multiple-choice', JSON.stringify(config));
  localStorage.setItem('nb.study-mode-config.dictation', JSON.stringify(config));
}, { config: tenCardConfig });

let completed = false;

try {
  await answerMultipleChoice(page);
  await answerDictation(page);
  const { sessions, cardStates, streak } = await summarize(page);
  const recentSessions = sessions
    .filter((session) => session.deckId === deckId)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 2);

  const result = {
    target,
    deckId,
    sessionCount: sessions.length,
    cardStateCount: cardStates.length,
    streakCount: streak.length,
    recentSessions: recentSessions.map((session) => ({
      deckId: session.deckId,
      totalCards: session.totalCards,
      ratingsLength: session.ratings.length,
      againCount: session.againCount,
      hardCount: session.hardCount,
      goodCount: session.goodCount,
      easyCount: session.easyCount,
      skippedCount: session.skippedCount,
    })),
    warningCount: warnings.length,
    errorCount: errors.length,
    warnings: warnings.slice(0, 8),
    errors: errors.slice(0, 8),
  };

  console.log(JSON.stringify(result, null, 2));

  if (result.errorCount > 0) throw new Error('Console errors were reported');
  if (recentSessions.length < 2) throw new Error('Expected two completed study-mode sessions');
  for (const session of recentSessions) {
    if (session.totalCards !== 10) throw new Error(`Expected totalCards=10, got ${session.totalCards}`);
    if (session.ratings.length !== 10) throw new Error(`Expected ratings length 10, got ${session.ratings.length}`);
    if (session.hardCount !== 0 || session.easyCount !== 0) throw new Error('MC/Dictation v1 should only write Again/Good');
    if (session.againCount + session.goodCount !== 10) throw new Error('Again + Good counts should equal answered cards');
    if (session.skippedCount !== 0) throw new Error(`Expected skippedCount=0, got ${session.skippedCount}`);
  }
  completed = true;
} finally {
  if (!page.isClosed()) {
    const body = await page.locator('body').innerText({ timeout: 2_000 }).catch(() => '');
    if (!completed || errors.length > 0 || body.includes('ReferenceError') || body.includes('TypeError')) {
      console.log(JSON.stringify({
        failureBodySample: body.slice(0, 1200),
        warningCount: warnings.length,
        errorCount: errors.length,
        warnings: warnings.slice(0, 8),
        errors: errors.slice(0, 8),
      }, null, 2));
    }
  }
  await browser.close();
}
