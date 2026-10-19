import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const report = [];
try {
  const page = await browser.newPage({ reducedMotion: 'reduce', deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 623, 844], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:3001/?scene=poster', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.querySelector('#scene')?.getAttribute('data-scene-state') === 'content');
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    for (const section of ['approach', 'services', 'projects', 'contact']) {
      const element = page.locator(`#${section}`);
      await element.scrollIntoViewIfNeeded();
      if (section === 'contact') console.log(name, await page.evaluate(() => ({ focus: document.activeElement?.outerHTML.slice(0, 120), skip: document.querySelector('.skip-link')?.getBoundingClientRect().toJSON(), transform: getComputedStyle(document.querySelector('.skip-link')).transform })));
      if (section === 'contact') await page.screenshot({ path: `docs/screenshots/editorial-${name}-contact-viewport.png`, style: 'nextjs-portal{display:none}.skip-link:not(:focus){visibility:hidden}' });
      await element.screenshot({ path: `docs/screenshots/editorial-${name}-${section}.png`, style: 'nextjs-portal{display:none}.skip-link:not(:focus){visibility:hidden}' });
    }
    report.push(await page.evaluate((name) => ({ name, viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, sections: [...document.querySelectorAll('#approach,#services,#projects,#contact')].map(node => ({ id: node.id, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })) }), name));
    await page.locator('[data-service="company"]').click();
    await page.waitForFunction(() => document.querySelector('#project-service')?.value === 'company');
  }
} finally {
  await browser.close();
}
await fs.writeFile('docs/screenshots/editorial-review.json', JSON.stringify({ errors, report }, null, 2));
console.log(JSON.stringify({ errors, report }, null, 2));
if (errors.length || report.some(item => item.overflow)) process.exitCode = 1;
