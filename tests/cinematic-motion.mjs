import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3001';
const prefix = process.env.MOTION_PREFIX ?? 'atelier';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', recordVideo: { dir: 'docs/screenshots/motion', size: { width: 1440, height: 900 } } });
const page = await context.newPage();
try {
  await page.addInitScript(() => {
    window.immersivePhases = [];
    window.openingMilestones = [];
    window.lightStages = [];
    new MutationObserver(() => {
      const scene = document.querySelector('#scene');
      const phase = scene?.getAttribute('data-scene-state');
      if (phase && window.immersivePhases.at(-1)?.phase !== phase) window.immersivePhases.push({ phase, at: performance.now() });
      const canvas = scene?.querySelector('canvas');
      const stage = canvas?.getAttribute('data-intro-stage');
      if (stage && window.lightStages.at(-1)?.stage !== stage) {
        window.lightStages.push({ stage, glint: canvas.getAttribute('data-glint'), edge: canvas.getAttribute('data-edge-reveal'), opening: canvas.getAttribute('data-lid-opening'), at: performance.now() });
      }
      const opening = Number(scene?.getAttribute('data-open-amount'));
      if (phase === 'opening') {
        for (const threshold of [.01, .08, .25, .5, .75, .99]) {
          if (opening >= threshold && !window.openingMilestones.some(item => item.threshold === threshold)) {
            window.openingMilestones.push({ threshold, actualOpening: opening, at: performance.now() });
          }
        }
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-scene-state', 'data-open-amount', 'data-intro-stage'] });
  });
  // Settle Chrome's recording viewport before the measured replay. The first
  // screencast frames of a newly created page can have a smaller backing size.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/?scene=poster`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#scene')?.getAttribute('data-scene-state') === 'content');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'docs/screenshots/motion/viewport-warmup.png' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const replayAt = Date.now();
  await page.getByRole('button', { name: 'Повторить вступление' }).click();
  await page.waitForFunction(() => document.querySelector('#scene')?.getAttribute('data-scene-state') === 'opening');
  await page.waitForFunction(() => document.querySelector('#scene')?.getAttribute('data-scene-state') === 'content');
  // Capture continuously; screenshot encoding during the animation would perturb its timing.
  await page.waitForFunction(() => {
    const last = window.immersivePhases.at(-1);
    return last?.phase === 'content' && performance.now() - last.at > 1000;
  });
  const history = await page.evaluate(() => window.immersivePhases);
  const openingMilestones = await page.evaluate(() => window.openingMilestones);
  const lightStages = await page.evaluate(() => window.lightStages);
  await page.screenshot({ path: `docs/screenshots/${prefix}-motion-final.png`, style: 'nextjs-portal{display:none}' });
  const video = page.video();
  const endedAt = Date.now();
  await page.close();
  const raw = `docs/screenshots/motion/${prefix}-replay-untrimmed.webm`;
  await video.saveAs(raw);
  const ffmpeg = process.env.PLAYWRIGHT_FFMPEG ?? path.join(process.env.LOCALAPPDATA, 'ms-playwright/ffmpeg-1013/ffmpeg-win64.exe');
  const probe = spawnSync(ffmpeg, ['-i', raw], { encoding: 'utf8' });
  const durationMatch = probe.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!durationMatch) throw new Error(`Cannot determine recording duration: ${probe.stderr}`);
  const duration = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
  const trimStart = Math.max(0, duration - (endedAt - replayAt) / 1000 + .12);
  const trim = spawnSync(ffmpeg, ['-i', raw, '-ss', trimStart.toFixed(3), '-an', '-c:v', 'libvpx-vp9', '-crf', '22', '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '4', '-threads', '4', `docs/screenshots/${prefix}-opening.webm`, '-y', '-loglevel', 'error'], { encoding: 'utf8' });
  if (trim.status !== 0) throw new Error(`Recording trim failed: ${trim.stderr}`);
  await fs.writeFile(`docs/screenshots/${prefix}-motion-check.json`, JSON.stringify({ note: 'Actual continuous Chromium replay of opening and automatic HTML handoff after viewport warmup; only the warmup is trimmed, no animation timing is changed. Timings are observations, not an FPS measurement.', history, openingMilestones, lightStages, trimStart, rawDuration: duration }, null, 2));
  console.log({ history, openingMilestones, lightStages, trimStart, rawDuration: duration });
  const recordedStages = lightStages.map(item => item.stage);
  if (!['glint', 'edge', 'opening', 'ready', 'entering'].every(stage => recordedStages.includes(stage))) {
    console.error('A required rendered light stage was missed. Inspect the saved recording and stage observations.');
    process.exitCode = 1;
  }
} finally {
  await context.close();
  await browser.close();
}
