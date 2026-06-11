import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:8097';
const stamp = Date.now().toString(36);
const deckTitle = `Smoke custom deck ${stamp}`;
const firstTerm = `試作語${stamp}`;
const secondTerm = `追試語${stamp}`;

const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('nb.onboarded', 'true');
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${baseUrl}/term/new`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByPlaceholder('คำศัพท์ / Japanese expression').fill(firstTerm);
  await page.getByPlaceholder('ความหมายภาษาไทย').fill('คำทดสอบ');
  await page.getByPlaceholder('คำอ่าน / pronunciation').fill('しさくご');
  await page.getByPlaceholder('รายละเอียด / markdown').fill('### Note');
  await page.getByText('New deck').click();
  await page.getByPlaceholder('ชื่อ deck ใหม่').fill(deckTitle);
  await page.getByRole('button', { name: 'บันทึกคำ' }).click();
  await page.getByLabel('บันทึกคำแล้ว · เปิดดู').waitFor({ timeout: 30_000 });
  await page.getByLabel('บันทึกคำแล้ว · เปิดดู').click({ force: true });
  await page.waitForURL(/\/deck\/.+\/term\/.+-1/, { timeout: 30_000 });
  const mobileUrl = new URL(page.url());
  const [, deckId] = mobileUrl.pathname.match(/\/deck\/([^/]+)\//) ?? [];
  if (!deckId) throw new Error(`Could not read created deck id from ${mobileUrl.pathname}`);
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByLabel('เพิ่มคำใหม่').click();
  await page.getByText('เลือกที่เก็บคำ').first().waitFor({ timeout: 15_000 });
  await page.getByLabel('ปิดเพิ่มคำ').click();
  await page.getByText('เลือกที่เก็บคำ').first().waitFor({ state: 'hidden', timeout: 15_000 });
  await page.getByLabel('เพิ่มคำใหม่').click();
  await page.getByText('เลือกที่เก็บคำ').first().waitFor({ timeout: 15_000 });
  await page.getByPlaceholder('คำศัพท์ / Japanese expression').fill(secondTerm);
  await page.getByPlaceholder('ความหมายภาษาไทย').fill('คำทดสอบต่อ');
  await page.getByPlaceholder('คำอ่าน / pronunciation').fill('ついしご');
  await page.getByPlaceholder('รายละเอียด / markdown').fill('### Followup');
  await page.getByText('Existing').click();
  await page.getByText(deckTitle).click();
  await page.getByRole('button', { name: 'บันทึกคำ' }).click();
  await page.getByLabel('บันทึกคำแล้ว · เปิดดู').waitFor({ timeout: 30_000 });
  const modalStillOpen = await page.getByText('เลือกที่เก็บคำ').first().isVisible();
  await page.getByLabel('เปิดคำที่เพิ่งบันทึก').click();
  await page.waitForURL(new RegExp(`/deck/${deckId}/term/${deckId}-2$`), { timeout: 30_000 });
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.goto(`${baseUrl}/search`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByPlaceholder('คำญี่ปุ่น · ความหมายไทย · เสียงอ่าน').fill(secondTerm);
  await page.getByText(secondTerm).waitFor({ timeout: 30_000 });
  const searchOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.goto(`${baseUrl}/deck/${deckId}/term/${deckId}-2`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByText(secondTerm).waitFor({ timeout: 30_000 });
  await page.reload({ waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByText(secondTerm).waitFor({ timeout: 30_000 });
  const reloadOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByLabel('เพิ่มคำใหม่').click();
  await page.getByText('เลือกที่เก็บคำ').first().waitFor({ timeout: 15_000 });
  const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.getByLabel('ปิดเพิ่มคำ').click();
  await page.getByText('เลือกที่เก็บคำ').first().waitFor({ state: 'hidden', timeout: 15_000 });

  const result = {
    deckId,
    mobileOverflow,
    desktopOverflow,
    searchOverflow,
    reloadOverflow,
    tabletOverflow,
    modalStillOpen,
    consoleErrors: errors,
  };
  console.log(JSON.stringify(result, null, 2));

  if (errors.length > 0) process.exitCode = 2;
  if (
    mobileOverflow !== 0
    || desktopOverflow !== 0
    || searchOverflow !== 0
    || reloadOverflow !== 0
    || tabletOverflow !== 0
    || !modalStillOpen
  ) {
    process.exitCode = 3;
  }
} finally {
  await browser.close();
}
