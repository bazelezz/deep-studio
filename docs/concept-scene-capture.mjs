import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
try{
 for(const frame of ['ready','entering']){
  await page.goto(`http://127.0.0.1:3001/?scene=${frame}`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>['ready','entering'].includes(document.querySelector('#scene')?.getAttribute('data-scene-state')));
  await page.screenshot({path:`docs/screenshots/concept-laptop-${frame}.png`});
 }
 await page.goto('http://127.0.0.1:3001/?scene=poster',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Студийный свет',exact:true}).click();
 if(await page.locator('[data-display-site]').getAttribute('data-light')!=='off')throw Error('Light toggle failed');
 await page.screenshot({path:'docs/screenshots/concept-light-dimmed.png'});
 await page.getByRole('button',{name:'Студийный свет',exact:true}).press('Enter');
 if(await page.locator('[data-display-site]').getAttribute('data-light')!=='on')throw Error('Keyboard light toggle failed');
 await page.getByRole('button',{name:/01 Структура/}).click();
 await page.getByRole('button',{name:'Скрыть направляющие'}).waitFor();
 await page.getByRole('button',{name:/02 Характер/}).click();
 await page.getByRole('button',{name:'Увидеть логику'}).click();
 await page.getByText('Иерархия текста',{exact:false}).waitFor();
 await page.locator('#capabilities').screenshot({path:'docs/screenshots/concept-worktable.png',style:'.skip-link:not(:focus){visibility:hidden}'});
 console.log('Ready/entering screenshots saved; light pointer+keyboard and worktable interactions passed.');
}finally{await browser.close()}
