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

async function checkLogin(viewport, label) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    localStorage.setItem('nb.onboarded', 'true');
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByText('เข้าสู่ระบบ', { exact: true }).first().waitFor({ timeout: 30_000 });
  await page.getByText('มีบัญชีอยู่แล้ว ใช้อีเมลและรหัสผ่านเพื่อกลับเข้า Browse').waitFor({ timeout: 15_000 });
  await page.getByText('สมัครบัญชีใหม่', { exact: true }).waitFor({ timeout: 15_000 });

  const passwordInput = page.getByLabel('รหัสผ่าน').first();
  await passwordInput.waitFor({ timeout: 15_000 });
  const initialType = await passwordInput.evaluate((node) => node.type);
  if (initialType !== 'password') fail(`${label}: password should start hidden`, { initialType });

  await page.getByLabel('แสดงรหัสผ่าน').click();
  const visibleType = await passwordInput.evaluate((node) => node.type);
  if (visibleType !== 'text') fail(`${label}: reveal button should show password text`, { visibleType });

  await page.getByLabel('อีเมล').fill('bad-email');
  await passwordInput.fill('abc');
  await page.getByText('เข้าสู่ระบบ', { exact: true }).last().click();
  await page.getByText('กรุณากรอกอีเมลให้ถูกต้อง').waitFor({ timeout: 15_000 });

  await expectNoHorizontalOverflow(page, label);
  await context.close();
  return { label, viewport, consoleErrors };
}

async function checkSignup(viewport, label) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    localStorage.setItem('nb.onboarded', 'true');
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(new URL('/signup', baseUrl).toString(), { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByText('สมัครบัญชีใหม่', { exact: true }).first().waitFor({ timeout: 30_000 });
  await page.getByText('ระบบจะส่งลิงก์ยืนยันตัวตนไปยังอีเมลของคุณ').waitFor({ timeout: 15_000 });
  const oldNoticeCount = await page.getByText('หลังสมัคร ระบบจะส่งอีเมลยืนยัน', { exact: true }).count();
  if (oldNoticeCount !== 0) fail(`${label}: pre-submit confirmation notice should not be shown`, { oldNoticeCount });
  await page.getByText('เงื่อนไขรหัสผ่าน:').waitFor({ timeout: 15_000 });
  await page.getByText('8+ ตัวอักษร').waitFor({ timeout: 15_000 });
  await page.getByText('สัญลักษณ์').waitFor({ timeout: 15_000 });

  const passwordInput = page.getByLabel('รหัสผ่าน').first();
  await page.getByLabel('อีเมล').fill('learner@example.com');
  await passwordInput.fill('abc');
  await page.getByText('สมัครสมาชิก', { exact: true }).click();
  await page.getByText('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร, ตัวอักษร, ตัวเลข และสัญลักษณ์').waitFor({ timeout: 15_000 });

  await passwordInput.fill('ภาษาไทย12!');
  await page.getByText('8+ ตัวอักษร').waitFor({ timeout: 15_000 });

  await page.getByText('กลับหน้าเข้าสู่ระบบ', { exact: true }).click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await expectNoHorizontalOverflow(page, label);
  await context.close();
  return { label, viewport, consoleErrors };
}

async function checkSettingsEntry() {
  const context = await browser.newContext({ viewport: { width: 412, height: 628 } });
  await context.addInitScript(() => {
    localStorage.setItem('nb.onboarded', 'true');
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(new URL('/settings', baseUrl).toString(), { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByText('Settings', { exact: true }).first().waitFor({ timeout: 30_000 });
  await page.getByText('เข้าสู่ระบบ', { exact: true }).first().click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await page.getByText('สมัครบัญชีใหม่', { exact: true }).waitFor({ timeout: 15_000 });
  await expectNoHorizontalOverflow(page, 'settings-login-entry');
  await context.close();
  return { label: 'settings-login-entry', consoleErrors };
}

const browser = await chromium.launch({ headless: true });

try {
  const results = [
    await checkLogin({ width: 412, height: 628 }, 'login-mobile'),
    await checkLogin({ width: 1365, height: 768 }, 'login-desktop'),
    await checkSignup({ width: 412, height: 700 }, 'signup-mobile'),
    await checkSignup({ width: 1365, height: 768 }, 'signup-desktop'),
    await checkSettingsEntry(),
  ];
  const consoleErrors = results.flatMap((result) => result.consoleErrors);
  console.log(JSON.stringify({ baseUrl, results, consoleErrors }, null, 2));
  if (consoleErrors.length > 0) process.exitCode = 2;
} finally {
  await browser.close();
}
