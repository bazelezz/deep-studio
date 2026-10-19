import { chromium } from '@playwright/test';
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({reducedMotion:'no-preference',deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try {
  for(const [name,width,height] of [['desktop',1440,900],['narrow',623,844],['mobile',390,844]]) {
    await page.setViewportSize({width,height});
    await page.goto('http://127.0.0.1:3001/?scene=ready');
    await page.waitForFunction(()=>document.querySelector('#scene')?.dataset.sceneState==='ready');
    await page.waitForTimeout(350);
    await page.screenshot({path:`docs/screenshots/film-${name}-laptop.png`});
    const screen = await page.locator('[data-display-site]').evaluate(el=>{
      const h=el.querySelector('h1').getBoundingClientRect(),p=el.getBoundingClientRect();
      return {titleWithinDisplay:h.bottom<p.bottom&&h.right<=p.right,displayRatio:p.width/p.height};
    });
    await page.goto('http://127.0.0.1:3001/?scene=poster');
    await page.waitForFunction(()=>document.querySelector('#scene')?.dataset.sceneState==='content');
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(200);
    await page.screenshot({path:`docs/screenshots/film-${name}-opening.png`});
    for(const [label,progress] of [['quiet',.3],['wipe',.53],['phone',.94]]) {
      await page.locator('#capabilities').evaluate((el,p)=>scrollTo({top:el.getBoundingClientRect().top+scrollY+(el.clientHeight-innerHeight)*p,behavior:'instant'}),progress);
      await page.waitForTimeout(500);
      await page.screenshot({path:`docs/screenshots/film-${name}-${label}.png`});
    }
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.screenshot({path:`docs/screenshots/film-${name}-end.png`});
    console.log(JSON.stringify({name,...screen,overflow:await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)}));
  }
  console.log(JSON.stringify({errors}));
} finally {await browser.close();}
