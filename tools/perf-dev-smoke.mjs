import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const port = Number(process.argv[2] || 8097);
const target = `http://localhost:${port}`;
const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm';
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', `pnpm.cmd run dev -- --port ${port}`]
  : ['run', 'dev', '--', '--port', String(port)];

function now() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

async function probe() {
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(2_000) });
    return response.status;
  } catch {
    return null;
  }
}

function stopTree(child) {
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

async function measureRoute(page, route) {
  const warnings = [];
  const errors = [];
  const onConsole = (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
    if (message.type() === 'error') errors.push(message.text());
  };
  page.on('console', onConsole);

  const started = now();
  await page.goto(`${target}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const domcontentloadedMs = now() - started;
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => null);
  const settledMs = now() - started;
  const text = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');

  page.off('console', onConsole);
  return {
    route,
    domcontentloadedMs,
    settledMs,
    warningCount: warnings.length,
    errorCount: errors.length,
    warnings: warnings.slice(0, 5),
    errors: errors.slice(0, 5),
    bodyTextLength: text.length,
  };
}

async function measureSearch(page) {
  const started = now();
  await page.goto(`${target}/search`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('input[placeholder*="คำญี่ปุ่น"]', { timeout: 30_000 });
  const inputReadyMs = now() - started;

  const typeStarted = now();
  await page.click('input[placeholder*="คำญี่ปุ่น"]');
  await page.keyboard.type('去年');
  await page.waitForTimeout(700);
  const state = await page.evaluate(() => ({
    inputValue: document.querySelector('input[placeholder*="คำญี่ปุ่น"]')?.value ?? '',
    visibleText: document.body.innerText.slice(0, 500),
  }));

  return {
    inputReadyMs,
    queryFeedbackMs: now() - typeStarted,
    inputValue: state.inputValue,
    visibleTextSample: state.visibleText,
  };
}

const child = spawn(command, args, {
  cwd: process.cwd(),
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

const started = now();
let readyMs = null;
let status = null;
for (let i = 0; i < 150; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  status = await probe();
  if (status) {
    readyMs = now() - started;
    break;
  }
}

const result = {
  target,
  readyMs,
  status,
  routes: [],
  search: null,
  stdoutTail: stdout.slice(-1200),
  stderrTail: stderr.slice(-1200),
};

try {
  if (readyMs !== null) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.addInitScript(() => localStorage.setItem('nb.onboarded', 'true'));
    for (const route of ['/', '/search', '/shop', '/settings']) {
      result.routes.push(await measureRoute(page, route));
    }
    result.search = await measureSearch(page);
    await browser.close();
  }
} finally {
  stopTree(child);
}

console.log(JSON.stringify(result, null, 2));
