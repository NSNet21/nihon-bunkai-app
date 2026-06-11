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

async function readInteractiveSurface(page, label) {
  const locator = page.getByLabel(label).first();
  await locator.waitFor({ timeout: 15_000 });
  return locator.evaluate((node) => {
    const nodeStyle = getComputedStyle(node);
    const bodyStyle = getComputedStyle(document.body);
    return {
      backgroundColor: nodeStyle.backgroundColor,
      borderColor: nodeStyle.borderColor,
      pageBackgroundColor: bodyStyle.backgroundColor,
    };
  });
}

function assertRaisedSurface(name, surface) {
  if (surface.backgroundColor === 'rgba(0, 0, 0, 0)' || surface.backgroundColor === surface.pageBackgroundColor) {
    fail(`${name} should use a raised Settings button surface`, surface);
  }
}

async function checkSettings(viewport, label, themeOverride) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((override) => {
    localStorage.setItem('nb.onboarded', 'true');
    localStorage.setItem('nb.theme-override', JSON.stringify(override));
  }, themeOverride);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(new URL('/settings', baseUrl).toString(), { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByText('Settings', { exact: true }).first().waitFor({ timeout: 30_000 });
  await page.waitForFunction((override) => document.documentElement.getAttribute('data-theme') === override, themeOverride, {
    timeout: 20_000,
  });
  await page.getByText('บัญชี · ธีม · การ์ด · ความปลอดภัย').waitFor({ timeout: 15_000 });

  const staleCopy = await page.evaluate(() => {
    const lines = document.body.innerText.split('\n').map((line) => line.trim());
    return [
      'Account · Theme · About',
      'HOW TO IMPORT',
      'SUPPORT',
      'ABOUT',
    ].filter((value) => lines.includes(value));
  });
  if (staleCopy.length > 0) fail('Settings should use Thai-first labels in the first-pass polish', { staleCopy });

  const launchDeferredLanguageCopy = await page.evaluate(() => {
    const lines = document.body.innerText.split('\n').map((line) => line.trim());
    return [
      'ภาษา · LANGUAGE',
      'English',
      'บางส่วนของแอปยังเป็นภาษาไทย · การแปลจะทยอยเพิ่มเร็วๆ นี้',
    ].filter((value) => lines.includes(value));
  });
  if (launchDeferredLanguageCopy.length > 0) {
    fail('Settings should hide the deferred app language toggle during launch scope', { launchDeferredLanguageCopy });
  }

  await page.getByText('นำเข้า · IMPORT').waitFor({ timeout: 15_000 });
  await page.getByText('ช่วยเหลือ · SUPPORT').waitFor({ timeout: 15_000 });
  await page.getByText('เกี่ยวกับ · ABOUT').waitFor({ timeout: 15_000 });
  await page.getByText('วิธีนำเข้า').first().waitFor({ timeout: 15_000 });

  const themeSurface = await readInteractiveSurface(page, /เปลี่ยนธีม/);
  const badgeSurface = await readInteractiveSurface(page, 'แสดง Badge ที่มุมบนซ้ายของการ์ด');
  const quizColumnSurface = await readInteractiveSurface(page, 'ตั้งค่าคอลัมน์ที่แสดงบนการ์ด · คอลัมน์ที่แสดง');
  assertRaisedSurface(`${label} theme trigger`, themeSurface);
  assertRaisedSurface(`${label} badge toggle`, badgeSurface);
  assertRaisedSurface(`${label} column accordion`, quizColumnSurface);

  const badgeBackground = badgeSurface.backgroundColor;
  if (badgeBackground.includes('255, 228, 230') || badgeBackground.includes('254, 226, 226')) {
    fail('Card badge toggle active state should not use the strong red fill', { badgeBackground });
  }

  await expectNoHorizontalOverflow(page, label);
  await context.close();
  return { label, themeOverride, viewport, consoleErrors, themeSurface, badgeSurface, quizColumnSurface };
}

const browser = await chromium.launch({ headless: true });

try {
  const results = [
    await checkSettings({ width: 412, height: 628 }, 'settings-mobile-light', 'light'),
    await checkSettings({ width: 412, height: 628 }, 'settings-mobile-dark', 'dark'),
    await checkSettings({ width: 1365, height: 768 }, 'settings-desktop-light', 'light'),
    await checkSettings({ width: 1365, height: 768 }, 'settings-desktop-dark', 'dark'),
  ];
  const consoleErrors = results.flatMap((result) => result.consoleErrors);
  console.log(JSON.stringify({ baseUrl, results, consoleErrors }, null, 2));
  if (consoleErrors.length > 0) process.exitCode = 2;
} finally {
  await browser.close();
}
