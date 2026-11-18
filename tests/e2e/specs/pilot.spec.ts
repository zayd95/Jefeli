/**
 * Pilot cut — end-to-end checks through the real UI (local stack, DÉMO seed).
 *   PC-B1 A signed-out visitor opens an article link, signs up, finishes onboarding and lands back
 *         on that same article (not on Accueil).
 *   PC-B2 The web article page's « Faire une offre » opens /offer/<id>: after sign-up the member
 *         lands on the offer form for that article.
 */
import { expect, test, type Page } from '@playwright/test';

import { btn, DEVICES, field, FIXTURE, newDevice, publishListing, runId, shot, signIn, signUp, WEB_URL } from './helpers';

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
  // Only the visible copy counts: the previous screen's title can still sit (hidden) in the navigation stack.
  await expect(page.getByText(article.title).filter({ visible: true }).first()).toBeVisible();
  await shot(page, DIR, 'b2-offer-form-after-signup');
  await ctx.close();
});

/**
 * PC-C1 Waxaale — three members: the seller accepts one buyer's offer. The item is reserved, the
 * other buyer is told and their notification opens their chat with the « réservé » line; the
 * winning buyer's notification opens the chat, then the agreement, where they set the handover;
 * the seller's handover notification opens the same chat.
 */
test('PC-C1 · accept reserves the item, closes the other offer, handover, notifications open the chat', async ({ browser }) => {
  test.setTimeout(240_000);
  const S = { name: `Vendeuse Remise ${RUN}`, email: `rs-${RUN}@e2e.jefeli.test`, handle: `remise_s_${RUN}`, password: PASSWORD };
  const B1 = { name: `Gagnant Remise ${RUN}`, email: `r1-${RUN}@e2e.jefeli.test`, handle: `remise_a_${RUN}`, password: PASSWORD };
  const B2 = { name: `Second Remise ${RUN}`, email: `r2-${RUN}@e2e.jefeli.test`, handle: `remise_b_${RUN}`, password: PASSWORD };
  const TITLE = `Radio remise ${RUN}`;
  const { ctx: cs, page: s } = await newDevice(browser, DEVICES.iphone15ProMax);
  const { ctx: c1, page: b1 } = await newDevice(browser, DEVICES.iphone15ProMax);
  const { ctx: c2, page: b2 } = await newDevice(browser, DEVICES.iphone15ProMax);

  await signUp(s, S);
  await publishListing(s, { file: FIXTURE('shoe.jpg'), title: TITLE, mode: 'Vente', price: '30000', category: 'Chaussures', condition: 'Bon état' });
  await expect(s.getByText('30 000 F CFA').first()).toBeVisible({ timeout: 60_000 });
  const productUrl = s.url();

  for (const [page, who, amount] of [
    [b1, B1, '27000'],
    [b2, B2, '25000'],
  ] as const) {
    await signUp(page, who);
    await page.goto(productUrl);
    await btn(page, 'Faire une offre').click();
    await field(page, 'Votre offre').fill(amount);
    await btn(page, 'Envoyer la proposition').click();
    await expect(page.getByText(/^· Offre$/).last()).toBeVisible();
  }

  // The seller accepts B1's offer from the chat.
  await s.goto('/messages');
  await s.getByRole('button', { name: new RegExp(`Conversation avec ${B1.name}`) }).click();
  await btn(s, 'Accepter').first().click();
  await expect(s.getByText(/L’article est réservé/).first()).toBeVisible();
  await shot(s, DIR, 'c1-seller-accepted-item-reserved');

  // B2: told, and the notification opens B2's own chat with the closed line.
  await b2.goto('/notifications');
  await b2.getByText(/est réservé pour un autre acheteur/).first().click();
  await expect(b2).toHaveURL(/\/chat\/[0-9a-f-]{36}/);
  await expect(b2.getByText('L’article a été réservé pour un autre acheteur. Cette proposition est close.').first()).toBeVisible();
  await expect(b2.getByText('Article réservé par un autre').first()).toBeVisible();
  await shot(b2, DIR, 'c2-other-buyer-offer-closed');
  // …and the item no longer takes offers.
  await b2.goto(productUrl);
  await expect(b2.getByText('Réservé').first()).toBeVisible();
  await expect(btn(b2, 'Faire une offre')).toHaveCount(0);

  // B1: the acceptance notification opens the chat; the agreement holds the handover step.
  await b1.goto('/notifications');
  await b1.getByText(/a accepté votre proposition/).first().click();
  await expect(b1).toHaveURL(/\/chat\/[0-9a-f-]{36}/);
  await btn(b1, 'Voir l’accord').first().click();
  const card = b1.getByTestId('handover-card');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Demain', exact: true }).click();
  await card.getByRole('button', { name: '18 h', exact: true }).click();
  await field(b1, 'Lieu').fill('Station Total, VDN');
  await shot(b1, DIR, 'c3-buyer-sets-handover');
  await btn(b1, 'Proposer la remise').click();
  await expect(card.getByText(/Vous l’avez proposé/)).toBeVisible();
  await expect(card.getByText('Station Total, VDN')).toBeVisible();

  // Seller: the handover notification opens the same chat, with the handover line.
  await s.goto('/notifications');
  await s.getByText(/propose la remise : Station Total, VDN/).first().click();
  await expect(s).toHaveURL(/\/chat\/[0-9a-f-]{36}/);
  await expect(s.getByText('Remise proposée : lieu et heure dans l’accord.').first()).toBeVisible();
  await shot(s, DIR, 'c4-seller-handover-in-chat');
  await btn(s, 'Voir l’accord').first().click();
  await expect(s.getByTestId('handover-card').getByText(`Proposé par ${B1.name}.`)).toBeVisible();
  await shot(s, DIR, 'c5-seller-agreement-handover');

  await Promise.all([cs.close(), c1.close(), c2.close()]);
});

/**
 * PC-D1 From the public web article page (apps/web, no login wall), « Faire une offre » opens the
 * offer form of the app: a visitor without an account signs up, comes back to that offer, and
 * sends it. (With the Android app installed, the same https link opens the app: App Links,
 * apps/mobile/app.json › android.intentFilters — not testable in a browser.)
 */
test('PC-D1 · web article page « Faire une offre » → sign-up → back on the offer → sent', async ({ browser }) => {
  test.setTimeout(180_000);
  const { ctx: seed, page: s } = await newDevice(browser, DEVICES.iphone15ProMax);
  const article = await demoArticle(s);
  await seed.close();

  const { ctx, page } = await newDevice(browser, DEVICES.iphone15ProMax);
  await page.goto(`${WEB_URL}/p/${article.id}`);
  const offer = page.getByTestId('web-make-offer');
  await expect(offer).toBeVisible();
  await expect(offer).toHaveAttribute('href', new RegExp(`/offer/${article.id}$`));
  await shot(page, DIR, 'd1-web-article-offer-button');
  await offer.click();
  await expect(page).toHaveURL(new RegExp(`/offer/${article.id}`));
  await signUpFromWall(page, { name: `Acheteur Web ${RUN}`, email: `web-${RUN}@e2e.jefeli.test`, handle: `web_${RUN}` });
  await expect(page).toHaveURL(new RegExp(`/offer/${article.id}`), { timeout: 30_000 });
  await field(page, 'Votre offre').fill('1000');
  await btn(page, 'Envoyer la proposition').click();
  await expect(page.getByText(/^· Offre$/).last()).toBeVisible();
  await shot(page, DIR, 'd2-offer-sent-after-signup');
  await ctx.close();
});

/**
 * PC-E1 « Partage ta boutique »: a new seller's first listing opens the moment with the 9:16
 * WhatsApp status card; one tap gives the image (download in a desktop browser; the share sheet
 * on a phone) and copies the link for the caption. The second listing does not show it again.
 */
test('PC-E1 · first listing → « Partage ta boutique » moment → WhatsApp status card (9:16)', async ({ browser }) => {
  test.setTimeout(180_000);
  const S = { name: `Vendeuse Statut ${RUN}`, email: `st-${RUN}@e2e.jefeli.test`, handle: `statut_${RUN}`, password: PASSWORD };
  const { ctx, page } = await newDevice(browser, DEVICES.iphone15ProMax);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signUp(page, S);
  await publishListing(page, { file: FIXTURE('bag.jpg'), title: `Sac statut ${RUN}`, mode: 'Vente ou troc', price: '18000', category: 'Sacs & accessoires', condition: 'Comme neuf', keepMoment: true });
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}\?first=1$/);
  const moment = page.getByTestId('share-boutique-moment');
  await expect(moment).toBeVisible();
  await expect(moment.getByText('Ton premier article est en ligne.', { exact: false })).toBeVisible();
  await page.waitForTimeout(1500); // the card preview loads from the web site
  await shot(page, DIR, 'e1-share-boutique-moment');

  const download = page.waitForEvent('download');
  await moment.getByRole('button', { name: /Partager en statut WhatsApp/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^jefeli-statut-[0-9a-f]{8}\.png$/);
  await file.saveAs(require('node:path').join(require('./helpers').EVIDENCE, DIR, 'e2-whatsapp-status-card-9x16.png'));
  await expect(page.getByText(/Image enregistrée et lien copié/)).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toMatch(new RegExp(`Sac statut ${RUN} — sur Jëfëli : .*/p/[0-9a-f-]{36}$`));

  // The card exists only for public articles.
  expect((await page.request.get(`${WEB_URL}/p/00000000-0000-4000-8000-000000000000/status-card`)).status()).toBe(404);

  // Second listing: no moment.
  await publishListing(page, { file: FIXTURE('shoe.jpg'), title: `Chaussures statut ${RUN}`, mode: 'Vente', price: '9000', category: 'Chaussures', condition: 'Bon état' });
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('share-boutique-moment')).toHaveCount(0);
  await ctx.close();
});

/**
 * PC-F1 Wecci « Donner »: the seller gives an article (no price field; 0 F only in this mode). It
 * reads « À donner » on the card, the article and the public page; nobody can make an offer on it,
 * the taker writes to the giver. The swap mode is now labelled « Troquer ».
 */
test('PC-F1 · « Donner »: 0 F gift, no offer, the taker writes; « Troquer » label', async ({ browser }) => {
  test.setTimeout(180_000);
  const G = { name: `Donneuse ${RUN}`, email: `don-${RUN}@e2e.jefeli.test`, handle: `don_${RUN}`, password: PASSWORD };
  const T = { name: `Preneur ${RUN}`, email: `pre-${RUN}@e2e.jefeli.test`, handle: `pre_${RUN}`, password: PASSWORD };
  const TITLE = `Poussette à donner ${RUN}`;
  const { ctx: cg, page: g } = await newDevice(browser, DEVICES.iphone15ProMax);
  await signUp(g, G);
  await publishListing(g, { file: FIXTURE('bag.jpg'), title: TITLE, mode: 'Donner', category: 'Sacs & accessoires', condition: 'Bon état' });
  await expect(g.getByText('À donner').first()).toBeVisible();
  const url = g.url().replace(/\?first=1$/, '');
  const id = url.match(/\/p\/([0-9a-f-]{36})/)![1]!;
  await shot(g, DIR, 'f1-giver-article-a-donner');

  const { ctx: ct, page: t } = await newDevice(browser, DEVICES.iphone15ProMax);
  await signUp(t, T);
  await t.goto(`/p/${id}`);
  await expect(t.getByText('À donner').first()).toBeVisible();
  await expect(t.getByText(/Donner : cet article est offert/)).toBeVisible();
  await expect(btn(t, 'Faire une offre')).toHaveCount(0);
  await expect(t.getByRole('button', { name: /Proposer un échange/ })).toHaveCount(0);
  await shot(t, DIR, 'f2-taker-sees-gift-no-offer');
  await btn(t, 'Écrire au donneur').click();
  await t.getByRole('textbox', { name: 'Message' }).fill('Bonjour, je peux passer la récupérer ?');
  await btn(t, 'Envoyer').click();
  await expect(t.getByText('Bonjour, je peux passer la récupérer ?', { exact: true }).last()).toBeVisible();

  // Public web page: « À donner », no offer buttons.
  await t.goto(`${WEB_URL}/p/${id}`);
  await expect(t.getByText('À donner').first()).toBeVisible();
  await expect(t.getByTestId('web-make-offer')).toHaveCount(0);
  await expect(t.getByTestId('web-propose-trade')).toHaveCount(0);
  await shot(t, DIR, 'f3-web-page-a-donner');
  await Promise.all([cg.close(), ct.close()]);
});

/**
 * PC-G1 Jëf lite: a new seller's first listing carries « NOUVEAU » in Explorer (first in its aisle
 * for 24 h, server-side order) and the profile shows the public level, in the app and on the web.
 */
test('PC-G1 · first listing « NOUVEAU » in Explorer; public level on the profile (app + web)', async ({ browser }) => {
  test.setTimeout(180_000);
  const S = { name: `Nouvelle ${RUN}`, email: `nv-${RUN}@e2e.jefeli.test`, handle: `nouvelle_${RUN}`, password: PASSWORD };
  const TITLE = `Lampe nouvelle ${RUN}`;
  const { ctx, page } = await newDevice(browser, DEVICES.iphone15ProMax);
  await signUp(page, S);
  await publishListing(page, { file: FIXTURE('bag.jpg'), title: TITLE, mode: 'Vente', price: '7000', category: 'Sacs & accessoires', condition: 'Bon état' });

  const { ctx: cv, page: v } = await newDevice(browser, DEVICES.iphone15ProMax);
  await signIn(v, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
  await v.goto('/explore');
  const card = v.getByTestId('listing-card').filter({ hasText: TITLE }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText('NOUVEAU', { exact: true })).toBeVisible();
  await shot(v, DIR, 'g1-explorer-nouveau-badge');

  await v.goto(`/u/${S.handle}`);
  await expect(v.getByTestId('member-level')).toContainText('Nouveau');
  await shot(v, DIR, 'g2-profile-level');
  await v.goto(`${WEB_URL}/${S.handle}`);
  await expect(v.getByTestId('web-member-level')).toHaveText(/Niveau · Nouveau/);
  await Promise.all([ctx.close(), cv.close()]);
});
