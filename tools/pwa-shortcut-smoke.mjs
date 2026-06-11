import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:8097';

function setupScript() {
  window.localStorage.setItem('nb.onboarded', 'true');
  window.__dispatchNbInstallPrompt = () => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperty(event, 'prompt', { value: async () => undefined });
    Object.defineProperty(event, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    window.dispatchEvent(event);
  };
}

function setupIosScript() {
  window.localStorage.setItem('nb.onboarded', 'true');
  Object.defineProperty(window.navigator, 'platform', { value: 'iPhone', configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true });
}

async function dispatchAfterSettle(page) {
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.localStorage.removeItem('nb.pwa-shortcut-nudge-dismissed');
    window.__dispatchNbInstallPrompt();
  });
}

function collectConsoleErrors(page, bucket) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      bucket.push({ url: page.url(), text: message.text() });
    }
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];

  try {
    const mobile = await browser.newPage({
      viewport: { width: 412, height: 844 },
      isMobile: true,
    });
    collectConsoleErrors(mobile, consoleErrors);
    await mobile.addInitScript(setupScript);

    await mobile.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await dispatchAfterSettle(mobile);
    await mobile.getByText('Pin Web App').first().waitFor({ state: 'visible', timeout: 15000 });
    await mobile.getByRole('button', { name: 'Pin Web App' }).first().waitFor({ state: 'visible', timeout: 15000 });

    await mobile.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle' });
    await dispatchAfterSettle(mobile);
    await mobile.getByText('WEB APP', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
    await mobile.getByRole('button', { name: 'Pin Web App' }).first().waitFor({ state: 'visible', timeout: 15000 });

    const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    collectConsoleErrors(desktop, consoleErrors);
    await desktop.addInitScript(setupScript);
    await desktop.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await dispatchAfterSettle(desktop);
    await desktop.waitForTimeout(750);
    const desktopCount = await desktop.getByText('Pin Web App').count();

    const ios = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    collectConsoleErrors(ios, consoleErrors);
    await ios.addInitScript(setupIosScript);
    await ios.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle' });
    await ios.getByRole('button', { name: 'Add to Home Screen' }).first().waitFor({ state: 'visible', timeout: 15000 });
    await ios.getByRole('button', { name: 'Add to Home Screen' }).first().click();
    await ios.getByText('Safari keeps web apps through the Share menu.').waitFor({ state: 'visible', timeout: 15000 });

    if (desktopCount !== 0 || consoleErrors.length > 0) {
      console.log(JSON.stringify({ desktopCount, consoleErrors }, null, 2));
      process.exitCode = 1;
      return;
    }

    console.log(JSON.stringify({
      baseUrl,
      mobileBrowse: 'ok',
      mobileSettings: 'ok',
      iosInstructions: 'ok',
      desktopHidden: true,
      consoleErrors: 0,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
