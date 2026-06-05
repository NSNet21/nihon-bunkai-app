import { chromium } from 'playwright';

const target = process.argv[2] || 'http://localhost:8097';
const deckId = process.argv[3] || 'kanji-n5-pack02';
const configKey = 'nb.study-mode-config.flashcard';
const shuffleConfig = {
  count: 'all',
  order: 'shuffle',
  goal: 'meaning',
  hints: { term: true, meaning: false, reading: true },
  configured: true,
};

function urlFor(route) {
  return new URL(route, target).toString();
}

function quizFirstTerm(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const cardIndex = lines.findIndex((line) => /^NO\. \d+/.test(line));
  return cardIndex >= 0 ? lines[cardIndex + 1] ?? '' : '';
}

function memorizeFirstTerm(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const fieldsIndex = lines.findIndex((line) => line === 'VISIBLE FIELDS');
  return fieldsIndex >= 0 ? lines[fieldsIndex + 1] ?? '' : '';
}

function firstCardMeta(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => /^NO\. \d+/.test(line)) ?? '';
}

async function loadCardText(page, route) {
  await page.goto(urlFor(route), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForSelector('text=/NO\\. \\d+/', { timeout: 25_000 });
  return page.locator('body').innerText({ timeout: 10_000 });
}

async function firstCardText(route) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 446, height: 628 } });
  const warnings = [];
  const errors = [];

  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.addInitScript(({ key, value }) => {
    localStorage.setItem('nb.onboarded', 'true');
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: configKey, value: shuffleConfig });

  try {
    const text = await loadCardText(page, route);
    return { text, warnings, errors };
  } finally {
    await browser.close();
  }
}

async function desktopStudyBackVisible(route) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1168, height: 628 } });
  await page.addInitScript(() => {
    localStorage.setItem('nb.onboarded', 'true');
  });

  try {
    await loadCardText(page, route);
    return await page.getByLabel('กลับไปหน้าก่อนหน้า').isVisible({ timeout: 5_000 }).catch(() => false);
  } finally {
    await browser.close();
  }
}

async function manualShuffleFirstCardText(route, extractFirstTerm) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 446, height: 628 } });
  const warnings = [];
  const errors = [];

  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.addInitScript(() => {
    localStorage.setItem('nb.onboarded', 'true');
  });

  try {
    const beforeText = await loadCardText(page, route);
    const beforeTerm = extractFirstTerm(beforeText);
    const button = page.getByLabel('สลับลำดับรอบเรียนนี้').first();
    await button.waitFor({ state: 'visible', timeout: 15_000 });
    await button.click({ timeout: 10_000 });
    await page.waitForFunction(
      ({ before, kind }) => {
        const lines = document.body.innerText.split('\n').map((line) => line.trim()).filter(Boolean);
        if (kind === 'quiz') {
          const cardIndex = lines.findIndex((line) => /^NO\. \d+/.test(line));
          return cardIndex >= 0 && lines[cardIndex + 1] && lines[cardIndex + 1] !== before;
        }
        const fieldsIndex = lines.findIndex((line) => line === 'VISIBLE FIELDS');
        return fieldsIndex >= 0 && lines[fieldsIndex + 1] && lines[fieldsIndex + 1] !== before;
      },
      { before: beforeTerm, kind: route.includes('/quiz') ? 'quiz' : 'memorize' },
      { timeout: 15_000 },
    );
    const afterText = await page.locator('body').innerText({ timeout: 10_000 });
    return {
      beforeTerm,
      afterTerm: extractFirstTerm(afterText),
      beforeMeta: firstCardMeta(beforeText),
      afterMeta: firstCardMeta(afterText),
      text: afterText,
      warnings,
      errors,
    };
  } finally {
    await browser.close();
  }
}

const normalBrowser = await chromium.launch({ headless: true });
const normalPage = await normalBrowser.newPage({ viewport: { width: 446, height: 628 } });
await normalPage.addInitScript(() => {
  localStorage.setItem('nb.onboarded', 'true');
});
const normalText = await loadCardText(normalPage, `/deck/${deckId}/quiz`);
await normalBrowser.close();

const quiz = await firstCardText(`/deck/${deckId}/quiz`);
const memorize = await firstCardText(`/deck/${deckId}/memorize`);
const quizManual = await manualShuffleFirstCardText(`/deck/${deckId}/quiz`, quizFirstTerm);
const memorizeManual = await manualShuffleFirstCardText(`/deck/${deckId}/memorize`, memorizeFirstTerm);
const quizDesktopStudyBackVisible = await desktopStudyBackVisible(`/deck/${deckId}/quiz`);
const normalFirstTerm = quizFirstTerm(normalText);
const quizFirstTermValue = quizFirstTerm(quiz.text);
const memorizeFirstTermValue = memorizeFirstTerm(memorize.text);

const result = {
  target,
  deckId,
  normalFirstTerm,
  quizFirstTerm: quizFirstTermValue,
  memorizeFirstTerm: memorizeFirstTermValue,
  normalFirstSample: normalText.slice(0, 300),
  quizFirstSample: quiz.text.slice(0, 300),
  memorizeFirstSample: memorize.text.slice(0, 300),
  quizUsesShuffle: quizFirstTermValue !== normalFirstTerm,
  memorizeUsesShuffle: memorizeFirstTermValue !== normalFirstTerm,
  quizAndMemorizeUseSameFirstTerm: quizFirstTermValue === memorizeFirstTermValue,
  quizManualBeforeTerm: quizManual.beforeTerm,
  quizManualAfterTerm: quizManual.afterTerm,
  quizManualBeforeMeta: quizManual.beforeMeta,
  quizManualAfterMeta: quizManual.afterMeta,
  memorizeManualBeforeTerm: memorizeManual.beforeTerm,
  memorizeManualAfterTerm: memorizeManual.afterTerm,
  memorizeManualBeforeMeta: memorizeManual.beforeMeta,
  memorizeManualAfterMeta: memorizeManual.afterMeta,
  quizManualShuffleWorked: quizManual.beforeTerm !== quizManual.afterTerm,
  memorizeManualShuffleWorked: memorizeManual.beforeTerm !== memorizeManual.afterTerm,
  quizManualMetaWorked: quizManual.beforeMeta !== quizManual.afterMeta && quizManual.afterMeta.includes('NO.'),
  memorizeManualMetaWorked: memorizeManual.beforeMeta !== memorizeManual.afterMeta && memorizeManual.afterMeta.includes('NO.'),
  quizMetaDroppedCardCounter: !/^CARD\b/.test(quizManual.afterMeta),
  memorizeMetaDroppedCardCounter: !/^CARD\b/.test(memorizeManual.afterMeta),
  quizDesktopStudyBackVisible,
  warningCount: quiz.warnings.length + memorize.warnings.length + quizManual.warnings.length + memorizeManual.warnings.length,
  errorCount: quiz.errors.length + memorize.errors.length + quizManual.errors.length + memorizeManual.errors.length,
  warnings: [...quiz.warnings, ...memorize.warnings, ...quizManual.warnings, ...memorizeManual.warnings].slice(0, 8),
  errors: [...quiz.errors, ...memorize.errors, ...quizManual.errors, ...memorizeManual.errors].slice(0, 8),
};

console.log(JSON.stringify(result, null, 2));

if (!result.quizUsesShuffle) {
  throw new Error('Quiz did not use flashcard shuffle config');
}
if (!result.memorizeUsesShuffle) {
  throw new Error('Memorize did not use flashcard shuffle config');
}
if (!result.quizAndMemorizeUseSameFirstTerm) {
  throw new Error('Quiz and Memorize did not use the same flashcard shuffle order');
}
if (!result.quizManualShuffleWorked) {
  throw new Error('Quiz manual shuffle button did not change the first card');
}
if (!result.memorizeManualShuffleWorked) {
  throw new Error('Memorize manual shuffle button did not change the first card');
}
if (!result.quizManualMetaWorked) {
  throw new Error('Quiz manual shuffle did not update the card source-number badge');
}
if (!result.memorizeManualMetaWorked) {
  throw new Error('Memorize manual shuffle did not update the card source-number badge');
}
if (!result.quizMetaDroppedCardCounter) {
  throw new Error('Quiz card meta still repeats the session card counter');
}
if (!result.memorizeMetaDroppedCardCounter) {
  throw new Error('Memorize card meta still repeats the session card counter');
}
if (!result.quizDesktopStudyBackVisible) {
  throw new Error('Quiz study back button is not visible on desktop/tablet viewport');
}
if (result.errorCount > 0) {
  throw new Error('Console errors detected during shuffle session smoke');
}
