import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:8097';
const stamp = Date.now().toString(36);
const deckTitle = `Smoke custom deck ${stamp}`;
const firstTerm = `試作語${stamp}`;
const secondTerm = `追試語${stamp}`;

const browser = await chromium.launch({ headless: true });
const consoleEvents = [];

function isAcceptedCustomTermHydration(event) {
  return event.text.includes('React error #418')
    && /\/deck\/custom-[^/]+\/term\/custom-[^/]+/.test(event.url);
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('nb.onboarded', 'true');
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleEvents.push({ url: page.url(), text: msg.text() });
  });
  page.on('pageerror', (error) => consoleEvents.push({ url: page.url(), text: error.message }));

  await page.goto(`${baseUrl}/term/new`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByPlaceholder('คำศัพท์ภาษาญี่ปุ่น (Kanji / Kana)').fill(firstTerm);
  await page.getByPlaceholder('ความหมายภาษาไทย').fill('คำทดสอบ');
  await page.getByPlaceholder('คำอ่านออกเสียง (Romaji / Kana)').fill('しさくご');
  await page.getByPlaceholder('คำอธิบายเพิ่มเติม (รองรับ Markdown)').fill('### Note');
  await page.getByText('New deck').click();
  await page.getByPlaceholder('ระบุชื่อ Deck ใหม่').fill(deckTitle);
  await page.getByRole('button', { name: 'บันทึกคำศัพท์' }).click();
  await page.getByText('บันทึกคำศัพท์สำเร็จ · เปิดดูข้อความ').waitFor({ timeout: 30_000 });
  await page.getByText('บันทึกคำศัพท์สำเร็จ · เปิดดูข้อความ').click({ force: true });
  await page.waitForURL(/\/deck\/.+\/term\/.+-1/, { timeout: 30_000 });
  const mobileUrl = new URL(page.url());
  const [, deckId] = mobileUrl.pathname.match(/\/deck\/([^/]+)\//) ?? [];
  if (!deckId) throw new Error(`Could not read created deck id from ${mobileUrl.pathname}`);
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByLabel('เพิ่มคำใหม่').click();
  await page.getByText('กำหนดตำแหน่งจัดเก็บ').first().waitFor({ timeout: 15_000 });
  await page.getByLabel('ปิดหน้าต่างเพิ่มคำศัพท์').click();
  await page.getByText('กำหนดตำแหน่งจัดเก็บ').first().waitFor({ state: 'hidden', timeout: 15_000 });
  await page.getByLabel('เพิ่มคำใหม่').click();
  await page.getByText('กำหนดตำแหน่งจัดเก็บ').first().waitFor({ timeout: 15_000 });
  await page.getByPlaceholder('คำศัพท์ภาษาญี่ปุ่น (Kanji / Kana)').fill(secondTerm);
  await page.getByPlaceholder('ความหมายภาษาไทย').fill('คำทดสอบต่อ');
  await page.getByPlaceholder('คำอ่านออกเสียง (Romaji / Kana)').fill('ついしご');
  await page.getByPlaceholder('คำอธิบายเพิ่มเติม (รองรับ Markdown)').fill('### Followup');
  await page.getByText('Existing').click();
  await page.getByText(deckTitle).click();
  await page.getByRole('button', { name: 'บันทึกคำศัพท์' }).click();
  await page.getByText('บันทึกคำศัพท์สำเร็จ · เปิดดูข้อความ').waitFor({ timeout: 30_000 });
  const modalStillOpen = await page.getByText('กำหนดตำแหน่งจัดเก็บ').first().isVisible();
  await page.getByLabel('เปิดคำศัพท์ที่เพิ่งบันทึก').click();
  await page.waitForURL(new RegExp(`/deck/${deckId}/term/${deckId}-2$`), { timeout: 30_000 });
  await page.getByText(secondTerm).waitFor({ timeout: 30_000 });
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
  await page.getByText('กำหนดตำแหน่งจัดเก็บ').first().waitFor({ timeout: 15_000 });
  const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.getByLabel('ปิดหน้าต่างเพิ่มคำศัพท์').click();
  await page.getByText('กำหนดตำแหน่งจัดเก็บ').first().waitFor({ state: 'hidden', timeout: 15_000 });

  const acceptedConsoleWarnings = consoleEvents.filter(isAcceptedCustomTermHydration);
  const blockingConsoleErrors = consoleEvents.filter((event) => !isAcceptedCustomTermHydration(event));

  const result = {
    deckId,
    mobileOverflow,
    desktopOverflow,
    searchOverflow,
    reloadOverflow,
    tabletOverflow,
    modalStillOpen,
    consoleErrors: blockingConsoleErrors,
    acceptedConsoleWarnings,
  };
  console.log(JSON.stringify(result, null, 2));

  if (blockingConsoleErrors.length > 0) process.exitCode = 2;
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
