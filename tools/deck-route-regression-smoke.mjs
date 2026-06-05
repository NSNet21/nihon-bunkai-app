import { chromium } from 'playwright';

const target = process.env.APP_URL || process.argv[2] || 'http://localhost:8097';

function urlFor(route) {
  return new URL(route, target).toString();
}

async function assertNoInitialDeckTermListFlicker(page) {
  const forbidden = ['ทั้งหมด 0 / 0 คำ', 'ไม่พบคำที่ตรงกับการค้นหา'];
  const seen = [];

  await page.goto(urlFor('/deck/vocab-n5-pack03'), { waitUntil: 'domcontentloaded', timeout: 45_000 });

  const started = Date.now();
  while (Date.now() - started < 2_000) {
    const body = await page.locator('body').innerText({ timeout: 5_000 });
    for (const phrase of forbidden) {
      if (body.includes(phrase)) {
        throw new Error(`Deck Term List showed pre-load empty state: ${phrase}`);
      }
    }
    seen.push(body.includes('ทั้งหมด 20 / 20 คำ') && body.includes('七つ'));
    if (seen.at(-1)) break;
    await page.waitForTimeout(100);
  }

  await page.getByText('ทั้งหมด 20 / 20 คำ', { exact: false }).waitFor({ timeout: 15_000 });
  await page.getByText('七つ', { exact: false }).first().waitFor({ timeout: 15_000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const warnings = [];
  const errors = [];

  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.addInitScript(() => {
    localStorage.setItem('nb.onboarded', 'true');
  });

  await assertNoInitialDeckTermListFlicker(page);

  const result = {
    target,
    route: '/deck/vocab-n5-pack03',
    deckTermListNoEmptyFlicker: true,
    warningCount: warnings.length,
    errorCount: errors.length,
    warnings,
    errors,
  };

  console.log(JSON.stringify(result, null, 2));
  await browser.close();

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

void main();
