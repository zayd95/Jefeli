/**
 * Flexible pricing and conversation-first commerce, through the real UI with two fresh accounts:
 * a seller publishes a « Prix sur demande » article (no price at all) and an « À discuter »
 * article with a starting price through the 3-step composer; cards, the product page and the
 * public web page never show « 0 F »; a buyer still makes a numeric offer; and the buyer sends
 * both articles into one conversation with the multi-article picker (no cart, nothing reserved).
 */
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { FIXTURE, btn, field, newDevice, publishListing, runId, shot, signUp, WEB_URL } from './helpers';

const RUN = runId();
const PASSWORD = 'Test-jefeli-2026!';
const S = { name: `Seynabou Test ${RUN}`, email: `ps-${RUN}@e2e.jefeli.test`, handle: `seynabou_${RUN}`, password: PASSWORD };
const BUYER = { name: `Cheikh Test ${RUN}`, email: `pb-${RUN}@e2e.jefeli.test`, handle: `cheikh_${RUN}`, password: PASSWORD };
const ON_REQUEST = `Boubou sur mesure ${RUN}`;
const NEGOTIABLE = `Lot de cabas ${RUN}`;
const DIR = 'pricing';

let ctxS: BrowserContext;
let ctxB: BrowserContext;
let s: Page;
let b: Page;
let onRequestUrl = '';
let negotiableUrl = '';

const visible = (l: Locator) => l.filter({ visible: true }).first();

async function expectNoZeroPrice(page: Page) {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/(^|[^\d\s])\s?0 F/m);
}

test.describe.serial('Flexible pricing and multi-article conversations', () => {
  test.beforeAll(async ({ browser }) => {
    ({ ctx: ctxS, page: s } = await newDevice(browser));
    ({ ctx: ctxB, page: b } = await newDevice(browser));
    await signUp(s, S);
    await signUp(b, BUYER);
  });

  test.afterAll(async () => {
    await ctxS?.close();
    await ctxB?.close();
  });

  test('a « Prix affiché » article cannot go to step 2 without a price', async () => {
    await s.goto('/publish/listing');
    await field(s, 'Titre').fill('Article sans prix');
    await btn(s, 'Continuer').click();
    await expect(visible(s.getByText(/Indiquez un prix, ou choisissez « Prix sur demande »/))).toBeVisible();
    await expect(visible(s.getByText(/Étape 1 sur 3/))).toBeVisible();
    await shot(s, DIR, 'S-price-required-for-fixed');
  });

  test('« Prix sur demande »: published without any price, shown as such everywhere', async () => {
    await publishListing(s, {
      file: FIXTURE('dress.jpg'),
      title: ON_REQUEST,
      priceMode: 'Prix sur demande',
      category: 'Mode femme',
      condition: 'Neuf',
    });
    onRequestUrl = s.url();
    await expect(visible(s.getByText('Prix sur demande', { exact: true }))).toBeVisible();
    await expectNoZeroPrice(s);
    await shot(s, DIR, 'S-product-on-request');

    // Public web share page (no login).
    const id = onRequestUrl.split('/p/')[1];
    const web = await s.context().newPage();
    await web.goto(`${WEB_URL}/p/${id}`);
    await expect(web.getByText('Prix sur demande').first()).toBeVisible();
    await expect(web).toHaveTitle(/Prix sur demande/);
    await expectNoZeroPrice(web);
    await web.close();
  });

  test('« À discuter » with a starting price; the boutique lists both without 0 F', async () => {
    await publishListing(s, {
      file: FIXTURE('bag.jpg'),
      title: NEGOTIABLE,
      priceMode: 'À discuter',
      price: '30000',
      category: 'Sacs & accessoires',
      condition: 'Neuf',
    });
    negotiableUrl = s.url();
    await expect(visible(s.getByText('30 000 F CFA · à discuter', { exact: true }))).toBeVisible();

    await s.goto('/profile');
    await visible(s.getByRole('tab', { name: /^Boutique, 2/ })).click();
    await expect(visible(s.getByRole('button', { name: new RegExp(`${ON_REQUEST}, Prix sur demande`) }))).toBeVisible();
    await expect(visible(s.getByRole('button', { name: new RegExp(`${NEGOTIABLE}, 30 000 F CFA · à discuter`) }))).toBeVisible();
    await expectNoZeroPrice(s);
    await shot(s, DIR, 'S-boutique-price-modes');
  });

  test('the buyer still makes a numeric offer on a « Prix sur demande » article', async () => {
    await b.goto(onRequestUrl);
    await expect(visible(b.getByText('Prix sur demande', { exact: true }))).toBeVisible();
    await btn(b, 'Faire une offre').click();
    await field(b, 'Votre offre').fill('45000');
    await btn(b, 'Envoyer la proposition').click();
    await expect(visible(b.getByText('OFFRE DE PRIX', { exact: true }))).toBeVisible({ timeout: 30_000 });
    await expect(visible(b.getByText('45 000 F CFA'))).toBeVisible();
    await shot(b, DIR, 'B-offer-on-request');
  });

  test('the buyer sends several of the seller’s articles into the same conversation', async () => {
    // Same conversation (the offer opened it): « + » → « Envoyer des articles ».
    await btn(b, 'Joindre une photo ou des articles').click();
    await btn(b, 'Envoyer des articles').click();
    await expect(visible(b.getByRole('tab', { name: /^Articles de Seynabou/ }))).toHaveAttribute('aria-selected', 'true');
    await visible(b.getByRole('checkbox', { name: new RegExp(`^${ON_REQUEST}`) })).click();
    await visible(b.getByRole('checkbox', { name: new RegExp(`^${NEGOTIABLE}`) })).click();
    await shot(b, DIR, 'B-product-picker');
    await btn(b, 'Envoyer 2 articles').click();
    await expect(visible(b.getByRole('button', { name: `Article ${NEGOTIABLE}` }))).toBeVisible({ timeout: 20_000 });
    await expect(visible(b.getByRole('button', { name: `Article ${ON_REQUEST}` }))).toBeVisible();
    await expectNoZeroPrice(b);
    await shot(b, DIR, 'B-chat-two-articles');

    // The seller receives both cards in the same thread.
    await s.goto('/messages');
    await s.getByRole('button', { name: new RegExp(`Conversation avec ${BUYER.name}`) }).click();
    await expect(visible(s.getByRole('button', { name: `Article ${NEGOTIABLE}` }))).toBeVisible({ timeout: 20_000 });
    await expect(visible(s.getByText('OFFRE DE PRIX', { exact: true }))).toBeVisible();
    await shot(s, DIR, 'S-chat-receives-articles');
  });

  test('negotiable listing page offers the WhatsApp share and a direct message', async () => {
    await b.goto(negotiableUrl);
    await expect(visible(b.getByRole('button', { name: 'Partager sur WhatsApp' }))).toBeVisible();
    await expect(visible(b.getByRole('button', { name: 'Envoyer un message' }))).toBeVisible();
  });
});
