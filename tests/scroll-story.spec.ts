import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

async function openStory(page: Page) {
  await page.goto('/?scene=poster');
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state', 'content');
  await expect(page.locator('#capabilities')).toHaveAttribute('data-enhanced', 'true');
  await page.evaluate(() => document.fonts.ready);
}

async function seek(page: Page, progress: number) {
  await page.locator('#capabilities').evaluate((node, value) => {
    const root = node as HTMLElement;
    window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY + (root.offsetHeight - window.innerHeight) * value, behavior: 'instant' });
  }, progress);
  await expect.poll(async () => Number(await page.locator('#capabilities').getAttribute('data-progress'))).toBeCloseTo(progress, 2);
  // ScrollTrigger has a short scrub catch-up; settle it before checking actual layout.
  await page.waitForTimeout(550);
}

async function readInterface(preview: Locator) {
  return preview.evaluate(element => {
    const heading = element.querySelector('h3')!;
    const art = element.querySelector('[role="img"]')!;
    const layout = heading.parentElement!.parentElement!;
    const box = (node: Element) => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom }; };
    return { background: getComputedStyle(element).backgroundColor, weight: getComputedStyle(heading).fontWeight, columns: getComputedStyle(layout).gridTemplateColumns, interface: box(element), heading: box(heading), art: box(art) };
  });
}

test('native scroll transforms one idea from quiet to bold to actual phone reflow, and reverses', async ({ page }) => {
  await openStory(page);
  const story = page.locator('#capabilities');
  const quiet = story.locator('[data-character="quiet"]');
  const bold = story.locator('[data-character="bold"]');
  await expect(story.locator('button, a')).toHaveCount(0);
  await seek(page, .28);
  await expect(story).toHaveAttribute('data-act', '1');
  const quietFrame = await readInterface(quiet);
  expect(quietFrame.art.x).toBeGreaterThan(quietFrame.heading.x + quietFrame.heading.width);
  await seek(page, .64);
  await expect(story).toHaveAttribute('data-act', '2');
  const boldFrame = await readInterface(bold);
  expect(boldFrame.background).not.toEqual(quietFrame.background);
  expect(boldFrame.weight).not.toEqual(quietFrame.weight);
  expect(boldFrame.columns).not.toEqual(quietFrame.columns);
  expect(boldFrame.interface.width).toBeCloseTo(quietFrame.interface.width, 0);
  await seek(page, .94);
  await expect(story).toHaveAttribute('data-act', '3');
  const phoneFrame = await readInterface(bold);
  expect(phoneFrame.interface.width).toBeLessThanOrEqual(360);
  expect(phoneFrame.interface.width).toBeLessThan(boldFrame.interface.width / 2);
  expect(phoneFrame.art.y).toBeGreaterThan(phoneFrame.heading.bottom);
  expect(phoneFrame.columns.split(' ')).toHaveLength(1);
  await expect(bold.getByText('Архитектура повседневности')).toBeHidden();
  await seek(page, .28);
  await expect(story).toHaveAttribute('data-act', '1');
  const reversed = await readInterface(quiet);
  expect(reversed.interface.width).toBeCloseTo(quietFrame.interface.width, 0);
  expect(reversed.art.x).toBeCloseTo(quietFrame.art.x, 0);
  expect(reversed.heading.y).toBeCloseTo(quietFrame.heading.y, 0);
});

test('wheel remains native and keyboard can continue through the scroll story', async ({ page }) => {
  await openStory(page);
  await seek(page, .28);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(before + 240, 0);
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 400);
  expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe('fixed');
});

test('enabling reduced motion mid-story removes pinning and preserves both complete alternatives', async ({ page }) => {
  await openStory(page);
  await seek(page, .94);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const story = page.locator('#capabilities');
  await expect(story).not.toHaveAttribute('data-enhanced', 'true');
  const quiet = story.locator('[data-character="quiet"]');
  const bold = story.locator('[data-character="bold"]');
  await expect(quiet).toBeVisible();
  await expect(bold).toBeVisible();
  const first = await quiet.boundingBox();
  const second = await bold.boundingBox();
  expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
  expect(await story.locator(':scope > div').first().evaluate(element => getComputedStyle(element).position)).not.toBe('sticky');
  await expect(page.locator('#projects')).not.toHaveAttribute('data-enhanced', 'true');
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
});

for (const [width, height] of [[1440, 900], [623, 844], [390, 844], [390, 667]]) {
  test(`scroll states fit ${width}×${height} without horizontal overflow or cropped interface`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await openStory(page);
    for (const progress of [.08, .28, .53, .68, .94]) {
      await seek(page, progress);
      const metrics = await page.locator('#capabilities').evaluate(root => ({
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        interfaces: [...root.querySelectorAll('[data-character]')].map(element => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, overflow: element.scrollHeight - element.clientHeight };
        }),
      }));
      expect(metrics.pageOverflow).toBeLessThanOrEqual(1);
      for (const frame of metrics.interfaces) {
        expect(frame.left).toBeGreaterThanOrEqual(0);
        expect(frame.right).toBeLessThanOrEqual(width);
        expect(frame.top).toBeGreaterThanOrEqual(0);
        expect(frame.bottom).toBeLessThanOrEqual(height);
        expect(frame.overflow).toBeLessThanOrEqual(2);
      }
    }
    expect(errors).toEqual([]);
  });
}
