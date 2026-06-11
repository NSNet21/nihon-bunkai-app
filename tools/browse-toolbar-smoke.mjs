import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:8097';
const minTouchTarget = 44;

function fail(message, details = {}) {
  const error = new Error(`${message}\n${JSON.stringify(details, null, 2)}`);
  error.details = details;
  throw error;
}

async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  if (overflow !== 0) fail(`${label}: horizontal overflow`, { overflow });
}

async function expectTargetAtLeast(page, label) {
  const locator = page.getByLabel(label).first();
  await locator.waitFor({ timeout: 20_000 });
  const rect = await locator.boundingBox();
  if (!rect) fail(`${label}: missing bounding box`);
  if (rect.width < minTouchTarget || rect.height < minTouchTarget) {
    fail(`${label}: touch target is too small`, { rect, minTouchTarget });
  }
  return rect;
}

async function checkBrowseToolbar(viewport, label) {
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

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByText('คลังคำศัพท์').waitFor({ timeout: 30_000 });

  const labels = [
    'เปิด Library Search',
    'Switch toolbar scope to group only',
    'Expand all',
    'Collapse all',
    'เปิด Import / Export',
    'Sort Library: Default',
    'Sort direction: Asc',
  ];

  const boxes = {};
  for (const targetLabel of labels) {
    boxes[targetLabel] = await expectTargetAtLeast(page, targetLabel);
  }

  if (label === 'mobile') {
    const duplicateAddButtonCount = await page.getByLabel('เพิ่มคำใหม่').count();
    if (duplicateAddButtonCount !== 0) {
      fail('mobile Browse should keep add-term only in bottom navigation', { duplicateAddButtonCount });
    }
  }

  await expectNoHorizontalOverflow(page, label);
  await context.close();

  return { label, viewport, boxes, consoleErrors };
}

const browser = await chromium.launch({ headless: true });

try {
  const results = [
    await checkBrowseToolbar({ width: 412, height: 628 }, 'mobile'),
    await checkBrowseToolbar({ width: 1365, height: 768 }, 'desktop'),
  ];
  const consoleErrors = results.flatMap((result) => result.consoleErrors);
  console.log(JSON.stringify({ baseUrl, minTouchTarget, results, consoleErrors }, null, 2));
  if (consoleErrors.length > 0) process.exitCode = 2;
} finally {
  await browser.close();
}
