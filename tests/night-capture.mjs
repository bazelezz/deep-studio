import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Visual evidence, not an FPS benchmark. Run against the same server as QA.
const base = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const output = 'docs/screenshots';
const shotStyle = '.skip-link:not(:focus){visibility:hidden}nextjs-portal{display:none}';
const results = [];
const errors = [];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function settle(page) {
  await page.waitForFunction(() => {
    const phase = document.querySelector('#scene')?.getAttribute('data-scene-state');
    return phase === 'ready' || phase === 'fallback' || phase === 'reduced-motion';
  }, null, { timeout: 12_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const scene = document.querySelector('#scene');
    if (scene?.getAttribute('data-scene-state') === 'fallback') return true;
    const canvas = scene?.querySelector('canvas');
    const wrapper = scene?.firstElementChild?.children[1];
    return !!canvas && !!wrapper && Number(getComputedStyle(wrapper).opacity) >= .99;
  }, null, { timeout: 4_000 });
}

async function capture(page, name, options = {}) {
  await page.screenshot({ path: `${output}/night-${name}.png`, style: shotStyle, ...options });
  results.push(await page.evaluate((label) => {
    const rect = (node) => {
      if (!node) return null;
      const { x, y, width, height, bottom } = node.getBoundingClientRect();
      return { x, y, width, height, bottom };
    };
    const scene = document.querySelector('#scene');
    const canvas = scene?.querySelector('canvas');
    const stage = scene?.firstElementChild;
    const h2 = scene?.querySelector('h2');
    return {
      name: label,
      viewport: { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.clientWidth },
      overflow: document.documentElement.scrollWidth > innerWidth,
      phase: scene?.getAttribute('data-scene-state'),
      hasCanvas: !!canvas,
      canvasPixels: canvas ? { width: canvas.width, height: canvas.height } : null,
      canvas: rect(canvas),
      hero: rect(document.querySelector('.hero-copy')),
      stage: rect(stage),
      projectedDisplay: rect(h2?.parentElement),
      handoffOpacity: h2 ? getComputedStyle(h2.parentElement.parentElement).opacity : null,
      scrollY,
      documentHeight: document.documentElement.scrollHeight,
    };
  }, name));
}

async function travel(page, progress) {
  await page.evaluate((value) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const root = document.querySelector('#scene');
    const stage = root.firstElementChild;
    window.scrollTo(0, root.getBoundingClientRect().top + scrollY + (root.offsetHeight - stage.offsetHeight) * value);
  }, progress);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  page.on('pageerror', error => errors.push({ url: page.url(), message: error.message }));
  for (const state of ['ready', 'closed', 'half']) {
    await page.goto(`${base}/?scene=${state}`, { waitUntil: 'networkidle' });
    await settle(page);
    await capture(page, `desktop-${state}`);
    await page.locator('#scene > div').first().screenshot({ path: `${output}/night-model-${state}.png`, style: `${shotStyle}[class*="sceneCaption"],[class*="status"]{visibility:hidden}` });
  }
  for (const width of [390, 623]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/?scene=ready`, { waitUntil: 'networkidle' });
    await settle(page);
    await capture(page, `${width}-ready`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base, { waitUntil: 'networkidle' });
  await settle(page);
  await capture(page, 'desktop-live');
  for (const progress of [.5, .875, 1]) {
    await travel(page, progress);
    await capture(page, `enter-${String(progress).replace('.', '-')}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  await page.locator('img').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
  await page.evaluate(() => Promise.all(Array.from(document.images).map(image => image.decode().catch(() => {}))));
  await capture(page, 'desktop-full', { fullPage: true });
  await page.goto(`${base}/?scene=poster`, { waitUntil: 'networkidle' });
  await settle(page);
  await capture(page, 'fallback');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base, { waitUntil: 'networkidle' });
  await settle(page);
  await capture(page, 'reduced-motion');
} finally {
  await fs.writeFile(`${output}/night-metrics.json`, JSON.stringify({ base, capturedAt: new Date().toISOString(), results, errors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ captures: results.length, errors, overflowing: results.filter(result => result.overflow).map(result => result.name) }, null, 2));
