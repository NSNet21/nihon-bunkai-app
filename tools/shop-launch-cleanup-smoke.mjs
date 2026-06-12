import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:8097';
const maxCenterDelta = 3;
const maxPaddingImbalance = 4;
const maxMobilePerLevelCardHeight = 124;
const maxMobileBundleCardHeight = 140;

function fail(message, details = {}) {
  const error = new Error(`${message}\n${JSON.stringify(details, null, 2)}`);
  error.details = details;
  throw error;
}

async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  if (overflow !== 0) fail(`${label}: horizontal overflow`, { overflow });
}

async function centerDelta(locator, childSelector = null) {
  const state = await locator.evaluate((node, selector) => {
    const box = node.getBoundingClientRect();
    const targets = selector ? [...node.querySelectorAll(selector)] : [...node.children];
    const visible = targets
      .map((child) => child.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (visible.length === 0) return null;
    const left = Math.min(...visible.map((rect) => rect.left));
    const right = Math.max(...visible.map((rect) => rect.right));
    return {
      buttonCenter: box.left + box.width / 2,
      contentCenter: left + (right - left) / 2,
      delta: Math.abs((box.left + box.width / 2) - (left + (right - left) / 2)),
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      content: { left, right, width: right - left },
      padding: {
        left: left - box.left,
        right: box.right - right,
        top: Math.min(...visible.map((rect) => rect.top)) - box.top,
        bottom: box.bottom - Math.max(...visible.map((rect) => rect.bottom)),
      },
    };
  }, childSelector);
  if (!state) fail('Could not measure segmented-control content center');
  return state;
}

async function checkShop(viewport, label) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    localStorage.setItem('nb.onboarded', 'true');
    localStorage.setItem('nb.theme-override', JSON.stringify('dark'));
    localStorage.setItem('nb.shop-view-mode', JSON.stringify('grid'));
    localStorage.setItem('nb.shop-tier', JSON.stringify('bundle'));
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(new URL('/shop', baseUrl).toString(), { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByText('// CONTENT-BASED · จ่ายตามใช้').waitFor({ timeout: 30_000 });
  await page.getByLabel('เลือก BUNDLE').waitFor({ timeout: 15_000 });

  let mobileCardHeights = null;
  if (viewport.width < 600) {
    const perLevelCard = page
      .getByText('N4 PDF', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"css-view")][.//text()[contains(.,"ซื้อที่ Payhip")]][1]');
    const perLevelHeight = await perLevelCard.evaluate((node) => node.getBoundingClientRect().height);
    if (perLevelHeight > maxMobilePerLevelCardHeight) {
      fail('Mobile per-level product card should stay compact enough for catalog scanning', {
        perLevelHeight,
        maxMobilePerLevelCardHeight,
      });
    }
    mobileCardHeights = { perLevelHeight };
  }

  await page.getByLabel('เลือก BUNDLE').click();
  await page.getByText('Full Bundle', { exact: true }).waitFor({ timeout: 15_000 });

  if (viewport.width < 600) {
    const bundleCard = page
      .getByText('PDF Bundle', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"css-view")][.//text()[contains(.,"ซื้อที่ Payhip")]][1]');
    const bundleHeight = await bundleCard.evaluate((node) => node.getBoundingClientRect().height);
    if (bundleHeight > maxMobileBundleCardHeight) {
      fail('Mobile bundle product card should stay compact enough for catalog scanning', {
        bundleHeight,
        maxMobileBundleCardHeight,
      });
    }
    mobileCardHeights = { ...mobileCardHeights, bundleHeight };
  }

  const staleFirstEditionCopy = await page.evaluate(() => {
    const body = document.body.innerText;
    return ['First Edition', 'LIMITED 75', '฿3,290'].filter((text) => body.includes(text));
  });
  if (staleFirstEditionCopy.length > 0) {
    fail('Shop should not expose deferred First Edition launch copy', { staleFirstEditionCopy });
  }

  const perLevel = await centerDelta(page.getByLabel('เลือก PER LEVEL').first());
  const bundle = await centerDelta(page.getByLabel('เลือก BUNDLE').first());
  const tierImbalance = [
    Math.abs(perLevel.padding.left - perLevel.padding.right),
    Math.abs(perLevel.padding.top - perLevel.padding.bottom),
    Math.abs(bundle.padding.left - bundle.padding.right),
    Math.abs(bundle.padding.top - bundle.padding.bottom),
  ];
  if (perLevel.delta > maxCenterDelta || bundle.delta > maxCenterDelta || tierImbalance.some((value) => value > maxPaddingImbalance)) {
    fail('Tier Toggle content should have balanced optical padding inside each segment', {
      perLevel,
      bundle,
      maxCenterDelta,
      maxPaddingImbalance,
      tierImbalance,
    });
  }

  let viewToggle = null;
  if (viewport.width >= 600) {
    const switchToList = page.getByLabel('Switch to List view').first();
    await switchToList.waitFor({ timeout: 15_000 });
    const grid = await centerDelta(switchToList, 'svg, [dir="auto"]');
    await switchToList.click();
    const switchToGrid = page.getByLabel('Switch to Grid view').first();
    await switchToGrid.waitFor({ timeout: 15_000 });
    await page.waitForTimeout(250);
    const list = await centerDelta(switchToGrid, 'svg, [dir="auto"]');
    viewToggle = { list, grid };
    const viewImbalance = [
      Math.abs(list.padding.left - list.padding.right),
      Math.abs(list.padding.top - list.padding.bottom),
      Math.abs(grid.padding.left - grid.padding.right),
      Math.abs(grid.padding.top - grid.padding.bottom),
    ];
    if (list.delta > maxCenterDelta || grid.delta > maxCenterDelta || viewImbalance.some((value) => value > maxPaddingImbalance)) {
      fail('View Toggle content should have balanced optical padding inside the single mode button', {
        list,
        grid,
        maxCenterDelta,
        maxPaddingImbalance,
        viewImbalance,
      });
    }
  }

  await expectNoHorizontalOverflow(page, label);
  await context.close();
  return { label, viewport, consoleErrors, perLevel, bundle, viewToggle, mobileCardHeights };
}

const browser = await chromium.launch({ headless: true });

try {
  const results = [
    await checkShop({ width: 412, height: 628 }, 'shop-mobile'),
    await checkShop({ width: 1365, height: 768 }, 'shop-desktop'),
  ];
  const consoleErrors = results.flatMap((result) => result.consoleErrors);
  console.log(JSON.stringify({
    baseUrl,
    maxCenterDelta,
    maxPaddingImbalance,
    maxMobilePerLevelCardHeight,
    maxMobileBundleCardHeight,
    results,
    consoleErrors,
  }, null, 2));
  if (consoleErrors.length > 0) process.exitCode = 2;
} finally {
  await browser.close();
}
