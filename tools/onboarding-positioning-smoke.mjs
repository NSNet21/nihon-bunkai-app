import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:8097';

function fail(message, details = {}) {
  const error = new Error(`${message}\n${JSON.stringify(details, null, 2)}`);
  error.details = details;
  throw error;
}

async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  if (overflow !== 0) fail(`${label}: horizontal overflow`, { overflow });
}

async function expectNoStaleOnboardingCopy(page, label) {
  const body = await page.locator('body').innerText();
  const stale = [
    'STARTUP',
    'CARDS / DAY',
    'DAILY PACE',
    'REMINDER',
    'streak',
    'already have account?',
  ].filter((text) => body.includes(text));
  if (stale.length > 0) fail(`${label}: stale onboarding positioning copy`, { stale });
}

async function expectVisibleBodyText(page, text, label) {
  await page.waitForFunction((needle) => document.body.innerText.includes(needle), text, {
    timeout: 15_000,
  }).catch(() => fail(`${label}: missing visible body text`, { text }));
}

async function checkOnboarding(viewport, label) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    localStorage.removeItem('nb.onboarded');
    localStorage.removeItem('nb.preferred-level');
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(new URL('/onboarding/welcome', baseUrl).toString(), { waitUntil: 'networkidle', timeout: 90_000 });
  await expectVisibleBodyText(page, 'เปิดคลัง', `${label}-welcome`);
  await expectNoStaleOnboardingCopy(page, `${label}-welcome`);
  await expectNoHorizontalOverflow(page, `${label}-welcome`);

  await page.getByLabel('เริ่มต้น').click();
  await page.waitForURL(/\/onboarding\/level/, { timeout: 15_000 });
  await expectVisibleBodyText(page, 'จุดเริ่มต้น', `${label}-level`);
  await expectNoStaleOnboardingCopy(page, `${label}-level`);
  await expectNoHorizontalOverflow(page, `${label}-level`);

  await page.getByText('N4', { exact: true }).first().click();
  const preferred = await page.evaluate(() => localStorage.getItem('nb.preferred-level'));
  if (preferred !== '"N4"' && preferred !== 'N4') fail(`${label}: preferred level not persisted`, { preferred });

  await page.getByLabel('ถัดไป').click();
  await page.waitForURL(/\/onboarding\/pace/, { timeout: 15_000 });
  await expectVisibleBodyText(page, 'พร้อมเปิดคลัง', `${label}-final`);
  await expectNoStaleOnboardingCopy(page, `${label}-final`);
  await expectNoHorizontalOverflow(page, `${label}-final`);

  await page.getByLabel('เข้าคลังคำศัพท์').click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 20_000 });
  await page.getByText('คลังคำศัพท์').waitFor({ timeout: 30_000 });
  const onboarded = await page.evaluate(() => localStorage.getItem('nb.onboarded'));
  if (onboarded !== 'true') fail(`${label}: onboarded flag was not set`, { onboarded });

  await context.close();
  return { label, viewport, consoleErrors };
}

const browser = await chromium.launch({ headless: true });

try {
  const results = [
    await checkOnboarding({ width: 412, height: 628 }, 'onboarding-mobile'),
    await checkOnboarding({ width: 1365, height: 768 }, 'onboarding-desktop'),
  ];
  const consoleErrors = results.flatMap((result) => result.consoleErrors);
  console.log(JSON.stringify({ baseUrl, results, consoleErrors }, null, 2));
  if (consoleErrors.length > 0) process.exitCode = 2;
} finally {
  await browser.close();
}
