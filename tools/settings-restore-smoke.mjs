import { chromium } from 'playwright';

const target = process.argv[2] || 'https://app.nihon-bunkai.com';
const email = process.env.NB_TEST_EMAIL;
const password = process.env.NB_TEST_PASSWORD;

function mustEnv(name, value) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

mustEnv('NB_TEST_EMAIL', email);
mustEnv('NB_TEST_PASSWORD', password);

function now() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

async function clickText(page, text, timeout = 10_000) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ timeout });
  await locator.click();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

const warnings = [];
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'warning') warnings.push(message.text());
  if (message.type() === 'error') errors.push(message.text());
});

await page.addInitScript(() => {
  localStorage.setItem('nb.onboarded', 'true');
});

const started = now();
await page.goto(new URL('/settings', target).toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null);
let bodyText = await page.locator('body').innerText({ timeout: 10_000 });

if (bodyText.includes('เข้าสู่ระบบ')) {
  await clickText(page, 'เข้าสู่ระบบ');
  await page.waitForURL(/\/login/, { timeout: 15_000 }).catch(() => null);
  if (!/\/login/.test(page.url())) {
    await page.goto(new URL('/login', target).toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  }
  await page.getByPlaceholder('you@example.com').waitFor({ state: 'visible', timeout: 45_000 });
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder(/รหัสผ่าน/).fill(password);
  await page.getByText('เข้าสู่ระบบ', { exact: true }).last().click();
  await page.waitForURL(/\/($|\?)/, { timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(2_000);
  await page.goto(new URL('/settings', target).toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null);
  bodyText = await page.locator('body').innerText({ timeout: 10_000 });
}

const accountText = bodyText.split('\n').filter((line) =>
  line.includes('สิทธิ์ปลดล็อก') ||
  line.includes('กู้คืนการสั่งซื้อ') ||
  line.includes('ซื้อด้วย email อื่น') ||
  line.includes('ขอลบบัญชี') ||
  line.includes('hi@nihon-bunkai.com') ||
  line.includes(email),
);

const result = {
  target,
  measuredAt: new Date().toISOString(),
  elapsedMs: now() - started,
  finalUrl: page.url(),
  signedIn: bodyText.includes(email),
  hasUnlockRightsCopy: bodyText.includes('สิทธิ์ปลดล็อก'),
  hasRestoreSection: bodyText.includes('กู้คืนการสั่งซื้อ') && bodyText.includes('ซื้อด้วย email อื่น'),
  hasRestoreSupportCopy: bodyText.includes('ถ้ายังหาไม่เจอ ติดต่อ hi@nihon-bunkai.com'),
  hasLocalDataSafetyCopy: bodyText.includes('ก่อนล้าง cache / ย้ายเครื่อง') &&
    bodyText.includes('Export backup'),
  hasSupportIssueCopy: bodyText.includes('Restore / Unlock') &&
    bodyText.includes('Payhip / Download') &&
    bodyText.includes('Library backup'),
  hasPrivacySupportCopy: bodyText.includes('ขอลบบัญชี') && bodyText.includes('hi@nihon-bunkai.com'),
  hasLiteralMailtoCopy: bodyText.includes('→ mailto'),
  warningCount: warnings.length,
  errorCount: errors.length,
  warnings: warnings.slice(0, 8),
  errors: errors.slice(0, 8),
  accountText,
  authTextSample: bodyText.slice(0, 900),
};

await browser.close();
console.log(JSON.stringify(result, null, 2));
