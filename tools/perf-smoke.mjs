import { chromium } from 'playwright';

const target = process.argv[2] || 'https://app.nihon-bunkai.com';
const routes = ['/', '/search', '/shop', '/settings'];
const searchQuery = process.env.NB_SMOKE_SEARCH_QUERY || '問題';
const searchExpectedText = (process.env.NB_SMOKE_SEARCH_EXPECTED || '問題,もんだい,ปัญหา')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

function now() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

async function measureRoute(page, route) {
  const warnings = [];
  const errors = [];
  const onConsole = (message) => {
    const line = message.text();
    if (message.type() === 'warning') warnings.push(line);
    if (message.type() === 'error') errors.push(line);
  };
  page.on('console', onConsole);

  const started = now();
  await page.goto(new URL(route, target).toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  const domcontentloadedMs = now() - started;
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null);
  const settledMs = now() - started;

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const scripts = performance.getEntriesByType('resource')
      .filter((entry) => entry.initiatorType === 'script')
      .map((entry) => ({
        name: entry.name,
        duration: Math.round(entry.duration),
        transferSize: entry.transferSize || 0,
        decodedBodySize: entry.decodedBodySize || 0,
      }))
      .sort((a, b) => b.decodedBodySize - a.decodedBodySize)
      .slice(0, 5);

    return {
      url: location.href,
      nav: nav ? {
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        loadEventEnd: Math.round(nav.loadEventEnd),
        transferSize: nav.transferSize || 0,
        decodedBodySize: nav.decodedBodySize || 0,
      } : null,
      scripts,
      bodyTextLength: document.body.innerText.length,
    };
  });

  page.off('console', onConsole);
  return {
    route,
    domcontentloadedMs,
    settledMs,
    warningCount: warnings.length,
    errorCount: errors.length,
    warnings: warnings.slice(0, 5),
    errors: errors.slice(0, 5),
    ...metrics,
  };
}

async function measureSearch(page) {
  const started = now();
  await page.goto(new URL('/search', target).toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForSelector('input[placeholder*="คำญี่ปุ่น"]', { timeout: 20_000 });
  const inputReadyMs = now() - started;

  const typeStarted = now();
  await page.click('input[placeholder*="คำญี่ปุ่น"]');
  await page.keyboard.type(searchQuery);
  await page.waitForTimeout(500);
  const bodyText = await page.locator('body').innerText({ timeout: 10_000 });
  const searchState = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="คำญี่ปุ่น"]');
    return {
      inputValue: input?.value ?? '',
      visibleText: document.body.innerText.slice(0, 500),
    };
  });

  return {
    route: '/search',
    query: searchQuery,
    expectedText: searchExpectedText,
    inputReadyMs,
    queryFeedbackMs: now() - typeStarted,
    inputValue: searchState.inputValue,
    hasResultText: searchExpectedText.some((text) => bodyText.includes(text)),
    bodyTextLength: bodyText.length,
    visibleTextSample: searchState.visibleText,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

await page.addInitScript(() => {
  localStorage.setItem('nb.onboarded', 'true');
});

const routeResults = [];
for (const route of routes) {
  routeResults.push(await measureRoute(page, route));
}

const searchResult = await measureSearch(page);
await browser.close();

console.log(JSON.stringify({
  target,
  measuredAt: new Date().toISOString(),
  routeResults,
  searchResult,
}, null, 2));
