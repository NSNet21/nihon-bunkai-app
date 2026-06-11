import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:8097';
const stamp = Date.now().toString(36);
const deckTitle = `UX custom deck ${stamp}`;
const term = `導線確認${stamp}`;
const deckTitlePattern = new RegExp(escapeRegExp(deckTitle));

const browser = await chromium.launch({ headless: true });
const errors = [];

function fail(message, details = {}) {
  const error = new Error(`${message}\n${JSON.stringify(details, null, 2)}`);
  error.details = details;
  throw error;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  if (overflow !== 0) fail(`${label}: horizontal overflow`, { overflow });
  return overflow;
}

async function box(locator, label) {
  const rect = await locator.boundingBox();
  if (!rect) fail(`${label}: element has no bounding box`);
  return rect;
}

try {
  const context = await browser.newContext({ viewport: { width: 412, height: 628 } });
  await context.addInitScript(() => {
    localStorage.setItem('nb.onboarded', 'true');
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByText('คลังคำศัพท์').waitFor({ timeout: 30_000 });

  const mobileToolbarAddCount = await page.getByLabel('เพิ่มคำใหม่').count();
  if (mobileToolbarAddCount !== 0) fail('Mobile Browse should not show duplicate add-term toolbar button', { mobileToolbarAddCount });

  const mobileAddNav = page.getByRole('link', { name: 'เพิ่มคำ' });
  await mobileAddNav.waitFor({ timeout: 15_000 });
  await mobileAddNav.click();
  await page.waitForURL(/\/term\/new/, { timeout: 30_000 });

  await page.getByText('เพิ่มคำใหม่').waitFor({ timeout: 30_000 });
  await page.getByRole('link', { name: 'เพิ่มคำ' }).waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'บันทึกคำ' }).waitFor({ timeout: 15_000 });

  const saveBox = await box(page.getByRole('button', { name: 'บันทึกคำ' }), 'save footer');
  const navBox = await box(page.getByRole('link', { name: 'เพิ่มคำ' }), 'mobile bottom nav add link');
  if (saveBox.y + saveBox.height > navBox.y) {
    fail('Save footer should sit above mobile bottom nav', { saveBox, navBox });
  }

  const destinationTitleCount = await page.getByText('เลือกที่เก็บคำ', { exact: true }).count();
  if (destinationTitleCount !== 1) fail('Destination step title should appear once', { destinationTitleCount });

  const createGroupInputBefore = await page.getByPlaceholder('ชื่อ group ใหม่').count();
  if (createGroupInputBefore !== 0) fail('Create group input should be hidden before expanding the row', { createGroupInputBefore });

  await page.getByRole('button', { name: 'สร้าง group ใหม่' }).click();
  await page.getByPlaceholder('ชื่อ group ใหม่').waitFor({ timeout: 15_000 });

  const createSectionInputBefore = await page.getByPlaceholder('Inbox').count();
  if (createSectionInputBefore !== 0) fail('Create section input should be hidden before expanding the row', { createSectionInputBefore });
  await page.getByRole('button', { name: 'สร้าง section ใหม่' }).click();
  await page.getByPlaceholder('Inbox').waitFor({ timeout: 15_000 });

  await page.getByText('Official Source · ใช้เป็นที่เก็บคำไม่ได้').first().waitFor({ timeout: 15_000 });
  await page.getByText('Official Source · ใช้ไม่ได้').first().waitFor({ timeout: 15_000 });

  const sectionBox = await box(page.getByText('SECTION', { exact: true }).first(), 'section picker heading');
  const pathBox = await box(page.getByText('ปลายทางตอนนี้').first(), 'destination path summary');
  if (pathBox.y <= sectionBox.y) {
    fail('Destination path summary should appear below group/section controls', { sectionBox, pathBox });
  }

  await page.getByLabel('เปิดคู่มือ Markdown สำหรับ E').click();
  await page.getByText('ตัวอย่างเต็ม').waitFor({ timeout: 15_000 });
  await page.getByText('เข้าใจแล้ว').click({ force: true });

  await page.getByPlaceholder('ชื่อ group ใหม่').fill(`UX Group ${stamp}`);
  await page.getByPlaceholder('Inbox').fill('UX Section');
  await page.getByPlaceholder('คำศัพท์ / Japanese expression').fill(term);
  await page.getByPlaceholder('ความหมายภาษาไทย').fill('ตรวจ flow เพิ่มคำ');
  await page.getByPlaceholder('คำอ่าน / pronunciation').fill('どうせんかくにん');
  await page.getByPlaceholder('รายละเอียด / markdown').fill('### UX smoke');
  await page.getByText('New deck').click();
  await page.getByPlaceholder('ชื่อ deck ใหม่').fill(deckTitle);
  await page.getByRole('button', { name: 'บันทึกคำ' }).click();
  await page.getByLabel('บันทึกคำแล้ว · เปิดดู').waitFor({ timeout: 30_000 });

  const existingButtonState = await page.getByText('Existing').evaluate((node) => {
    let current = node;
    while (current && current.getAttribute?.('role') !== 'button') current = current.parentElement;
    const styles = current ? getComputedStyle(current) : null;
    return {
      disabled: current?.getAttribute('aria-disabled') === 'true' || current?.hasAttribute('disabled') || false,
      borderColor: styles?.borderColor ?? '',
      backgroundColor: styles?.backgroundColor ?? '',
    };
  });
  await page.getByRole('button', { name: deckTitlePattern }).waitFor({ timeout: 15_000 });
  if (existingButtonState.disabled || !existingButtonState.borderColor.includes('224, 32, 44')) {
    fail('Existing deck mode should auto-select after creating a new deck', existingButtonState);
  }

  await expectNoHorizontalOverflow(page, 'mobile /term/new');

  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByLabel('เพิ่มคำใหม่').click();
  await page.getByText('เลือกที่เก็บคำ', { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText('ปลายทางตอนนี้').waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'สร้าง group ใหม่' }).waitFor({ timeout: 15_000 });
  await expectNoHorizontalOverflow(page, 'desktop modal');

  const result = {
    createdDeck: deckTitle,
    term,
    mobileToolbarAddCount,
    destinationTitleCount,
    consoleErrors: errors,
  };
  console.log(JSON.stringify(result, null, 2));

  if (errors.length > 0) process.exitCode = 2;
} finally {
  await browser.close();
}
