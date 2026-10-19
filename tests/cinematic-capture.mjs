import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3001';
const sizes = (process.env.CAPTURE_SIZES ?? 'desktop,tablet,mobile').split(',');
const states = (process.env.CAPTURE_STATES ?? 'closed,half,ready,entering,content').split(',');
await fs.mkdir('docs/screenshots', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 623, 844], ['mobile', 390, 844]]) {
    if (!sizes.includes(name)) continue;
    await page.setViewportSize({ width, height });
    for (const state of states) {
      const query = state === 'content' ? 'poster' : state;
      await page.goto(`${base}/?scene=${query}`, { waitUntil: 'networkidle' });
      const phase = state === 'content' ? 'content' : state === 'entering' ? 'entering' : 'ready';
      await page.waitForFunction(expected => document.querySelector('#scene')?.getAttribute('data-scene-state') === expected, phase);
      if (state !== 'content') {
        await page.waitForFunction(() => {
          const poster = document.querySelector('#scene picture')?.parentElement;
          return !poster || Number(getComputedStyle(poster).opacity) < .01;
        });
      }
      await page.screenshot({ path: `docs/screenshots/immersive-${name}-${state}.png`, style: 'nextjs-portal{display:none}' });
      console.log(JSON.stringify(await page.evaluate(({ name, state }) => {
        const display = document.querySelector('[data-display-site]').parentElement;
        return { name, state, width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, canvas: document.querySelectorAll('#scene canvas').length, transform: getComputedStyle(display).transform };
      }, { name, state })));
    }
  }
} finally {
  await browser.close();
}
console.log({ errors });
