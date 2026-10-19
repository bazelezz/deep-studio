import { chromium } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs/promises';

// Render the very same local geometry for the no-WebGL and first-paint versions.
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  for (const [name, width, height] of [['desktop',1440,900], ['tablet',623,844], ['mobile',390,844]]) {
    await page.setViewportSize({ width, height });
    for (const state of ['closed','ready']) {
      await page.goto(`${base}/?scene=${state}`);
      await page.waitForFunction(() => document.querySelector('#scene')?.dataset.sceneState === 'ready', null, { timeout: 10000 });
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#scene canvas').parentElement.parentElement).opacity) === 1);
      const buffer = await page.locator('#scene canvas').screenshot({ style: '#scene [class*=sceneCaption], #scene [class*=status] { visibility:hidden }' });
      await fs.writeFile(`public/images/laptop-${name}-${state}.webp`, await sharp(buffer).webp({ quality: 92 }).toBuffer());
    }
  }
} finally { await browser.close(); }
console.log('Six local scene posters rendered.');
