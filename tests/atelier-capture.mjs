import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Actual screenshots of the running WebGL scene. No rendered substitutes,
// compositing, resizing, or visual corrections are applied to these images.
const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3001';
const prefix = process.env.CAPTURE_PREFIX ?? 'atelier';
const sizes = (process.env.CAPTURE_SIZES ?? 'desktop,tablet,mobile').split(',');
const states = (process.env.CAPTURE_STATES ?? 'closed,glint,edge,gap,half,ready').split(',');
const output = 'docs/screenshots';
const capturePosters = process.env.CAPTURE_POSTERS === '1';
await fs.mkdir(output, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const errors = [];
const frames = [];
page.on('pageerror', error => errors.push(error.message));
const screenshotStyle = 'nextjs-portal{display:none}';

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
          const canvas = document.querySelector('#scene canvas');
          const poster = document.querySelector('#scene picture')?.parentElement;
          return canvas && (!poster || Number(getComputedStyle(poster).opacity) < .01);
        });
      }
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const path = `${output}/${prefix}-${name}-${state}.png`;
      await page.screenshot({ path, style: screenshotStyle });
      if (capturePosters && state === 'closed') {
        const { default: sharp } = await import('sharp');
        await fs.mkdir('public/images', { recursive: true });
        const screenshot = await page.locator('#scene').screenshot({
          style: `${screenshotStyle} [class*="status"]{visibility:hidden!important}`,
        });
        await sharp(screenshot).webp({ quality: 90 }).toFile(`public/images/atelier-${name}-closed.webp`);
      }
      const frame = await page.evaluate(({ name, state, path }) => {
        const root = document.querySelector('#scene');
        const canvas = root?.querySelector('canvas');
        const display = document.querySelector('[data-display-site]')?.parentElement;
        const bounds = display?.getBoundingClientRect();
        const context = canvas?.getContext('webgl2');
        return {
          name, state, path, width: innerWidth, height: innerHeight,
          overflow: document.documentElement.scrollWidth > innerWidth,
          phase: root?.getAttribute('data-scene-state'),
          opening: root?.getAttribute('data-open-amount'),
          lightStage: canvas?.getAttribute('data-intro-stage'),
          glint: canvas?.getAttribute('data-glint'),
          edgeReveal: canvas?.getAttribute('data-edge-reveal'),
          canvas: !!canvas,
          webgl: !!context && !context.isContextLost(),
          canvasPixels: canvas ? [canvas.width, canvas.height] : null,
          display: bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, bottom: bounds.bottom } : null,
          opacity: display ? getComputedStyle(display).opacity : null,
          transform: display ? getComputedStyle(display).transform : null,
        };
      }, { name, state, path });
      frames.push(frame);
      console.log(JSON.stringify(frame));
      if (name === 'desktop' && state === 'ready' && frame.display) {
        const rect = frame.display;
        const x = Math.max(0, Math.floor(rect.x - rect.width * .1));
        const right = Math.min(width, Math.ceil(rect.x + rect.width * 1.1));
        const y = Math.max(0, Math.floor(rect.y - 20));
        const bottom = Math.min(height, Math.ceil(rect.bottom + rect.width * .32));
        await page.screenshot({
          path: `${output}/${prefix}-desktop-device-detail.png`,
          clip: { x, y, width: right - x, height: bottom - y },
          style: screenshotStyle,
        });
        const keyboardY = Math.max(0, Math.floor(rect.bottom - 28));
        await page.screenshot({
          path: `${output}/${prefix}-desktop-keyboard-detail.png`,
          clip: { x, y: keyboardY, width: right - x, height: bottom - keyboardY },
          style: screenshotStyle,
        });
      }
    }
  }
} finally {
  await browser.close();
}

await fs.writeFile(`${output}/${prefix}-capture-check.json`, JSON.stringify({
  note: 'Unaltered browser screenshots. Detail images are native-pixel crops. Chrome uses software WebGL for reproducible QA; no hardware FPS or performance claim is implied.',
  base, frames, errors,
}, null, 2));
console.log(JSON.stringify({ frames: frames.length, errors }));
if (errors.length || frames.some(frame => frame.overflow || (frame.state !== 'content' && !frame.webgl))) process.exitCode = 1;
