import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
try {
 await page.goto('http://127.0.0.1:3000/?scene=ready');
 await page.waitForFunction(()=>document.querySelector('#scene')?.dataset.sceneState==='ready');
 await page.waitForTimeout(500);
 await page.screenshot({path:'docs/screenshots/film-final-laptop.png'});
 await page.goto('http://127.0.0.1:3000/?scene=poster');
 await page.waitForFunction(()=>document.querySelector('#motion')?.dataset.enhanced==='true');
 for(const [name,p] of [['landing',.16],['company',.43],['custom',.68],['individual',1]]) {
  await page.locator('#motion').evaluate((el,progress)=>scrollTo({top:el.getBoundingClientRect().top+scrollY+(el.clientHeight-innerHeight)*progress,behavior:'instant'}),p);
  await page.waitForTimeout(650);
  await page.screenshot({path:`docs/screenshots/film-final-${name}.png`});
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:3000/?scene=poster');
 await page.waitForFunction(()=>document.querySelector('#motion')?.dataset.enhanced==='true');
 await page.screenshot({path:'docs/screenshots/film-final-mobile-opening.png'});
 for(const [name,p] of [['custom',.68],['individual',1]]) {
  await page.locator('#motion').evaluate((el,progress)=>scrollTo({top:el.getBoundingClientRect().top+scrollY+(el.clientHeight-innerHeight)*progress,behavior:'instant'}),p);
  await page.waitForTimeout(650);
  await page.screenshot({path:`docs/screenshots/film-final-mobile-${name}.png`});
 }
 console.log('Final production frames saved.');
} finally {await browser.close();}
