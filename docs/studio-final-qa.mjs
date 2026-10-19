import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3000';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  for (const [name, width, height, state] of [
    ['laptop', 1440, 900, 'ready'],
    ['light-study', 1440, 900, 'poster'],
    ['narrow', 623, 850, 'poster'],
    ['mobile', 390, 844, 'poster'],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}/?scene=${state}`);
    await page.waitForFunction(expected => document.querySelector('#scene')?.dataset.sceneState === expected,
      state === 'poster' ? 'content' : 'ready');
    await page.evaluate(() => document.fonts.ready);
    if (state === 'poster') {
      await page.locator('[data-light-study][data-material="56"]').waitFor();
      await page.waitForTimeout(150);
    } else {
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `docs/screenshots/studio-final-${name}.png` });
    console.log(name, await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      canvases: document.querySelectorAll('canvas').length,
      state: document.querySelector('#scene')?.getAttribute('data-scene-state'),
      material: document.querySelector('[data-light-study]')?.getAttribute('data-material'),
    })));
  }
  console.log('page errors', errors);
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
