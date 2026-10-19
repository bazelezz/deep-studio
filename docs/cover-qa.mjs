import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
try{
 for(const [name,width,height,state] of [['wide',1440,900,'poster'],['narrow',623,850,'poster'],['panel',510,810,'poster'],['mobile',390,844,'poster'],['laptop',1440,900,'ready']]){
 await page.setViewportSize({width,height});
 await page.goto((process.env.QA_BASE_URL ?? 'http://127.0.0.1:3000')+'/?scene='+state);
 await page.waitForFunction(expected=>document.querySelector('#scene')?.dataset.sceneState===expected,state==='poster'?'content':'ready');
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(650);
 await page.screenshot({path:'docs/screenshots/cover-'+name+'.png'});
 console.log(name,await page.locator('[data-display-site]').evaluate(el=>({heading:el.querySelector('h1').innerText,overflow:document.documentElement.scrollWidth>innerWidth})));
 }
}finally{await browser.close();}


