import { chromium } from 'playwright';

const target =
  process.argv[2] || 'http://localhost:8097/deck/kanji-n5-pack02/term/kanji-n5-pack02-21';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 446, height: 628 },
  deviceScaleFactor: 1,
});

const messages = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    messages.push(`${message.type()}: ${message.text()}`);
  }
});

await page.addInitScript(() => {
  localStorage.setItem('nb.onboarded', 'true');
});

await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
await page.waitForSelector('[aria-label="แตะเพื่อดูคำตอบ"], [aria-label="แตะเพื่อกลับด้านหน้า"]', {
  timeout: 25_000,
});

async function swipeLeft() {
  const card = page.locator('[aria-label="แตะเพื่อดูคำตอบ"], [aria-label="แตะเพื่อกลับด้านหน้า"]').first();
  const box = await card.boundingBox();
  if (!box) throw new Error('missing card box');

  const y = box.y + box.height * 0.55;
  await page.mouse.move(box.x + box.width * 0.72, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.22, y, { steps: 3 });
  await page.mouse.up();
}

for (let i = 0; i < 12; i += 1) {
  await swipeLeft();
  await page.waitForTimeout(45);
}

await page.waitForTimeout(900);

const cardState = await page.evaluate(() => {
  const el = document.querySelector('[aria-label="แตะเพื่อดูคำตอบ"], [aria-label="แตะเพื่อกลับด้านหน้า"]');
  const rect = el?.getBoundingClientRect();
  const text = document.body.innerText;
  return {
    href: location.pathname,
    hasCard: Boolean(el),
    rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    hasCardMeta: text.includes('CARD'),
    hasTermMeta: text.includes('TERM'),
  };
});

const beforeNavHref = cardState.href;
await page.getByLabel('คำถัดไป').click({ timeout: 10_000 });
await page.waitForTimeout(300);
const afterNavHref = await page.evaluate(() => location.pathname);
const navNextWorked = afterNavHref !== beforeNavHref;

await page.getByLabel('ตั้งค่าการแสดงผลการ์ด').click({ timeout: 10_000 });
await page.waitForTimeout(250);
const configOpened = await page
  .getByText('CARD DISPLAY')
  .or(page.getByText('FRONT'))
  .first()
  .isVisible()
  .catch(() => false);

await page.getByLabel('ปิดการตั้งค่าการแสดงผลการ์ด').click({ timeout: 10_000 });
await page.waitForTimeout(150);

await page.getByLabel('เปิดเมนูคำนี้').click({ timeout: 10_000 });
await page.waitForTimeout(250);
const actionsOpened = await page.getByText('TERM ACTIONS').isVisible().catch(() => false);
await page.getByRole('button', { name: 'ปิดเมนู', exact: true }).click({ timeout: 10_000 });
await page.waitForTimeout(150);

await page.getByLabel('เปิดเมนูคำนี้').click({ timeout: 10_000 });
await page.waitForTimeout(150);
await page.getByLabel('สลับ deck').click({ timeout: 10_000 });
await page.waitForTimeout(150);
await page.getByLabel('สลับไป Kanji N5 · Pack 03').click({ timeout: 10_000 });
await page.waitForTimeout(80);
const deckMotionSample = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="term-card-motion-slot"]');
  if (!el) return null;
  const style = getComputedStyle(el);
  return {
    opacity: Number(style.opacity),
    transform: style.transform,
  };
});
await page.waitForTimeout(520);
const deckSwitchState = await page.evaluate(() => ({
  href: location.pathname,
  hasCard: Boolean(document.querySelector('[aria-label="แตะเพื่อดูคำตอบ"], [aria-label="แตะเพื่อกลับด้านหน้า"]')),
  text: document.body.innerText.slice(0, 500),
}));
const deckMotionWorked = Boolean(
  deckMotionSample &&
    (deckMotionSample.opacity < 0.98 ||
      (deckMotionSample.transform && deckMotionSample.transform !== 'none')),
);
const deckSwitchWorked =
  deckSwitchState.href.includes('/deck/kanji-n5-pack03/term/') &&
  deckSwitchState.hasCard &&
  deckSwitchState.text.includes('CARD 01');

await page.getByLabel('กลับไปหน้าก่อนหน้า').click({ timeout: 10_000 });
await page.waitForTimeout(300);
const backHref = await page.evaluate(() => location.pathname);
const backWorked = backHref === '/deck/kanji-n5-pack03';

await browser.close();

const result = {
  target,
  cardState,
  navNextWorked,
  afterNavHref,
  configOpened,
  actionsOpened,
  deckMotionSample,
  deckMotionWorked,
  deckSwitchWorked,
  deckSwitchHref: deckSwitchState.href,
  backWorked,
  backHref,
  warnings: messages.filter((line) => line.startsWith('warning:')).slice(0, 10),
  errors: messages.filter((line) => line.startsWith('error:')).slice(0, 10),
};

console.log(JSON.stringify(result, null, 2));

if (!cardState.hasCard || !cardState.hasCardMeta || !cardState.hasTermMeta) {
  throw new Error('term card disappeared after rapid swipes');
}
if (!navNextWorked) {
  throw new Error('next button did not navigate on first click after rapid swipes');
}
if (!configOpened) {
  throw new Error('config button did not open on first click after rapid swipes');
}
if (!actionsOpened) {
  throw new Error('actions button did not open on first click after rapid swipes');
}
if (!deckMotionWorked) {
  throw new Error('deck switch card motion did not start after selecting a new deck');
}
if (!deckSwitchWorked) {
  throw new Error('deck switch did not show the first card of the selected deck');
}
if (!backWorked) {
  throw new Error('back button did not navigate on first click after rapid swipes');
}
if (result.errors.length > 0) {
  throw new Error('console errors detected during term card regression smoke');
}
