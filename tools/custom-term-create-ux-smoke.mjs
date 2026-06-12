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

async function parentBox(locator, label) {
  const rect = await locator.evaluate((node) => {
    const parent = node.parentElement;
    if (!parent) return null;
    const box = parent.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  if (!rect) fail(`${label}: parent element has no bounding box`);
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
  await page.getByText('คลังคำศัพท์', { exact: true }).waitFor({ timeout: 30_000 });

  const mobileToolbarAddCount = await page.getByLabel('เพิ่มคำใหม่').count();
  if (mobileToolbarAddCount !== 0) fail('Mobile Browse should not show duplicate add-term toolbar button', { mobileToolbarAddCount });

  const mobileAddNav = page.getByRole('link', { name: 'เพิ่มคำ' });
  await mobileAddNav.waitFor({ timeout: 15_000 });
  await mobileAddNav.click();
  await page.waitForURL(/\/term\/new/, { timeout: 30_000 });

  await page.getByText('เพิ่มคำศัพท์ใหม่').waitFor({ timeout: 30_000 });
  await page.getByRole('link', { name: 'เพิ่มคำ' }).waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'บันทึกคำศัพท์' }).waitFor({ timeout: 15_000 });
  await page.getByText('T คำศัพท์').waitFor({ timeout: 15_000 });
  const expandedRequirementBox = await parentBox(
    page.getByLabel('พับรายการข้อมูลที่จำเป็น'),
    'expanded requirement summary',
  );
  await page.getByLabel('พับรายการข้อมูลที่จำเป็น').click();
  await page.getByLabel('กางรายการข้อมูลที่จำเป็น').waitFor({ timeout: 15_000 });
  const collapsedRequirementBox = await parentBox(
    page.getByLabel('กางรายการข้อมูลที่จำเป็น'),
    'collapsed requirement summary',
  );
  const collapsedRequirementChipCount = await page.getByText('T คำศัพท์').count();
  if (collapsedRequirementChipCount !== 0) {
    fail('Requirement summary should hide chips when collapsed', { collapsedRequirementChipCount });
  }
  if (collapsedRequirementBox.height > 52 || collapsedRequirementBox.height > expandedRequirementBox.height * 0.62) {
    fail('Collapsed requirement summary should be visibly compact on mobile', {
      expandedRequirementBox,
      collapsedRequirementBox,
    });
  }
  await page.getByRole('button', { name: 'บันทึกคำศัพท์' }).click();
  await page.getByText('จำเป็นต้องระบุคำศัพท์ก่อนจัดเก็บ').waitFor({ timeout: 15_000 });
  await page.getByText('จำเป็นต้องระบุความหมายภาษาไทย').waitFor({ timeout: 15_000 });
  await page.getByText('รายการข้อมูลที่จำเป็น').waitFor({ timeout: 15_000 });
  await page.getByText('T คำศัพท์').waitFor({ timeout: 15_000 });

  const saveBox = await box(page.getByRole('button', { name: 'บันทึกคำศัพท์' }), 'save footer');
  const navBox = await box(page.getByRole('link', { name: 'เพิ่มคำ' }), 'mobile bottom nav add link');
  if (saveBox.y + saveBox.height > navBox.y) {
    fail('Save footer should sit above mobile bottom nav', { saveBox, navBox });
  }

  const destinationTitleCount = await page.getByText('กำหนดตำแหน่งจัดเก็บ', { exact: true }).count();
  if (destinationTitleCount !== 1) fail('Destination step title should appear once', { destinationTitleCount });

  const createGroupInputBefore = await page.getByPlaceholder('ระบุชื่อ Group ใหม่').count();
  if (createGroupInputBefore !== 0) fail('Create group input should be hidden before expanding the row', { createGroupInputBefore });

  await page.getByRole('button', { name: 'สร้าง Group ใหม่' }).click();
  await page.getByPlaceholder('ระบุชื่อ Group ใหม่').waitFor({ timeout: 15_000 });

  const createSectionInputBefore = await page.getByPlaceholder('Inbox').count();
  if (createSectionInputBefore !== 0) fail('Create section input should be hidden before expanding the row', { createSectionInputBefore });
  await page.getByRole('button', { name: 'สร้าง Section ใหม่' }).click();
  await page.getByPlaceholder('Inbox').waitFor({ timeout: 15_000 });

  await page.getByText('Official Source · ไม่สามารถเพิ่มข้อมูลในส่วนนี้ได้').first().waitFor({ timeout: 15_000 });
  await page.getByText('Official Source · ไม่สามารถเลือกใช้ได้').first().waitFor({ timeout: 15_000 });

  const sectionBox = await box(page.getByText('SECTION', { exact: true }).first(), 'section picker heading');
  const pathBox = await box(page.getByText('ตำแหน่งจัดเก็บปลายทาง').first(), 'destination path summary');
  if (pathBox.y <= sectionBox.y) {
    fail('Destination path summary should appear below group/section controls', { sectionBox, pathBox });
  }

  await page.getByLabel('เปิดคู่มือสัญลักษณ์ Markdown สำหรับช่อง E').click();
  await page.getByText('ตัวอย่างการประยุกต์ใช้งาน').waitFor({ timeout: 15_000 });
  await page.getByText('เข้าใจแล้ว').click({ force: true });

  await page.getByPlaceholder('ระบุชื่อ Group ใหม่').fill(`UX Group ${stamp}`);
  await page.getByPlaceholder('Inbox').fill('UX Section');
  await page.getByPlaceholder('คำศัพท์ภาษาญี่ปุ่น (Kanji / Kana)').fill(term);
  await page.getByPlaceholder('ความหมายภาษาไทย').fill('ตรวจ flow เพิ่มคำ');
  await page.getByPlaceholder('คำอ่านออกเสียง (Romaji / Kana)').fill('どうせんかくにん');
  await page.getByPlaceholder('คำอธิบายเพิ่มเติม (รองรับ Markdown)').fill('### UX smoke');
  await page.getByText('New deck').click();
  await page.getByRole('button', { name: 'บันทึกคำศัพท์' }).click();
  await page.getByText('จำเป็นต้องระบุชื่อ Deck ใหม่').waitFor({ timeout: 15_000 });
  await page.getByPlaceholder('ระบุชื่อ Deck ใหม่').fill(deckTitle);
  await page.getByRole('button', { name: 'บันทึกคำศัพท์' }).click();
  await page.getByText('บันทึกคำศัพท์สำเร็จ · เปิดดูข้อความ').waitFor({ timeout: 30_000 });

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
  await page.getByText('กำหนดตำแหน่งจัดเก็บ', { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText('ตำแหน่งจัดเก็บปลายทาง').waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'สร้าง Group ใหม่' }).waitFor({ timeout: 15_000 });
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
