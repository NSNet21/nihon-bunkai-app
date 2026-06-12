import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:8097';
const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  const context = await browser.newContext({ viewport: { width: 433, height: 628 } });
  await context.addInitScript(() => {
    localStorage.setItem('nb.onboarded', 'true');
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${baseUrl}/term/new`, { waitUntil: 'networkidle', timeout: 90_000 });
  const eInput = page.getByPlaceholder('คำอธิบายเพิ่มเติม (รองรับ Markdown)');
  await eInput.fill('### Smoke\n**Label:** ทดลอง\n> reading\n---\nnote');
  await eInput.selectText();
  const selection = await eInput.evaluate((node) => ({
    start: node.selectionStart,
    end: node.selectionEnd,
    valueLength: node.value.length,
    userSelect: getComputedStyle(node).userSelect,
    cursor: getComputedStyle(node).cursor,
  }));

  await page.getByLabel('เปิดคู่มือสัญลักษณ์ Markdown สำหรับช่อง E').click();
  await page.getByText('ตัวอย่างการประยุกต์ใช้งาน').waitFor({ timeout: 15_000 });
  await page.getByText('เข้าใจแล้ว').click({ force: true });
  const valueAfterGuide = await eInput.inputValue();

  await page.getByLabel('เปิดหน้าต่างแก้ไขแบบเต็มหน้าจอ').click();
  await page.getByLabel('ปิดหน้าต่างแก้ไข E').waitFor({ timeout: 15_000 });
  const fullEditorInput = page.locator('textarea').last();
  await fullEditorInput.fill('### Full editor\n**ทดสอบ:** เลือกข้อความได้');
  await fullEditorInput.selectText();
  const fullSelection = await fullEditorInput.evaluate((node) => ({
    start: node.selectionStart,
    end: node.selectionEnd,
    valueLength: node.value.length,
    userSelect: getComputedStyle(node).userSelect,
    cursor: getComputedStyle(node).cursor,
  }));
  await page.getByLabel('ใช้ข้อความ E นี้').click();
  const finalValue = await eInput.inputValue();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  const result = {
    selection,
    fullSelection,
    guidePreservedDraft: valueAfterGuide.includes('### Smoke') && valueAfterGuide.includes('**Label:** ทดลอง'),
    finalValueIncludesFullEditor: finalValue.includes('Full editor'),
    overflow,
    consoleErrors: errors,
  };
  console.log(JSON.stringify(result, null, 2));

  if (errors.length > 0) process.exitCode = 2;
  if (
    selection.start !== 0
    || selection.end !== selection.valueLength
    || fullSelection.start !== 0
    || fullSelection.end !== fullSelection.valueLength
    || !valueAfterGuide.includes('### Smoke')
    || !valueAfterGuide.includes('**Label:** ทดลอง')
    || !finalValue.includes('Full editor')
    || overflow !== 0
  ) {
    process.exitCode = 3;
  }
} finally {
  await browser.close();
}
