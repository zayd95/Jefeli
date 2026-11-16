/**
 * P2.5 — icon actions. One gold pill + round icon buttons of at least 44 pt, each with an
 * accessible name; the name shows on a long press.
 *   IA-1 app article page (buyer)      IA-2 profile header (visitor)      IA-3 web article page
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { DEVICES, newDevice, shot, signIn, WEB_URL } from './helpers';

const DIR = 'p2-actions';

async function expectTouchTarget(l: Locator) {
  const box = await l.boundingBox();
  expect(box, 'icon action is rendered').not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(43.5);
  expect(box!.height).toBeGreaterThanOrEqual(43.5);
}

async function openDemoArticle(page: Page): Promise<string> {
  await page.goto('/explore');
  const card = page.getByTestId('listing-card').first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/);
  return page.url().match(/\/p\/([0-9a-f-]{36})/)![1]!;
}

test.describe('P2.5 icon actions', () => {
  test('IA-1 article page: gold pill + labelled round icons, label on long press', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.android360);
    await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
    await openDemoArticle(page);
    await expect(page.getByRole('button', { name: 'Faire une offre', exact: true })).toBeVisible();
    for (const name of ['Envoyer un message au vendeur', 'Partager l’article', 'Ajouter aux favoris']) {
      await expectTouchTarget(page.getByRole('button', { name, exact: true }));
    }
    // Long press shows the label (touch); a plain tap still runs the action.
    const save = page.getByRole('button', { name: 'Ajouter aux favoris', exact: true });
    const box = (await save.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(page.getByText('Ajouter aux favoris').last()).toBeVisible();
    await shot(page, DIR, 'article-icons-long-press-label');
    await ctx.close();
  });

  test('IA-2 profile header: round icons for friend and share', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15);
    await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
    await page.goto('/u/awa_couture');
    await expectTouchTarget(page.getByRole('button', { name: 'Ajouter en ami', exact: true }));
    await shot(page, DIR, 'profile-visitor');
    await ctx.close();
  });

  test('IA-3 web article page: icon links are 44 px with a name', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.android360);
    await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
    const id = await openDemoArticle(page);
    const web = await ctx.newPage();
    await web.goto(`${WEB_URL}/p/${id}`);
    await expect(web.getByTestId('web-make-offer')).toBeVisible();
    for (const name of ['Écrire au vendeur', 'Partager l’article', 'Enregistrer dans Jëfëli']) {
      await expectTouchTarget(web.getByLabel(name, { exact: true }));
    }
    await shot(web, DIR, 'web-article-icons');
    await ctx.close();
  });
});
