import { expect, test, type Page } from '@playwright/test';

// This suite deliberately excludes the paused opening and screen-entry timeline.
test.use({ reducedMotion: 'no-preference' });

async function ready(page: Page) {
  await page.goto('/');
  const scene = page.locator('#scene');
  await expect(scene).toHaveAttribute('data-still-frame', 'true');
  await expect(scene).toHaveAttribute('data-scene-state', 'ready', { timeout: 12_000 });
  await expect(scene.locator('canvas')).toBeVisible();
  await expect.poll(() => scene.locator('canvas').evaluate(element => {
    const wrapper = element.closest<HTMLElement>('[class*="canvasReady"]');
    return wrapper ? Number(getComputedStyle(wrapper).opacity) : 0;
  })).toBe(1);
  await expect(page.getByRole('button', { name: 'Пропустить анимацию' })).toHaveCount(0);
}

async function bounds(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('#scene')!;
    const stage = root.firstElementChild as HTMLElement;
    const canvas = root.querySelector('canvas')!;
    const rect = (element: Element) => {
      const { x, y, width, height, bottom, right } = element.getBoundingClientRect();
      return { x, y, width, height, bottom, right };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight, clientWidth: document.documentElement.clientWidth },
      scrollWidth: document.documentElement.scrollWidth,
      phase: root.dataset.sceneState,
      scene: rect(root),
      stage: rect(stage),
      heading: rect(document.querySelector('h1')!),
      canvas: canvas ? rect(canvas) : null,
      canvasPixels: canvas ? { width: canvas.width, height: canvas.height } : null,
      stagePosition: getComputedStyle(stage).position,
      documentHeight: document.documentElement.scrollHeight,
    };
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 623, height: 844 }, { width: 390, height: 844 }]) {
  test(`open WebGL still frame fits the page at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await ready(page);
    const actual = await bounds(page);
    await testInfo.attach('layout-bounds', { body: JSON.stringify(actual, null, 2), contentType: 'application/json' });
    expect(actual.scrollWidth).toBeLessThanOrEqual(actual.viewport.clientWidth + 1);
    expect(actual.canvas?.x).toBeGreaterThanOrEqual(-1);
    expect(actual.canvas?.right).toBeLessThanOrEqual(actual.viewport.clientWidth + 1);
    expect(actual.heading.x).toBeGreaterThanOrEqual(0);
    expect(actual.heading.right).toBeLessThanOrEqual(actual.viewport.clientWidth + 1);
    expect(actual.stagePosition).toBe('relative');
    expect(actual.scene.height).toBeCloseTo(actual.stage.height, 0);
    expect(actual.canvasPixels?.width).toBeGreaterThan(0);
    expect(actual.canvasPixels?.height).toBeGreaterThan(0);
    expect(await page.locator('#scene canvas').evaluate(element => {
      const context = (element as HTMLCanvasElement).getContext('webgl2');
      return !!context && !context.isContextLost();
    })).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('scrolling away and returning keeps the open frame unchanged', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  const scene = page.locator('#scene');
  const canvas = scene.locator('canvas');
  const before = await canvas.screenshot({ style: 'nextjs-portal{display:none}' });
  const beforeBounds = await bounds(page);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('#services')!.scrollIntoView(); });
  await expect(page.getByRole('heading', { name: 'Какой сайт нужен вашему бизнесу?' })).toBeInViewport();
  await expect(scene).toHaveAttribute('data-scene-state', 'ready');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  await expect(scene).toHaveAttribute('data-scene-state', 'ready');
  const after = await canvas.screenshot({ style: 'nextjs-portal{display:none}' });
  const afterBounds = await bounds(page);
  await testInfo.attach('static-before', { body: before, contentType: 'image/png' });
  await testInfo.attach('static-after', { body: after, contentType: 'image/png' });
  expect(after.equals(before)).toBe(true);
  expect(afterBounds.scene).toEqual(beforeBounds.scene);
  expect(afterBounds.documentHeight).toBe(beforeBounds.documentHeight);
  await expect(page.getByRole('button', { name: 'Пропустить анимацию' })).toHaveCount(0);
});

test('reduced motion keeps the same open canvas without a second scene section', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const scene = page.locator('#scene');
  const initial = await bounds(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(scene).toHaveAttribute('data-scene-state', 'reduced-motion');
  await expect(scene.locator('canvas')).toBeVisible();
  const reduced = await bounds(page);
  expect(reduced.scene).toEqual(initial.scene);
  expect(reduced.stagePosition).toBe('relative');
  expect(reduced.documentHeight).toBe(initial.documentHeight);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(scene).toHaveAttribute('data-scene-state', 'ready');
  await expect(page.getByRole('button', { name: 'Пропустить анимацию' })).toHaveCount(0);
});

test('unavailable WebGL leaves an open poster and usable hero action', async ({ page }) => {
  await page.addInitScript(`const getContext=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null; return getContext.call(this,type,...args);};`);
  await page.setViewportSize({ width: 623, height: 844 });
  await page.goto('/');
  const scene = page.locator('#scene');
  await expect(scene).toHaveAttribute('data-scene-state', 'fallback');
  await expect(scene.locator('canvas')).toHaveCount(0);
  const poster = scene.locator('picture img');
  await expect(poster).toBeVisible();
  expect(await poster.evaluate(element => (element as HTMLImageElement).currentSrc)).toContain('laptop-still-tablet.webp');
  expect(await poster.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const actual = await bounds(page);
  expect(actual.scrollWidth).toBeLessThanOrEqual(actual.viewport.clientWidth + 1);
  await scene.getByRole('link', { name: 'Обсудить проект', exact: false }).click();
  await expect(page.locator('#project-name')).toBeInViewport();
});

test('lost WebGL context preserves still-frame height and its open poster', async ({ page }) => {
  await ready(page);
  const scene = page.locator('#scene');
  const initial = await bounds(page);
  await scene.locator('canvas').evaluate(element => {
    const context = (element as HTMLCanvasElement).getContext('webgl2');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(scene).toHaveAttribute('data-scene-state', 'fallback');
  await expect(scene.locator('canvas')).toHaveCount(0);
  await expect(scene.locator('picture img')).toBeVisible();
  const fallback = await bounds(page);
  expect(fallback.scene).toEqual(initial.scene);
  expect(fallback.documentHeight).toBe(initial.documentHeight);
});

test('fallback stays readable through both motion-preference changes', async ({ page }) => {
  await page.goto('/?scene=poster');
  const scene = page.locator('#scene');
  await expect(scene).toHaveAttribute('data-scene-state', 'fallback');
  const initial = await bounds(page);
  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    await page.emulateMedia({ reducedMotion });
    await expect(scene).toHaveAttribute('data-scene-state', 'fallback');
    await expect(scene.locator('picture img')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const current = await bounds(page);
    expect(current.scene).toEqual(initial.scene);
    expect(current.documentHeight).toBe(initial.documentHeight);
  }
});
