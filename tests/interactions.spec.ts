import { expect, test, type Page } from '@playwright/test';

const posterUrl = '/?scene=poster';

test('isolated Chrome actually writes and reads the prepared application through Clipboard API', async ({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.goto(posterUrl);
  await fillProject(page);
  await page.locator('#project-service').selectOption('company');
  await page.getByRole('button',{name:'Скопировать заявку',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Заявка скопирована.');
  const clipboard=await page.evaluate(()=>navigator.clipboard.readText());
  expect(clipboard).toContain('Имя: Тестовое имя');
  expect(clipboard).toContain('Формат: Сайт компании');
  expect(clipboard).toContain('test@example.ru');
});

async function fillProject(page: Page) {
  await page.getByLabel('Как вас зовут').fill('Тестовое имя');
  await page.getByLabel('Как с вами связаться').fill('test@example.ru');
  await page.getByLabel('Несколько слов о проекте', { exact: false }).fill('Нужен сайт для презентации услуг и обращения клиентов.');
}

test('main page is complete and does not show invented prices or empty external links', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(posterUrl);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ваш бизнес.');
  for (const id of ['capabilities', 'services', 'projects', 'contact']) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
  await expect(page.locator('[data-service-price]')).toHaveText(['По запросу', 'По запросу', 'По запросу']);
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Смотреть кейс' })).toHaveCount(0);
  await expect(page.getByText('Демонстрационная обложка', { exact: true })).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('reduced-motion story preserves both designed examples without requiring controls', async ({ page }) => {
  await page.goto(posterUrl);
  const story = page.locator('#capabilities');
  await expect(story).not.toHaveAttribute('data-enhanced', 'true');
  await expect(story.locator('button, a')).toHaveCount(0);
  const quiet = story.locator('[data-character="quiet"]');
  const bold = story.locator('[data-character="bold"]');
  await expect(quiet).toBeVisible();
  await expect(bold).toBeVisible();
  const quietBox = await quiet.boundingBox();
  const boldBox = await bold.boundingBox();
  expect(boldBox!.y).toBeGreaterThanOrEqual(quietBox!.y + quietBox!.height);
  expect(await quiet.evaluate(element => getComputedStyle(element).backgroundColor)).not.toEqual(await bold.evaluate(element => getComputedStyle(element).backgroundColor));
  await expect(story).toContainText('Демонстрация интерфейса');
});

test('each service link reaches the form and selects its real format', async ({ page }) => {
  await page.goto(posterUrl);
  for (const service of ['landing', 'company', 'individual']) {
    await page.locator(`a[data-service="${service}"]`).click();
    await expect(page).toHaveURL(/#contact$/);
    await expect(page.getByLabel('Какой сайт вам нужен')).toHaveValue(service);
    await expect(page.getByRole('heading', { name: /Давайте покажем/ })).toBeInViewport();
  }
});

test('a format can be selected by a direct link', async ({ page }) => {
  await page.goto('/?scene=poster&format=company#contact');
  await expect(page.getByLabel('Какой сайт вам нужен')).toHaveValue('company');
});

test('form validates accessibly and focuses the first invalid field', async ({ page }) => {
  await page.goto(`${posterUrl}#contact`);
  await page.getByRole('button', { name: 'Скопировать заявку' }).click();
  await expect(page.getByLabel('Как вас зовут')).toBeFocused();
  await expect(page.getByLabel('Как вас зовут')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Напишите имя — хотя бы 2 символа.')).toBeVisible();
  await fillProject(page);
  await page.getByLabel('Как с вами связаться').fill('broken@example');
  await page.getByRole('button', { name: 'Скопировать заявку' }).click();
  await expect(page.getByLabel('Как с вами связаться')).toBeFocused();
  await expect(page.getByText('Проверьте адрес email: например, name@example.ru.')).toBeVisible();
  await page.getByLabel('Как с вами связаться').fill('+7 123');
  await page.getByRole('button', { name: 'Скопировать заявку' }).click();
  await expect(page.getByText('Проверьте номер телефона: не хватает цифр.')).toBeVisible();
  await expect(page.getByText('Заявка отправлена.', { exact: false })).toHaveCount(0);
});

test('successful copying requires the clipboard operation to complete and never sends a request', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as Window & { copiedProject?: string }).copiedProject = text; } } });
  });
  const submissions: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') submissions.push(request.url()); });
  await page.goto(`${posterUrl}#contact`);
  await fillProject(page);
  await page.getByLabel('Какой сайт вам нужен').selectOption('landing');
  await page.getByRole('button', { name: 'Скопировать заявку' }).click();
  await expect(page.getByRole('status')).toContainText('Заявка скопирована.');
  await expect(page.getByRole('status')).toContainText('Автоматической отправки не было.');
  const copied = await page.evaluate(() => (window as Window & { copiedProject?: string }).copiedProject);
  expect(copied).toContain('Имя: Тестовое имя');
  expect(copied).toContain('Связь: test@example.ru');
  expect(copied).toContain('Формат: Лендинг');
  expect(submissions).toEqual([]);
});

test('denied clipboard provides selectable text and does not claim success', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Clipboard denied', 'NotAllowedError'); } } });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
  });
  await page.goto(`${posterUrl}#contact`);
  await fillProject(page);
  await page.getByRole('button', { name: 'Скопировать заявку' }).click();
  await expect(page.getByRole('status')).toContainText('Браузер не разрешил копирование.');
  const draft = page.getByLabel('Готовый текст заявки');
  await expect(draft).toBeVisible();
  await expect(draft).toBeFocused();
  await expect(draft).toHaveValue(/Тестовое имя/);
  await expect(page.getByRole('status')).not.toContainText('Заявка скопирована.');
  await page.getByRole('button', { name: 'Выделить текст', exact: true }).click();
  const selection = await draft.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    return { start: textarea.selectionStart, end: textarea.selectionEnd, length: textarea.value.length };
  });
  expect(selection.start).toBe(0);
  expect(selection.end).toBe(selection.length);
});

test('mobile menu closes with Escape and restores focus, then navigates to contacts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(posterUrl);
  const summary = page.locator('.mobile-menu summary');
  await summary.click();
  await expect(page.getByRole('navigation', { name: 'Мобильная навигация' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('navigation', { name: 'Мобильная навигация' }).getByRole('link', { name: 'Обсудить проект' }).click();
  await expect(page).toHaveURL(/#contact$/);
  await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
  await expect(page.locator('#contact')).toBeFocused();
});

for (const width of [375, 390, 768, 1440, 1920]) {
  test(`no horizontal overflow or clipped headings at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(posterUrl);
    await page.evaluate(() => document.fonts.ready);
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport + 1);
    const clipped = await page.locator('h1, h2, h3').evaluateAll((headings) => headings.filter((heading) => {
      const style = getComputedStyle(heading);
      const bounds = heading.getBoundingClientRect();
      if (style.display === 'none' || !bounds.width) return false;
      // The fallback's accessible title intentionally uses the standard 1×1 clipped pattern.
      // It is available to assistive technology, not a visually clipped page heading.
      if (bounds.width <= 1 && bounds.height <= 1 && style.clipPath === 'inset(50%)') return false;
      return heading.scrollWidth > heading.clientWidth + 2;
    }).map((heading) => heading.textContent));
    expect(clipped).toEqual([]);
  });
}

test('server-rendered content and the native mobile menu remain useful without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${baseURL}${posterUrl}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('В новом свете.');
  await expect(page.getByRole('heading', { name: 'Лендинг', exact: true })).toBeAttached();
  const story = page.locator('#capabilities');
  await expect(story.locator('[data-character="quiet"]')).toBeVisible();
  await expect(story.locator('[data-character="bold"]')).toBeVisible();
  await expect(story.locator('button, a')).toHaveCount(0);
  // Playwright text matching intentionally skips noscript; inspect its rendered child directly.
  await expect(page.locator('form noscript p')).toBeVisible();
  expect(await page.locator('form noscript p').textContent()).toContain('Для подготовки заявки в этой форме нужен JavaScript.');
  await expect(page.getByRole('button', { name: 'Скопировать заявку' })).toBeDisabled();
  await page.locator('.mobile-menu summary').click();
  await expect(page.getByRole('navigation', { name: 'Мобильная навигация' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Мобильная навигация' }).getByRole('link', { name: 'Услуги', exact: false }).click();
  await expect(page).toHaveURL(/#services$/);
  await context.close();
});

