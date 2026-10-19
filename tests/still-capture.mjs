import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3001';
const output = 'docs/screenshots';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const metrics = [];
const errors = [];
const page = await browser.newPage({ deviceScaleFactor: 1 });
page.on('pageerror', error => errors.push(error.message));
try {
  for (const [name, width, height] of [['desktop',1440,900],['623',623,844],['mobile',390,844]]) {
    await page.setViewportSize({width,height});
    await page.goto(base, {waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('#scene')?.getAttribute('data-scene-state')==='ready');
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=> {
      const container = document.querySelector('#scene [class*="canvasReady"]');
      const poster = document.querySelector('#scene picture')?.parentElement;
      return container && poster && Number(getComputedStyle(container).opacity) > .99 && Number(getComputedStyle(poster).opacity)<.01;
    });
    await page.screenshot({path:`${output}/still-${name}.png`,style:'nextjs-portal{display:none}'});
    metrics.push(await page.evaluate(()=>({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
      state:document.querySelector('#scene').getAttribute('data-scene-state'),canvas:document.querySelectorAll('canvas').length,
      hero:document.querySelector('.hero-copy').getBoundingClientRect().toJSON(),scene:document.querySelector('#scene').getBoundingClientRect().toJSON()})));
    if (process.env.CAPTURE_POSTERS === '1') {
      const buffer=await page.locator('#scene>div').first().screenshot({style:'[class*="copyOverlay"],[class*="sceneCaption"],[class*="status"]{visibility:hidden}nextjs-portal{display:none}'});
      await sharp(buffer).webp({quality:91}).toFile(`public/images/laptop-still-${name==='623'?'tablet':name}.webp`);
    }
  }
} finally { await browser.close(); }
await fs.writeFile(`${output}/still-metrics.json`,JSON.stringify({base,metrics,errors},null,2));
console.log(JSON.stringify({metrics,errors},null,2));
