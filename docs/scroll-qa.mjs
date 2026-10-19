import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({deviceScaleFactor:1,reducedMotion:'no-preference'});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const results=[];
try {
 for (const [name,width,height] of [['desktop',1440,900],['narrow',623,844],['mobile',390,844],['short',390,667]]) {
  await page.setViewportSize({width,height});
  await page.goto('http://127.0.0.1:3001/?scene=poster',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#capabilities')?.dataset.enhanced==='true');
  for (const step of [.08,.28,.53,.68,.86,.98,.28]) {
   await page.evaluate(p=>{const node=document.querySelector('#capabilities');window.scrollTo({top:node.getBoundingClientRect().top+scrollY+(node.offsetHeight-innerHeight)*p,behavior:'instant'});},step);
   await page.waitForTimeout(700);
   const state=await page.evaluate(()=>{
    const root=document.querySelector('#capabilities');
    const panel=root.querySelector('[class*="ScrollShowcase-module"][class*="panel"]') || root.querySelector('[class*="panel"]');
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right}};
    const captions=[...root.querySelectorAll('[data-story-copy]')].filter(e=>getComputedStyle(e).opacity>.1).map(e=>({text:e.textContent,rect:rect(e),opacity:getComputedStyle(e).opacity}));
    return {scrollY,progress:root.dataset.progress,act:root.dataset.act,viewport:{w:innerWidth,h:innerHeight},documentWidth:document.documentElement.scrollWidth,panel:rect(panel),captions,interfaces:[...root.querySelectorAll('[data-character]')].map(e=>({character:e.dataset.character,rect:rect(e),art:rect(e.querySelector('[role=img]')),heading:rect(e.querySelector('h3')),headingScrollWidth:e.querySelector('h3').scrollWidth,headingWidth:e.querySelector('h3').clientWidth,bodyScrollHeight:e.scrollHeight,clientHeight:e.clientHeight}))};
   });
   results.push({name,step,...state});
   if(results.filter(x=>x.name===name&&x.step===step).length===1)await page.screenshot({path:`docs/screenshots/scroll-qa-${name}-${Math.round(step*100)}.png`});
  }
  console.log(JSON.stringify({name,results:results.filter(x=>x.name===name)},null,2));
 }
 await fs.writeFile('docs/screenshots/scroll-qa-results.json',JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify({errors}));
} finally {await browser.close();}
