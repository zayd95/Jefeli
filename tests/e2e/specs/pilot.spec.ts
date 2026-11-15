/**
 * Pilot cut — end-to-end checks through the real UI (local stack, DÉMO seed).
 *   PC-B1 A signed-out visitor opens an article link, signs up, finishes onboarding and lands back
 *         on that same article (not on Accueil).
 *   PC-B2 The web article page's « Faire une offre » opens /offer/<id>: after sign-up the member
 *         lands on the offer form for that article.
 */
import { expect, test, type Page } from '@playwright/test';

import { btn, DEVICES, field, newDevice, runId, shot, signIn } from './helpers';

const RUN = runId();
const PASSWORD = 'Test-jefeli-2026!';
const DIR = 'pilot-cut';

/** One real DÉMO article: its id and title, found as a member would (Explorer → first card). */
async function demoArticle(page: Page): Promise<{ id: string; title: string }> {
  await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
  await page.goto('/explore');
  const card = page.getByTestId('listing-card').first();
  await expect(card).toBeVisible();
  const label = (await card.getAttribute('aria-label')) ?? '';
  await card.click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/);
  const id = page.url().match(/\/p\/([0-9a-f-]{36})/)![1]!;
  return { id, title: label.replace(/^Épinglé\. /, '').split(', ')[0]! };
}

async function signUpFromWall(page: Page, who: { name: string; email: string; handle: string }) {
  await btn(page, 'Créer un compte').click();
  await field(page, 'Votre nom').fill(who.name);
  await field(page, 'E-mail').fill(who.email);
  await field(page, 'Mot de passe').fill(PASSWORD);
  await page.getByRole('checkbox', { name: 'J’ai 18 ans ou plus.' }).click();
  await page.getByRole('checkbox', { name: /J’accepte les conditions/ }).click();
  await btn(page, 'Créer mon compte').click();
  await expect(page.getByText('Bienvenue chez vous.')).toBeVisible();
  await field(page, 'Votre pseudo').fill(who.handle);
  await expect(page.getByText(/^Disponible/)).toBeVisible();
  await page.getByRole('checkbox', { name: 'Je confirme avoir 18 ans ou plus' }).click();
  await btn(page, 'Entrer dans Jëfëli').click();
}

test('PC-B1 · an article link survives sign-up and onboarding', async ({ browser }) => {
  const { ctx: seed, page: s } = await newDevice(browser, DEVICES.iphone15ProMax);
  const article = await demoArticle(s);
  await seed.close();

  const { ctx, page } = await newDevice(browser, DEVICES.iphone15ProMax);
  await page.goto(`/p/${article.id}`);
  await expect(btn(page, 'Créer un compte')).toBeVisible();
  await signUpFromWall(page, { name: `Acheteur Retour ${RUN}`, email: `ret-${RUN}@e2e.jefeli.test`, handle: `retour_${RUN}` });
  await expect(page).toHaveURL(new RegExp(`/p/${article.id}`), { timeout: 30_000 });
  await expect(page.getByText(article.title, { exact: true }).first()).toBeVisible();
  await shot(page, DIR, 'b1-back-on-article-after-signup');
  await ctx.close();
});

test('PC-B2 · an offer link from the web page lands on the offer form after sign-up', async ({ browser }) => {
  const { ctx: seed, page: s } = await newDevice(browser, DEVICES.iphone15ProMax);
  const article = await demoArticle(s);
  await seed.close();

  const { ctx, page } = await newDevice(browser, DEVICES.iphone15ProMax);
  // What the web article page's « Faire une offre » opens (item d): the offer route itself.
  await page.goto(`/offer/${article.id}`);
  await signUpFromWall(page, { name: `Acheteur Offre ${RUN}`, email: `off-${RUN}@e2e.jefeli.test`, handle: `offre_${RUN}` });
  await expect(page).toHaveURL(new RegExp(`/offer/${article.id}`), { timeout: 30_000 });
  await expect(page.getByText(article.title).first()).toBeVisible();
  await shot(page, DIR, 'b2-offer-form-after-signup');
  await ctx.close();
});
