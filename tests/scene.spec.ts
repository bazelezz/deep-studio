import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state', 'ready', {timeout:12_000});
  await expect(page.locator('#scene canvas')).toBeVisible();
}
async function travel(page: Page, progress: number) {
  await page.evaluate((value) => {
    document.documentElement.style.scrollBehavior='auto';
    const root=document.querySelector<HTMLElement>('#scene')!;
    const stage=root.firstElementChild as HTMLElement;
    window.scrollTo(0,root.getBoundingClientRect().top+window.scrollY+(root.offsetHeight-stage.offsetHeight)*value);
  }, progress);
}

test('intro can be skipped and is not repeated in the same session', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Пропустить анимацию'})).toBeVisible();
  await page.getByRole('button',{name:'Пропустить анимацию'}).click();
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state','ready');
  expect(await page.evaluate(()=>sessionStorage.getItem('deep:intro-seen:v1'))).toBe('1');
  await page.reload();
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state','ready');
  await expect(page.getByRole('button',{name:'Пропустить анимацию'})).toHaveCount(0);
});

test('native scroll advances projected screen, hands off and reverses without replay', async ({page}) => {
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await ready(page);
  const heading=page.locator('#scene h2');
  const width0=await heading.evaluate(el=>el.parentElement!.getBoundingClientRect().width);
  await travel(page,.5);
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state','entering');
  // The state changes in the scroll callback; demand rendering updates projection on the next frame.
  await expect.poll(()=>heading.evaluate(el=>el.parentElement!.getBoundingClientRect().width)).toBeGreaterThan(width0);
  await travel(page,1);
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state','content');
  await expect(heading).toBeVisible();
  expect(await heading.evaluate(el=>getComputedStyle(el.parentElement!.parentElement!).opacity)).toBe('1');
  await travel(page,0);
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state','ready');
  await expect(page.getByRole('button',{name:'Пропустить анимацию'})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('context loss leaves a complete static visual without layout shift', async ({page}) => {
  await ready(page);
  const height=await page.locator('#scene').evaluate(el=>el.getBoundingClientRect().height);
  await page.locator('#scene canvas').evaluate(el=>{
    const context=(el as HTMLCanvasElement).getContext('webgl2');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state','fallback');
  await expect(page.locator('#scene canvas')).toHaveCount(0);
  await expect(page.locator('#scene h2')).toBeVisible();
  expect(await page.locator('#scene').evaluate(el=>el.getBoundingClientRect().height)).toBeCloseTo(height,0);
});

test('unavailable WebGL still leaves the complete website', async ({page}) => {
  await page.addInitScript(`const getContext=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null; return getContext.call(this,type,...args);};`);
  await page.goto('/');
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state','fallback');
  await expect(page.locator('#scene h2')).toBeVisible();
  await page.getByRole('link',{name:'Обсудить проект',exact:false}).first().click();
  await expect(page.locator('#project-name')).toBeInViewport();
});

test('fallback remains readable when reduced motion is enabled and disabled', async ({page}) => {
  await page.goto('/?scene=poster');
  const scene = page.locator('#scene');
  const heading = scene.locator('h2');
  await expect(scene).toHaveAttribute('data-scene-state', 'fallback');
  await expect(heading).toBeVisible();
  const height = await scene.evaluate(el => el.getBoundingClientRect().height);
  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    await page.emulateMedia({ reducedMotion });
    await expect(scene).toHaveAttribute('data-scene-state', 'fallback');
    await expect(heading).toBeVisible();
    await expect(scene.locator('canvas')).toHaveCount(0);
    expect(await scene.evaluate(el => el.getBoundingClientRect().height)).toBeCloseTo(height, 0);
  }
});

test('blocked sessionStorage does not break scene initialization', async ({page}) => {
  await page.addInitScript(`Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Blocked','SecurityError')}});`);
  await ready(page);
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
});

test('late resources time out once and do not start a delayed intro', async ({page}) => {
  await page.route('**/*.woff2', async route=>{await new Promise(resolve=>setTimeout(resolve,4300)); await route.continue().catch(()=>{});});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state','fallback',{timeout:8000});
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state','fallback');
  await expect(page.locator('#scene canvas')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Пропустить анимацию'})).toHaveCount(0);
});

test('changing reduced motion during entry restores a static open scene', async ({page}) => {
  await ready(page);
  await travel(page,.85);
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state','entering');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state','reduced-motion');
  expect(await page.locator('#scene > div').evaluate(el=>getComputedStyle(el).position)).toBe('relative');
  await expect(page.locator('#scene h2')).toBeVisible();
});

test('quick anchor navigation and resize do not trap the visitor in the intro', async ({page}) => {
  await page.goto('/');
  await page.getByRole('link',{name:'Обсудить проект',exact:false}).first().click();
  await expect(page.locator('#project-name')).toBeInViewport();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('link',{name:'Наверх'}).click();
  await expect(page.getByRole('heading',{level:1})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Пропустить анимацию'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
