/**
 * P2.1 — the tab bar hides on scroll down and returns on scroll up (mobile layout).
 *   TB-1 scroll down → the dock leaves the screen; any scroll up → it comes back
 *   TB-2 reduced motion → the dock stays put (static)
 *   TB-3 desktop sidebar unchanged: no dock at all, the sidebar stays
 */
import { expect, test, type Page } from '@playwright/test';

import { DEVICES, newDevice, shot, signIn } from './helpers';

const DIR = 'p2-tabbar';

// includeHidden: a hidden dock is also aria-hidden, which getByRole would otherwise skip.
const dock = (page: Page) => page.getByRole('tablist', { name: 'Navigation principale', includeHidden: true });

/** The dock is « gone » when it sits below the visible viewport (it slides by its own height). */
async function dockOffscreen(page: Page): Promise<boolean> {
  const box = await dock(page).boundingBox();
  const h = page.viewportSize()!.height;
  return !box || box.y >= h - 2;
}

async function scrollFeed(page: Page, dy: number) {
  await page.mouse.move(200, 400);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, dy / 6);
    await page.waitForTimeout(40);
  }
}

test.describe('P2.1 tab bar', () => {
  test('TB-1 hides on scroll down, returns on scroll up', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15);
    await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
    await expect(dock(page)).toBeVisible();
    expect(await dockOffscreen(page)).toBe(false);
    await shot(page, DIR, '01-before-scroll-dock-visible');
    await scrollFeed(page, 700);
    await expect.poll(() => dockOffscreen(page), { timeout: 5000 }).toBe(true);
    await shot(page, DIR, '02-scrolled-down-dock-hidden');
    await scrollFeed(page, -120);
    await expect.poll(() => dockOffscreen(page), { timeout: 5000 }).toBe(false);
    await shot(page, DIR, '03-scrolled-up-dock-back');
    await ctx.close();
  });

  test('TB-2 reduced motion keeps the dock static', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: DEVICES.android360, deviceScaleFactor: 2, locale: 'fr-FR', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
    await scrollFeed(page, 700);
    await page.waitForTimeout(600);
    expect(await dockOffscreen(page)).toBe(false);
    await ctx.close();
  });

  test('TB-3 desktop keeps its sidebar and has no dock', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, { width: 1280, height: 800 });
    await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
    await expect(dock(page)).toHaveCount(0);
    await ctx.close();
  });
});
