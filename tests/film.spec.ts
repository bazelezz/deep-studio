import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
const posterUrl = '/?scene=poster';

async function openFilm(page: Page) {
  await page.goto(posterUrl);
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state', 'content');
  await expect(page.locator('#capabilities')).toHaveAttribute('data-enhanced', 'true');
  await expect(page.locator('#motion')).toHaveAttribute('data-enhanced', 'true');
  await page.evaluate(() => document.fonts.ready);
}

async function seek(page: Page, id: 'capabilities' | 'motion', progress: number) {
  await page.locator(`#${id}`).evaluate((element, amount) => {
    const section = element as HTMLElement;
    window.scrollTo({ top: section.getBoundingClientRect().top + scrollY + (section.offsetHeight - innerHeight) * amount, behavior: 'instant' });
  }, progress);
  await expect.poll(async () => Number(await page.locator(`#${id}`).getAttribute('data-progress'))).toBeCloseTo(progress, 2);
  await page.waitForTimeout(650);
}

async function readExample(example: Locator) {
  return example.evaluate(element => {
    const heading = element.querySelector('h3')!;
    const layout = heading.parentElement!.parentElement!;
    const art = element.querySelector('[role="img"]')!;
    const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom }; };
    return { frame: rect(element), heading: rect(heading), art: rect(art), background: getComputedStyle(element).backgroundColor, weight: getComputedStyle(heading).fontWeight, columns: getComputedStyle(layout).gridTemplateColumns };
  });
}

async function expectStaticFilm(page: Page) {
  const story = page.locator('#capabilities');
  await expect(story).not.toHaveAttribute('data-enhanced', 'true');
  const quiet = story.locator('[data-character="quiet"]');
  const bold = story.locator('[data-character="bold"]');
  await expect(quiet).toBeVisible();
  await expect(bold).toBeVisible();
  const first = await quiet.boundingBox();
  const second = await bold.boundingBox();
  expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
  const motion = page.locator('#motion');
  await expect(motion).not.toHaveAttribute('data-enhanced', 'true');
  expect(await motion.locator(':scope > div').first().evaluate(element => getComputedStyle(element).position)).not.toBe('sticky');
  const frames = motion.locator('[data-format-frame]');
  await expect(frames).toHaveCount(3);
  await expect(motion.locator('[data-format-preview]')).toHaveCount(3);
  await expect(frames.locator('h2')).toHaveText(['Лендинг.', 'Сайт компании.', 'Особый проект.']);
  for (let index = 0; index < 3; index++) {
    await expect(frames.nth(index)).toBeVisible();
    await expect(frames.nth(index).locator('[data-format-preview]')).toHaveAttribute('role', 'img');
    expect(await frames.nth(index).evaluate(element => getComputedStyle(element).clipPath)).toBe('none');
  }
  const framesBounds = await frames.evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { y: r.y, bottom: r.bottom }; }));
  expect(framesBounds[1].y).toBeGreaterThanOrEqual(framesBounds[0].bottom);
  expect(framesBounds[2].y).toBeGreaterThanOrEqual(framesBounds[1].bottom);
  await expect(motion.locator('[data-bespoke]')).toBeVisible();
  await expect(motion.locator('[data-bespoke]')).toContainText('Всегда индивидуально.');
}

test('film follows scene → character → movement → contact with native scroll and no old commercial blocks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openFilm(page);
  await expect(page.locator('#services, #projects')).toHaveCount(0);
  await expect(page.locator('a[href="#services"], a[href="#projects"]')).toHaveCount(0);
  await expect(page.locator('#scene h1')).toContainText('В новом');
  const positions = await page.locator('#scene, #capabilities, #motion, #contact').evaluateAll(nodes => nodes.map(node => ({ id: node.id, top: node.getBoundingClientRect().top + scrollY })));
  expect(positions.map(position => position.id)).toEqual(['scene', 'capabilities', 'motion', 'contact']);
  expect(positions.every((position, index) => index === 0 || position.top > positions[index - 1].top)).toBe(true);
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before + 240, 0);
  await seek(page, 'capabilities', .28);
  await seek(page, 'motion', .45);
  await page.locator('#contact').evaluate(element => element.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await expect(page.locator('#contact summary')).toBeInViewport();
  expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe('fixed');
  expect(errors).toEqual([]);
});

test('hero parallax modifies internal art only and reverses without changing the projected display', async ({ page }) => {
  await openFilm(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const art = page.locator('[data-film-art]');
  const title = page.locator('[data-film-title]');
  await expect.poll(() => title.evaluate(element => Number(getComputedStyle(element).opacity))).toBeCloseTo(1, 2);
  const initial = await art.evaluate(element => getComputedStyle(element).transform);
  await page.evaluate(() => window.scrollTo({ top: innerHeight * .4, behavior: 'instant' }));
  await expect.poll(() => title.evaluate(element => Number(getComputedStyle(element).opacity))).toBeLessThan(.8);
  expect(await art.evaluate(element => getComputedStyle(element).transform)).not.toBe(initial);
  expect(await page.locator('[data-live-display]').evaluate(element => getComputedStyle(element).transform)).toBe('none');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => title.evaluate(element => Number(getComputedStyle(element).opacity))).toBeCloseTo(1, 2);
});

test('scroll changes quiet composition to bold, then genuinely reflows it into a phone and reverses', async ({ page }) => {
  await openFilm(page);
  const story = page.locator('#capabilities');
  await expect(story.locator('button, a')).toHaveCount(0);
  const quiet = story.locator('[data-character="quiet"]');
  const bold = story.locator('[data-character="bold"]');
  await seek(page, 'capabilities', .28);
  await expect(story).toHaveAttribute('data-act', '1');
  const calm = await readExample(quiet);
  expect(calm.art.x).toBeGreaterThan(calm.heading.x + calm.heading.w);
  await seek(page, 'capabilities', .64);
  await expect(story).toHaveAttribute('data-act', '2');
  const strong = await readExample(bold);
  expect(strong.background).not.toBe(calm.background);
  expect(strong.weight).not.toBe(calm.weight);
  expect(strong.columns).not.toBe(calm.columns);
  await seek(page, 'capabilities', .94);
  await expect(story).toHaveAttribute('data-act', '3');
  const phone = await readExample(bold);
  expect(phone.frame.w).toBeLessThanOrEqual(360);
  expect(phone.frame.w).toBeLessThan(strong.frame.w / 2);
  expect(phone.columns.split(' ')).toHaveLength(1);
  expect(phone.art.y).toBeGreaterThan(phone.heading.bottom);
  await seek(page, 'capabilities', .28);
  const reverse = await readExample(quiet);
  expect(reverse.frame.w).toBeCloseTo(calm.frame.w, 0);
  expect(reverse.art.x).toBeCloseTo(calm.art.x, 0);
});

test('format story reveals three distinct websites, a bespoke conclusion and reverses to the company design', async ({ page }) => {
  await openFilm(page);
  const motion = page.locator('#motion');
  const frames = motion.locator('[data-format-frame]');
  const backgrounds: string[] = [];
  let companyTransform = '';
  for (const [index, progress, title] of [[0, .12, 'Лендинг.'], [1, .4, 'Сайт компании.'], [2, .65, 'Особый проект.']] as const) {
    await seek(page, 'motion', progress);
    await expect(motion).toHaveAttribute('data-act', String(index));
    await expect(frames.nth(index).locator('h2')).toHaveText(title);
    const preview = frames.nth(index).locator('[data-format-preview]');
    await expect(preview).toBeInViewport();
    const state = await preview.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const painted = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('[data-format-frame]');
      return { background: getComputedStyle(element.firstElementChild!).backgroundColor, topFrame: painted?.querySelector('h2')?.textContent, transform: getComputedStyle(element).transform };
    });
    expect(state.topFrame).toBe(title);
    backgrounds.push(state.background);
    if (index === 1) companyTransform = state.transform;
  }
  expect(new Set(backgrounds).size).toBe(3);
  await seek(page, 'motion', .96);
  await expect(motion).toHaveAttribute('data-act', '3');
  await expect(motion.locator('[data-bespoke-title]')).toBeVisible();
  await expect(motion.locator('[data-bespoke]')).toHaveCSS('opacity', '1');
  await expect(motion.locator('[data-bespoke]')).toContainText('Всегда индивидуально.');
  await expect(motion.getByRole('link', { name: 'Создадим ваше?' })).toHaveAttribute('href', '#contact');
  await seek(page, 'motion', .4);
  await expect(motion).toHaveAttribute('data-act', '1');
  expect(await frames.nth(1).locator('[data-format-preview]').evaluate(element => getComputedStyle(element).transform)).toBe(companyTransform);
  await expect(motion.locator('[data-bespoke]')).toBeHidden();
});

test('reduced motion enabled mid-film exposes both character examples and all three site formats', async ({ page }) => {
  await openFilm(page);
  await seek(page, 'capabilities', .94);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectStaticFilm(page);
  expect(await page.locator('[data-film-art]').evaluate(element => getComputedStyle(element).transform)).toBe('none');
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
});

test('contact disclosure works with keyboard and click, validation and denied copying remain honest', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
  });
  await openFilm(page);
  const disclosure = page.locator('#contact details');
  const summary = disclosure.locator('summary');
  await expect(disclosure).not.toHaveAttribute('open', '');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(page.getByLabel('Как вас зовут')).toBeVisible();
  await summary.click();
  await expect(disclosure).not.toHaveAttribute('open', '');
  await summary.click();
  await expect(disclosure).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Скопировать заявку', exact: true }).click();
  await expect(page.getByLabel('Как вас зовут')).toBeFocused();
  await expect(page.getByLabel('Как вас зовут')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Как вас зовут').fill('Тестовое имя');
  await page.getByLabel('Как с вами связаться').fill('test@example.ru');
  await page.getByLabel('Несколько слов о проекте', { exact: false }).fill('Нужен выразительный сайт для презентации услуг.');
  await page.getByLabel('Какой сайт вам нужен').selectOption('company');
  await page.getByRole('button', { name: 'Скопировать заявку', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Браузер не разрешил копирование.');
  await expect(page.getByRole('status')).not.toContainText('Заявка скопирована.');
  await expect(page.getByLabel('Готовый текст заявки')).toBeFocused();
  await expect(page.getByLabel('Готовый текст заявки')).toHaveValue(/Формат: Сайт компании/);
});

test('without JavaScript the complete film and native contact disclosure remain readable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}${posterUrl}`);
    await expect(page.locator('#scene h1')).toBeVisible();
    await expectStaticFilm(page);
    await page.locator('#contact summary').click();
    await expect(page.getByLabel('Как вас зовут')).toBeVisible();
    await expect(page.locator('form noscript p')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Скопировать заявку', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  } finally { await context.close(); }
});

test('reduced motion does not reveal the skip link unless the visitor focuses it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(posterUrl);
  await expect(page.locator('#scene')).toHaveAttribute('data-scene-state', 'content');
  const skip = page.locator('.skip-link');
  const state = () => skip.evaluate(element => ({ active: document.activeElement === element, bottom: element.getBoundingClientRect().bottom, top: element.getBoundingClientRect().top, transform: getComputedStyle(element).transform }));
  const fresh = await state();
  expect(fresh.active).toBe(false);
  expect(fresh.bottom).toBeLessThanOrEqual(0);
  await page.locator('#motion').evaluate(element => element.scrollIntoView({ behavior: 'instant', block: 'start' }));
  const scrolled = await state();
  expect(scrolled.active).toBe(false);
  expect(scrolled.bottom).toBeLessThanOrEqual(0);
  await skip.focus();
  await expect(skip).toBeFocused();
  await expect.poll(async () => (await state()).top).toBeGreaterThanOrEqual(0);
});

for (const [width, height] of [[390, 844], [623, 844], [1440, 900]]) {
  test(`all film stages fit ${width}×${height} with no horizontal overflow`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await openFilm(page);
    await page.screenshot({ path: testInfo.outputPath('hero.png') });
    for (const progress of [.28, .53, .94]) {
      await seek(page, 'capabilities', progress);
      const bounds = await page.locator('#capabilities [data-character]').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { x: r.x, right: r.right, y: r.y, bottom: r.bottom, overflow: element.scrollHeight - element.clientHeight }; }));
      for (const box of bounds) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width + 1);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.bottom).toBeLessThanOrEqual(height + 1);
        expect(box.overflow).toBeLessThanOrEqual(2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`story-${progress}.png`) });
    }
    for (const progress of [.12, .4, .65, .96]) {
      await seek(page, 'motion', progress);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`motion-${progress}.png`) });
    }
    await page.locator('#contact summary').click();
    await expect(page.getByLabel('Как вас зовут')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
