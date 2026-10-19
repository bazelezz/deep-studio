import { chromium } from '@playwright/test';
import sharp from 'sharp';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
try {
 for(let index=0;index<5;index++){
  await page.goto((process.env.QA_BASE_URL ?? 'http://127.0.0.1:3000')+'/?scene=ready');
  await page.waitForFunction(()=>document.querySelector('#scene')?.dataset.sceneState==='ready');
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(500);
  const png=await page.screenshot({path:`docs/screenshots/cover-lcd-repeat-${index}.png`});
  const region=await page.locator('[data-film-title] h1').boundingBox();
  const {data,info}=await sharp(png).extract({left:Math.ceil(region.x),top:Math.ceil(region.y),width:Math.floor(region.width)-2,height:Math.floor(region.height)-2}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let bright=0;for(let p=0;p<data.length;p+=info.channels){if(data[p]>160&&data[p+1]>160&&data[p+2]>160)bright++;}
  const ratio=bright/(info.width*info.height);
  console.log(JSON.stringify({index,titlePainted:ratio>.05,brightRatio:ratio}));
  if(ratio<.05)process.exitCode=1;
 }
}finally{await browser.close();}

