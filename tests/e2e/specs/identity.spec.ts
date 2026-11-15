/**
 * P1 identity sprint — the three signature prototypes through the real UI, local stack:
 *   - PI-01 Market aisles: Téléphones / Mode launch aisles, an empty aisle invites « Je cherche »
 *     and its button opens the composer on the « Je cherche » intent (DÉMO seed, read-only).
 *   - PI-02 Waxaale voice offer: a new buyer says the offer out loud (Chromium's fake microphone);
 *     the seller hears it inside the Waxaale card, accepts, and sees « Marché conclu ! ».
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { btn, DEVICES, field, FIXTURE, newDevice, publishListing, runId, shot, signIn, signUp } from './helpers';

test.use({ channel: 'chromium' });

const RUN = runId();
const PASSWORD = 'Test-jefeli-2026!';
const S = { name: `Vendeuse Waxaale ${RUN}`, email: `wx-s-${RUN}@e2e.jefeli.test`, handle: `wx_vend_${RUN}`, password: PASSWORD };
const B = { name: `Acheteur Waxaale ${RUN}`, email: `wx-b-${RUN}@e2e.jefeli.test`, handle: `wx_achat_${RUN}`, password: PASSWORD };
const ARTICLE = `Pagne tissé ${RUN}`;
const DIR = 'p1-identity';

test('PI-01 · market aisles, and an empty aisle invites « Je cherche »', async ({ browser }) => {
  const { ctx, page } = await newDevice(browser, DEVICES.iphone15ProMax);
  await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
  await page.goto('/explore');
  await expect(page.getByTestId('aisle-telephones')).toBeVisible();
  await expect(page.getByTestId('aisle-mode')).toBeVisible();
  await page.getByTestId('aisle-mode').click();
  await expect(page.getByText('Allée Mode', { exact: true })).toBeVisible();
  await page.getByTestId('aisle-mode').click();
  // Sport has no DÉMO article: the aisle asks what the member is looking for instead of looking empty.
  await page.getByRole('button', { name: 'Sport & loisirs' }).click();
  await expect(page.getByTestId('seek-invite')).toBeVisible();
  await shot(page, DIR, 'aisle-empty-seek');
  await btn(page, 'Publier « Je cherche »').click();
  await expect(page).toHaveURL(/publish\/post/);
  await expect(page.getByPlaceholder(/Que cherchez-vous/).filter({ visible: true }).first()).toBeVisible();
  await ctx.close();
});

test.describe.serial('PI-02 · Waxaale voice offer → Marché conclu', () => {
  let cs: BrowserContext;
  let cb: BrowserContext;
  let s: Page;
  let b: Page;
  let productUrl = '';

  test.beforeAll(async ({ browser }) => {
    ({ ctx: cs, page: s } = await newDevice(browser));
    ({ ctx: cb, page: b } = await newDevice(browser, undefined, { mic: true }));
  });
  test.afterAll(async () => {
    await cs?.close();
    await cb?.close();
  });

  test('seller lists an article, buyer offers with a voice note', async () => {
    await signUp(s, S);
    await publishListing(s, { file: FIXTURE('shoe.jpg'), title: ARTICLE, mode: 'Vente', price: '20000', category: 'Tissus & wax', condition: 'Neuf', description: 'Pagne tissé main, 2 m.' });
    await expect(s.getByText(ARTICLE, { exact: true }).last()).toBeVisible({ timeout: 60_000 });
    productUrl = s.url();

    await signUp(b, B);
    await b.goto(productUrl);
    await btn(b, 'Faire une offre').click();
    await field(b, 'Votre offre').fill('17000');
    await btn(b, 'Enregistrer ma voix').click();
    await b.getByRole('button', { name: 'Commencer l’enregistrement' }).click();
    await expect(btn(b, 'Terminer')).toBeVisible({ timeout: 10_000 });
    await b.waitForTimeout(2500);
    await btn(b, 'Terminer').click();
    await btn(b, 'Joindre à l’offre').click();
    await expect(btn(b, 'Retirer le message vocal')).toBeVisible();
    await btn(b, 'Envoyer la proposition').click();
    await expect(b.getByTestId('waxaale-card').last()).toBeVisible({ timeout: 30_000 });
    await expect(b.getByTestId('waxaale-voice').last()).toBeVisible();
    await expect(b.getByText('VOTRE OFFRE À VOIX HAUTE', { exact: true }).last()).toBeVisible();
    await shot(b, DIR, 'buyer-voice-offer-sent');
  });

  test('seller hears the offer in the card, accepts, and sees « Marché conclu ! »', async () => {
    await s.goto('/messages');
    await s.getByText(B.name).first().click();
    const card = s.getByTestId('waxaale-card').last();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(s.getByTestId('waxaale-voice').last()).toBeVisible();
    await expect(s.getByText(/^ÉCOUTEZ /).last()).toBeVisible();
    await expect(card.getByText('17 000 F CFA')).toBeVisible();
    await shot(s, DIR, 'seller-voice-offer-received');
    await btn(s, 'Accepter').last().click();
    await expect(s.getByTestId('deal-sealed')).toBeVisible();
    await expect(s.getByText('Marché conclu !', { exact: true })).toBeVisible();
    await shot(s, DIR, 'seller-deal-sealed');
    // The moment closes by itself; the card now shows the deal.
    await expect(s.getByTestId('deal-sealed')).toHaveCount(0, { timeout: 10_000 });
    await expect(btn(s, 'Voir l’accord').last()).toBeVisible();
  });
});
