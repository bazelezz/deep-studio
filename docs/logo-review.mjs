import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3001';
const prefix = process.env.CAPTURE_PREFIX ?? 'logo';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ reducedMotion: 'no-preference', deviceScaleFactor: 1 });
const review = { base, errors: [], layouts: [], favicon: null };
page.on('pageerror', error => review.errors.push(error.message));

try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 623, 844], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}/?scene=poster`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#scene')?.getAttribute('data-scene-state') === 'content');
    await page.evaluate(() => document.fonts.ready);
    const header = page.locator('[data-display-site] header');
    const headerBrand = header.getByRole('link', { name: 'DEEP — в начало', exact: true });
    await header.screenshot({ path: `docs/screenshots/${prefix}-${name}-header-crop.png`, style: 'nextjs-portal{display:none}' });
    if (name === 'desktop') await headerBrand.screenshot({ path: `docs/screenshots/${prefix}-desktop-brand-crop.png` });
    const layout = await header.evaluate((element, name) => {
      const brand = element.querySelector('a:has([data-brand-logo])');
      const svg = brand?.querySelector('svg');
      const symbol = svg?.querySelector('[data-logo-symbol]');
      const symbolBox = symbol?.getBoundingClientRect();
      const brandBox = brand.getBoundingClientRect();
      const navigationCandidates = [...element.querySelectorAll('nav, summary')].map(node => {
        const closedDetails = node.closest('details:not([open])');
        const hiddenByDetails = !!closedDetails && node !== closedDetails.querySelector(':scope > summary');
        return { node, box: node.getBoundingClientRect(), visible: node.checkVisibility() && !hiddenByDetails };
      });
      const navigation = navigationCandidates.filter(item => item.visible && item.box.width > 0 && item.box.height > 0);
      const overlaps = navigation.filter(({ box }) => Math.min(box.right, brandBox.right) > Math.max(box.left, brandBox.left) && Math.min(box.bottom, brandBox.bottom) > Math.max(box.top, brandBox.top));
      return {
        name, width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
        label: brand.getAttribute('aria-label'), href: brand.getAttribute('href'),
        svg: !!svg, pathCount: svg?.querySelectorAll('path').length,
        brandWidth: brandBox.width, brandHeight: brandBox.height,
        symbolWidth: symbolBox?.width ?? null, symbolHeight: symbolBox?.height ?? null,
        navigationOverlap: overlaps.length,
        navigationVisibility: navigationCandidates.map(({ node, visible, box }) => ({ tag: node.tagName, visible, width: box.width, height: box.height })),
      };
    }, name);
    if (name !== 'tablet') {
      const footer = page.locator('.footer');
      await footer.scrollIntoViewIfNeeded();
      await footer.screenshot({ path: `docs/screenshots/${prefix}-${name}-footer.png`, style: 'nextjs-portal{display:none}' });
      const footerBrand = footer.getByRole('link', { name: 'DEEP — в начало', exact: true });
      layout.footerHref = await footerBrand.getAttribute('href');
      layout.footerSvg = await footerBrand.locator('svg').count();
      await footerBrand.click();
      await page.waitForFunction(() => Math.abs(scrollY) < 2);
      layout.footerLinkReturnsTop = await page.evaluate(() => Math.abs(scrollY) < 2);
    }
    review.layouts.push(layout);
  }
  const iconHref = await page.locator('link[rel="icon"]').first().getAttribute('href');
  const response = await page.request.get(new URL(iconHref, base).href);
  review.favicon = { href: iconHref, status: response.status(), contentType: response.headers()['content-type'], svg: (await response.text()).includes('<svg') };
} finally {
  await browser.close();
}

await fs.writeFile(`docs/screenshots/${prefix}-review.json`, JSON.stringify(review, null, 2));
console.log(JSON.stringify(review, null, 2));
if (review.errors.length || review.layouts.some(item => item.overflow || item.navigationOverlap || !item.svg || item.href !== '#top') || review.favicon?.status !== 200) process.exitCode = 1;
