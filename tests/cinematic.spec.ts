import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });
const scene = (page: Page) => page.locator('#scene');
const display = (page: Page) => page.locator('[data-display-site]').locator('..');
const skip = (page: Page) => page.getByRole('button', { name: 'Пропустить вступление' });
const replay = (page: Page) => page.getByRole('button', { name: 'Повторить вступление' });

async function recordPhases(page: Page) {
  await page.addInitScript(() => {
    const tracked = window as Window & { scenePhases?: string[]; sceneOpeningOpacity?: number; sceneLightStages?: Array<{ stage: string; opening: number }>; firstLidMovement?: { opening: number; precedingStages: string[] } };
    tracked.scenePhases = [];
    tracked.sceneLightStages = [];
    new MutationObserver(() => {
      const phase = document.querySelector<HTMLElement>('#scene')?.dataset.sceneState;
      const canvas = document.querySelector<HTMLCanvasElement>('#scene canvas');
      const stage = canvas?.dataset.introStage;
      if (stage && tracked.sceneLightStages!.at(-1)?.stage !== stage) tracked.sceneLightStages!.push({ stage, opening: Number(canvas?.dataset.lidOpening) });
      const opening = Number(document.querySelector<HTMLElement>('#scene')?.dataset.openAmount);
      if (opening > 0 && !tracked.firstLidMovement) tracked.firstLidMovement = { opening, precedingStages: tracked.sceneLightStages!.map(item => item.stage) };
      const history = tracked.scenePhases!;
      if (phase && history.at(-1) !== phase) history.push(phase);
      if (phase === 'opening' && tracked.sceneOpeningOpacity === undefined) {
        const plane = document.querySelector<HTMLElement>('[data-live-display]');
        if (plane) tracked.sceneOpeningOpacity = Number(getComputedStyle(plane).opacity);
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-scene-state', 'data-intro-stage', 'data-open-amount'] });
  });
}

const phases = (page: Page) => page.evaluate(() => (window as Window & { scenePhases?: string[] }).scenePhases ?? []);

async function expectCanvas(page: Page) {
  await expect(scene(page).locator('canvas')).toBeVisible();
  await expect.poll(() => scene(page).locator('canvas').evaluate(element => {
    const wrapper = element.closest<HTMLElement>('[class*="canvasReady"]');
    return wrapper ? Number(getComputedStyle(wrapper).opacity) : 0;
  })).toBe(1);
  expect(await scene(page).locator('canvas').evaluate(element => {
    const context = (element as HTMLCanvasElement).getContext('webgl2');
    return !!context && !context.isContextLost();
  })).toBe(true);
}

async function expectContent(page: Page) {
  await expect(scene(page)).toHaveAttribute('data-scene-state', 'content', { timeout: 15_000 });
  await expect(scene(page).locator('canvas')).toHaveCount(0);
  await expect.poll(() => display(page).evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
  expect(await display(page).evaluate(element => getComputedStyle(element).transform)).toBe('none');
  expect(await display(page).evaluate(element => (element as HTMLElement).inert)).toBe(false);
  await expect(page.locator('[data-display-site]').getByRole('heading', { level: 1 })).toBeVisible();
  await expect(skip(page)).toHaveCount(0);
}

async function content(page: Page, url = '/') {
  await page.goto(url);
  await expectContent(page);
}

async function settleInput(page: Page) {
  // Wheel and keyboard scrolling are scheduled on Chrome's compositor thread.
  // Give the input a real opportunity to move the page before checking it.
  await page.waitForTimeout(180);
}

async function expectNormalWheelScroll(page: Page) {
  await page.mouse.move(40, 300);
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 420);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 100);
}

async function expectFullViewportCanvas(page: Page) {
  const actual = await scene(page).locator('canvas').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  expect(actual.x).toBeCloseTo(0, 0);
  expect(actual.y).toBeCloseTo(0, 0);
  expect(actual.width).toBeCloseTo(actual.viewportWidth, 0);
  expect(actual.height).toBeCloseTo(actual.viewportHeight, 0);
}

async function swipeUp(page: Page) {
  const session = await page.context().newCDPSession(page);
  try {
    const x = 190;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: 690 }] });
    for (const y of [620, 540, 460, 380, 300, 220]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>('#scene')!;
    const display = scene.querySelector<HTMLElement>('[data-display-site]')!.parentElement!;
    const bounds = (element: Element) => {
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight, clientWidth: document.documentElement.clientWidth },
      scrollWidth: document.documentElement.scrollWidth,
      scene: bounds(scene), display: bounds(display), site: bounds(scene.querySelector('[data-display-site]')!),
      matrix: getComputedStyle(display).transform,
      phase: scene.dataset.sceneState,
      documentHeight: document.documentElement.scrollHeight,
    };
  });
}

test('first visit starts with only the laptop, then automatically expands into a working HTML website', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await recordPhases(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(scene(page)).toHaveAttribute('data-scene-state', 'opening', { timeout: 8_000 });
  expect(Number(await scene(page).getAttribute('data-open-amount'))).toBeLessThan(1);
  await expect(skip(page)).toBeVisible();
  expect(await display(page).evaluate(element => (element as HTMLElement).inert)).toBe(true);
  await expect(page.locator('.hero-world > .header')).toHaveCount(0);
  // Observe at the first opening frame: protocol calls can take long enough for
  // the screen to have legitimately begun fading in by the next assertion.
  expect(await page.evaluate(() => (window as Window & { sceneOpeningOpacity?: number }).sceneOpeningOpacity)).toBe(0);
  await expect(scene(page)).toHaveAttribute('data-scene-state', 'entering', { timeout: 12_000 });
  expect(await display(page).evaluate(element => getComputedStyle(element).transform)).toMatch(/^matrix(?:3d)?\(/);
  expect(await display(page).evaluate(element => (element as HTMLElement).inert)).toBe(true);
  await expectContent(page);
  const history = await phases(page);
  expect(history).toEqual(expect.arrayContaining(['opening', 'ready', 'entering', 'content']));
  const light = await page.evaluate(() => {
    const tracked = window as Window & { sceneLightStages?: Array<{ stage: string; opening: number }>; firstLidMovement?: { opening: number; precedingStages: string[] } };
    return { stages: tracked.sceneLightStages ?? [], firstMovement: tracked.firstLidMovement };
  });
  expect(light.stages.find(item => item.stage === 'glint')?.opening).toBe(0);
  expect(light.stages.find(item => item.stage === 'edge')?.opening).toBe(0);
  expect(light.stages.findIndex(item => item.stage === 'edge')).toBeGreaterThan(light.stages.findIndex(item => item.stage === 'glint'));
  expect(light.firstMovement?.precedingStages).toEqual(expect.arrayContaining(['glint', 'edge']));
  await testInfo.attach('rendered-light-order-before-lid-motion', { body: JSON.stringify(light, null, 2), contentType: 'application/json' });
  const actual = await layout(page);
  expect(actual.site.x).toBeCloseTo(0, 0);
  expect(actual.site.width).toBeCloseTo(actual.viewport.clientWidth, 0);
  expect(actual.site.height).toBeGreaterThanOrEqual(actual.viewport.height - 1);
  await testInfo.attach('fullscreen-html-handoff', { body: JSON.stringify({ history, layout: actual }, null, 2), contentType: 'application/json' });
  await page.locator('[data-display-site]').getByRole('link', { name: 'Обсудить проект', exact: true }).last().click();
  await expect(page).toHaveURL(/#contact$/);
  await page.locator('#contact summary').click();
  await page.locator('#project-name').scrollIntoViewIfNeeded();
  await expect(page.locator('#project-name')).toBeInViewport();
  expect(errors).toEqual([]);
});

for (const phase of ['opening', 'entering']) {
  test(`skip during ${phase} opens the full website immediately`, async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(scene(page)).toHaveAttribute('data-scene-state', phase, { timeout: phase === 'entering' ? 12_000 : 8_000 });
    // The 1.65 s entry can finish while software WebGL makes Playwright wait
    // for stable layout. Send real pointer input immediately to the known button.
    await skip(page).click({ force: phase === 'entering', timeout: 3000 });
    await expectContent(page);
    await expect(scene(page)).toHaveAttribute('data-scene-reason', 'skip');
    await expectNormalWheelScroll(page);
  });
}

for (const phase of ['opening', 'entering']) {
  test(`wheel, PageDown and Space cannot leave the ${phase} scene; normal scrolling returns after completion`, async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const tracked = window as Window & { introInputs?: Array<{ type: string; key: string | null; phase?: string; trusted: boolean }> };
      tracked.introInputs = [];
      const log = (event: Event) => {
        if (event instanceof KeyboardEvent && !['PageDown', ' '].includes(event.key)) return;
        tracked.introInputs!.push({ type: event.type, key: event instanceof KeyboardEvent ? event.key : null, phase: document.querySelector<HTMLElement>('#scene')?.dataset.sceneState, trusted: event.isTrusted });
      };
      addEventListener('wheel', log, { capture: true, passive: true });
      addEventListener('keydown', log, { capture: true });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.mouse.move(700, 500);
    // Includes resource preparation and the required painted glint/edge frames.
    await expect(scene(page)).toHaveAttribute('data-scene-state', phase, { timeout: phase === 'entering' ? 12_000 : 8_000 });
    const start = await page.evaluate(() => scrollY);
    // Input streams are independent. A serial wheel acknowledgement can take
    // the whole short entry on software WebGL, sending later keys after content.
    await Promise.all([
      page.mouse.wheel(0, 950),
      (async () => { await page.keyboard.press('PageDown'); await page.keyboard.press('Space'); })(),
    ]);
    await settleInput(page);
    const inputs = await page.evaluate(() => (window as Window & { introInputs?: Array<{ type: string; key: string | null; phase?: string; trusted: boolean }> }).introInputs ?? []);
    await testInfo.attach(`${phase}-trusted-inputs`, { body: JSON.stringify(inputs, null, 2), contentType: 'application/json' });
    expect(inputs).toHaveLength(3);
    expect(inputs.every(input => input.phase === phase && input.trusted)).toBe(true);
    expect(await page.evaluate(() => scrollY)).toBe(start);
    await expectContent(page);
    await expectNormalWheelScroll(page);
  });
}

test('a mobile touch swipe is held during opening and works after skip', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  try {
    await page.goto(baseURL ?? 'http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
    await expect(scene(page)).toHaveAttribute('data-scene-state', 'opening');
    await swipeUp(page);
    await settleInput(page);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await expectFullViewportCanvas(page);
    await skip(page).click();
    await expectContent(page);
    await swipeUp(page);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  } finally {
    await context.close();
  }
});

test('reload in the same session plays the intro again', async ({ page }) => {
  await recordPhases(page);
  await content(page);
  await page.reload();
  await expect(scene(page)).toHaveAttribute('data-scene-state', 'opening');
  await expectCanvas(page);
  await expectContent(page);
  expect(await phases(page)).toEqual(expect.arrayContaining(['opening', 'entering', 'content']));
});

test('replay after partial scrolling covers the whole viewport and returns to the hero top', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await content(page);
  await page.mouse.wheel(0, 320);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(250);
  await replay(page).click();
  await expect(scene(page)).toHaveAttribute('data-scene-state', 'opening');
  expect(await display(page).evaluate(element => (element as HTMLElement).inert)).toBe(true);
  await expectCanvas(page);
  await expectFullViewportCanvas(page);
  await page.mouse.wheel(0, 700);
  await settleInput(page);
  await expectFullViewportCanvas(page);
  await expect(scene(page)).toHaveAttribute('data-scene-state', 'entering', { timeout: 12_000 });
  await expectContent(page);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expectNormalWheelScroll(page);
});

test('390, 623 and 1440 widths keep both the projected display and full website inside the viewport', async ({ page }, testInfo) => {
  await page.goto('/?scene=ready');
  await expect(scene(page)).toHaveAttribute('data-scene-state', 'ready');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 623, height: 844 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expectCanvas(page);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const actual = await layout(page);
    expect(actual.scrollWidth).toBeLessThanOrEqual(actual.viewport.clientWidth + 1);
    expect(actual.display.x).toBeGreaterThanOrEqual(-1);
    expect(actual.display.right).toBeLessThanOrEqual(actual.viewport.clientWidth + 1);
    expect(actual.display.y).toBeGreaterThanOrEqual(actual.scene.y - 1);
    expect(actual.display.bottom).toBeLessThanOrEqual(actual.scene.bottom + 1);
    await testInfo.attach(`projected-${viewport.width}`, { body: JSON.stringify(actual, null, 2), contentType: 'application/json' });
  }
  await page.goto('/?scene=poster');
  await expectContent(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 623, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const actual = await layout(page);
    expect(actual.scrollWidth).toBeLessThanOrEqual(actual.viewport.clientWidth + 1);
    expect(actual.site.x).toBeCloseTo(0, 0);
    expect(actual.site.width).toBeCloseTo(actual.viewport.clientWidth, 0);
    await testInfo.attach(`content-${viewport.width}`, { body: JSON.stringify(actual, null, 2), contentType: 'application/json' });
  }
});

test('reduced motion bypasses opening and expansion and shows usable full HTML', async ({ page }) => {
  await recordPhases(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await content(page);
  expect(await phases(page)).not.toContain('opening');
  expect(await phases(page)).not.toContain('entering');
  await expect(replay(page)).toHaveCount(0);
  await expectNormalWheelScroll(page);
});

test('enabling reduced motion during the intro settles into content without restarting on preference changes', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(scene(page)).toHaveAttribute('data-scene-state', 'opening');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectContent(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expectContent(page);
  await expectNormalWheelScroll(page);
});

test('unavailable WebGL directly exposes the actual website and contact action', async ({ page }) => {
  await page.addInitScript(`const getContext=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null; return getContext.call(this,type,...args);};`);
  await page.setViewportSize({ width: 390, height: 844 });
  await content(page);
  await expectNormalWheelScroll(page);
  await page.locator('[data-display-site]').getByRole('link', { name: 'Обсудить проект', exact: true }).last().click();
  await page.locator('#contact summary').click();
  await page.locator('#project-name').scrollIntoViewIfNeeded();
  await expect(page.locator('#project-name')).toBeInViewport();
  await expect(page.locator('footer')).toBeAttached();
});

test('lost WebGL context yields full HTML and survives motion-preference changes', async ({ page }) => {
  await page.goto('/?scene=ready');
  await expect(scene(page)).toHaveAttribute('data-scene-state', 'ready');
  await expectCanvas(page);
  await scene(page).locator('canvas').evaluate(element => {
    const context = (element as HTMLCanvasElement).getContext('webgl2');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expectContent(page);
  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    await page.emulateMedia({ reducedMotion });
    await expectContent(page);
  }
  await expectNormalWheelScroll(page);
  await page.locator('[data-display-site]').getByRole('link', { name: 'Обсудить проект', exact: true }).last().click();
  await page.locator('#contact summary').click();
  await page.locator('#project-name').scrollIntoViewIfNeeded();
  await expect(page.locator('#project-name')).toBeInViewport();
});

test('closed, glint, edge, gap, half, ready and entering debug frames are real WebGL stages with a projected display', async ({ page }) => {
  for (const state of ['closed', 'glint', 'edge', 'gap', 'half', 'ready', 'entering']) {
    await page.goto(`/?scene=${state}`);
    await expect(scene(page)).toHaveAttribute('data-scene-state', state === 'entering' ? 'entering' : 'ready');
    await expectCanvas(page);
    await expect.poll(async () => Number(await scene(page).getAttribute('data-open-amount'))).toBe(['closed', 'glint', 'edge'].includes(state) ? 0 : state === 'gap' ? .08 : state === 'half' ? .52 : 1);
    const opacity = () => display(page).evaluate(element => Number(getComputedStyle(element).opacity));
    if (state === 'half') {
      // The interface starts illuminating the display during the opening;
      // the half-open frame must stay subdued before the final screen reveal.
      await expect.poll(opacity).toBeGreaterThan(0);
      await expect.poll(opacity).toBeLessThan(.2);
    } else {
      await expect.poll(opacity).toBe(state === 'ready' || state === 'entering' ? 1 : 0);
    }
    // A perfectly frontal display has an affine projection; Chrome can
    // serialize the same four-corner transform as matrix() rather than matrix3d().
    expect(await display(page).evaluate(element => getComputedStyle(element).transform)).toMatch(/^matrix(?:3d)?\(/);
  }
});

test('blocked sessionStorage does not prevent the automatic handoff', async ({ page }) => {
  await page.addInitScript(`Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Blocked','SecurityError')}});`);
  await content(page);
});

test('late font resources expose the actual website once without a delayed intro', async ({ page }) => {
  await recordPhases(page);
  await page.route('**/*.woff2', async route => {
    await new Promise(resolve => setTimeout(resolve, 4300));
    await route.continue().catch(() => {});
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expectContent(page);
  await page.evaluate(() => document.fonts.ready);
  await expectContent(page);
  expect(await phases(page)).not.toContain('opening');
  await expectNormalWheelScroll(page);
});

test('a direct contact anchor plays the intro then honors the requested destination', async ({ page }) => {
  await recordPhases(page);
  await page.goto('/#contact');
  await expect(scene(page)).toHaveAttribute('data-scene-state', 'opening');
  await expectFullViewportCanvas(page);
  await expectContent(page);
  await page.locator('#contact summary').click();
  await page.locator('#project-name').scrollIntoViewIfNeeded();
  await expect(page.locator('#project-name')).toBeInViewport();
  expect(await phases(page)).toContain('opening');
});

