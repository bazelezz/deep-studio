import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({reducedMotion:'reduce',deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const layouts=[];
try{
 for(const [name,width,height] of [['desktop',1440,900],['narrow',623,844],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  await page.goto(`${base}/?scene=poster`,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`docs/screenshots/concept-${name}-hero.png`});
  await page.screenshot({path:`docs/screenshots/concept-${name}-full.png`,fullPage:true});
  layouts.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll('h1,h2,h3')].filter(h=>h.scrollWidth>h.clientWidth+2).map(h=>h.textContent)})));
 }
 console.log(JSON.stringify({layouts,errors},null,2));
 await fs.writeFile('docs/screenshots/concept-layout.json',JSON.stringify({layouts,errors},null,2));
}finally{await browser.close()}

