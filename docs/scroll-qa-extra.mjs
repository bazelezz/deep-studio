import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'no-preference'});
const result={};
try {
 await page.goto('http://127.0.0.1:3001/?scene=poster',{waitUntil:'networkidle'});
 for(const step of [0,.5,1]){
  await page.evaluate(p=>{const n=document.querySelector('#projects');window.scrollTo({top:n.getBoundingClientRect().top+scrollY+(n.offsetHeight-innerHeight)*p,behavior:'instant'});},step);
  await page.waitForTimeout(900);await page.screenshot({path:`docs/screenshots/scroll-qa-projects-${step}.png`});
  result['projects'+step]=await page.evaluate(()=>({position:getComputedStyle(document.querySelector('#projects>div')).position,projectBoxes:[...document.querySelectorAll('[data-project-frame]')].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})}));
 }
 await page.evaluate(()=>{const n=document.querySelector('#capabilities');window.scrollTo({top:n.offsetTop+(n.offsetHeight-innerHeight)*.28,behavior:'instant'})});
 await page.waitForTimeout(900);const before=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,240);await page.waitForTimeout(900);result.nativeWheel={before,after:await page.evaluate(()=>scrollY)};
 await page.setViewportSize({width:390,height:667});await page.waitForTimeout(900);result.resize=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,progress:document.querySelector('#capabilities').dataset.progress,act:document.querySelector('#capabilities').dataset.act}));
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(900);result.reduced=await page.evaluate(()=>({enhanced:document.querySelector('#capabilities').dataset.enhanced||null,storyHeight:document.querySelector('#capabilities').offsetHeight,sticky:getComputedStyle(document.querySelector('#capabilities>div')).position,projectEnhanced:document.querySelector('#projects').dataset.enhanced||null,bodyOverflow:getComputedStyle(document.body).overflow}));
 await page.locator('#capabilities').scrollIntoViewIfNeeded();await page.screenshot({path:'docs/screenshots/scroll-qa-reduced-mobile.png'});
 console.log(JSON.stringify(result,null,2));await fs.writeFile('docs/screenshots/scroll-qa-extra.json',JSON.stringify(result,null,2));
}finally{await browser.close()}
