/**
 * Rasterize the v2 app-icon SVGs into the PNG assets that Expo /
 * companion-app consumes. Uses Playwright headless Chromium so that
 * Oswald + Noto Serif JP load from Google Fonts CDN at render time —
 * no local font install required, no font-to-path conversion needed.
 *
 * Usage:  cd companion-app && node tools/rasterize-app-icon.mjs
 *
 * Outputs (relative to companion-app/):
 *   assets/images/icon.png                       (1024×1024, master)
 *   assets/images/favicon.png                    ( 192×192,  master)
 *   assets/images/splash-icon.png                ( 200×200,  splash)
 *   assets/images/android-icon-background.png    ( 432×432,  android-bg)
 *   assets/images/android-icon-foreground.png    ( 432×432,  android-fg)
 *   assets/images/android-icon-monochrome.png    ( 432×432,  android-mono)
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SVG_DIR   = resolve(__dirname, '../../design/app-icon-brief');
const ASSET_DIR = resolve(__dirname, '../assets/images');

/** (svg filename, target size px, output filename) tuples. */
const TARGETS = [
  { svg: 'master.svg',                     size: 1024, out: 'icon.png' },
  { svg: 'master.svg',                     size:  192, out: 'favicon.png' },
  { svg: 'derive-splash.svg',              size:  200, out: 'splash-icon.png' },
  { svg: 'derive-android-background.svg',  size:  432, out: 'android-icon-background.png' },
  { svg: 'derive-android-foreground.svg',  size:  432, out: 'android-icon-foreground.png' },
  { svg: 'derive-android-monochrome.svg',  size:  432, out: 'android-icon-monochrome.png' },
  /* PWA install card + iOS "Add to Home Screen". Files exist as
     ready-to-wire assets; manifest plumbing can land in a follow-up
     commit (Expo's static export does not auto-emit `apple-touch-icon`
     or `manifest.json` references today, so these PNGs are unused
     until a `+html.tsx` injects the link tags). */
  { svg: 'derive-maskable.svg',            size:  512, out: 'maskable-icon.png' },
  { svg: 'derive-apple-touch.svg',         size:  180, out: 'apple-touch-icon.png' },
];

/**
 * Wrap an SVG in an HTML shell that loads Oswald + Noto Serif JP via
 * Google Fonts CDN before render. font-display: block forces text to
 * stay hidden until the actual font arrives — avoids fallback flash
 * baked into the PNG.
 */
function wrap(svgContent, size) {
  // Force the inline svg to render at exact `size` square.
  const sized = svgContent.replace(
    /<svg([^>]*)>/,
    (_m, attrs) => {
      const stripped = attrs.replace(/\s(width|height)="[^"]*"/g, '');
      return `<svg${stripped} width="${size}" height="${size}">`;
    },
  );
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@500&family=Oswald:wght@700&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body { width: ${size}px; height: ${size}px; }
  svg { display: block; }
</style></head><body>${sized}
<script>
  // Signal when fonts have actually loaded so Playwright knows the
  // screenshot will include the right type, not the fallback flash.
  document.fonts.ready.then(() => {
    document.documentElement.setAttribute('data-fonts', 'ready');
  });
</script></body></html>`;
}

const browser = await chromium.launch();
try {
  const ctx  = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  for (const { svg, size, out } of TARGETS) {
    const svgContent = readFileSync(resolve(SVG_DIR, svg), 'utf8');
    const html       = wrap(svgContent, size);

    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html, { waitUntil: 'load' });
    // Wait for Google Fonts to actually load before screenshotting.
    await page.waitForSelector('html[data-fonts="ready"]', { timeout: 15_000 });
    // Tiny settle frame so the swap-in is fully painted.
    await page.waitForTimeout(120);

    const buf = await page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
      type: 'png',
    });
    const outPath = resolve(ASSET_DIR, out);
    writeFileSync(outPath, buf);
    console.log(`  ✓ ${out.padEnd(34)} ${size}×${size}  (from ${svg})`);
  }
} finally {
  await browser.close();
}
