import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
try{
 await page.addInitScript(()=>{window.phaseFrames=[];const begin=performance.now();new MutationObserver(()=>{const scene=document.querySelector('#scene'),c=scene?.querySelector('canvas');const state=scene?.dataset.sceneState+' / '+c?.dataset.introStage; if(window.phaseFrames.at(-1)?.state!==state)window.phaseFrames.push({state,time:Math.round(performance.now()-begin),dpr:c?c.width/c.clientWidth:0});}).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['data-scene-state','data-intro-stage']});});
 await page.goto('http://127.0.0.1:3000/');
 await page.waitForFunction(()=>document.querySelector('#scene')?.dataset.sceneState==='content',{},{timeout:30000});
 console.log(await page.evaluate(()=>window.phaseFrames));
}finally{await browser.close();}
