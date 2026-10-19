import { expect, test } from '@playwright/test';

test('light study reveals two actual visual states with native keyboard control', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?scene=poster');
  const study = page.locator('[data-light-study]');
  const slider = page.getByRole('slider', { name: 'Световой срез — от чертежа к материалу' });
  await expect(study).toHaveAttribute('data-enabled', 'true');
  await expect(study).toHaveAttribute('data-material', '56', { timeout: 5000 });
  await slider.focus();
  await slider.press('Home');
  await expect(study).toHaveAttribute('data-material', '0');
  const blueprint = await page.locator('[data-light-drawing]').screenshot();
  await slider.press('End');
  await expect(study).toHaveAttribute('data-material', '100');
  const metal = await page.locator('[data-light-drawing]').screenshot();
  expect(blueprint.equals(metal)).toBe(false);
  await expect(slider).toBeFocused();
  await slider.press('ArrowLeft');
  await expect(study).toHaveAttribute('data-material', '99');
});

test('touch takes over the light study and does not restart its automatic reveal', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  try {
    await page.goto('/?scene=poster');
    const study = page.locator('[data-light-study]');
    const slider = page.getByRole('slider', { name: 'Световой срез — от чертежа к материалу' });
    await expect(study).toHaveAttribute('data-enabled', 'true');
    await slider.tap({ position: { x: 35, y: 22 } });
    const chosen = Number(await slider.inputValue());
    expect(chosen).toBeLessThan(30);
    await page.waitForTimeout(2100);
    expect(Number(await slider.inputValue())).toBe(chosen);
    const box = await slider.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe('fixed');
  } finally { await context.close(); }
});

test('reduced motion keeps finished metal still and permits an intentional reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const study = page.locator('[data-light-study]');
  const slider = page.getByRole('slider', { name: 'Световой срез — от чертежа к материалу' });
  await expect(study).toHaveAttribute('data-enabled', 'true');
  await expect(slider).toHaveValue('100');
  await slider.press('Home');
  await expect(study).toHaveAttribute('data-material', '0');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Готовая форма: 0 процентов');
  await page.waitForTimeout(600);
  await expect(slider).toHaveValue('0');
});
