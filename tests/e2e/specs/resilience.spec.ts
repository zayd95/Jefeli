/**
 * P1 resilience through the real UI, with two fresh accounts (no DÉMO dependency): what a pilot
 * member's phone actually goes through — a flaky network during an upload and while sending a
 * message, a double tap on an offer, the app being killed mid-publication, coming back after the
 * access token expired, an old shared link to an article that no longer exists, and (W1.3) a feed
 * request the server cannot answer — offline, or a database behind the app (the staging « Oups »).
 * Browser renders of the React Native app (Expo web build), not a device.
 */
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { btn, field, FIXTURE, newDevice, publishListing, runId, shot, signUp, WEB_URL } from './helpers';

const RUN = runId();
const PASSWORD = 'Test-jefeli-2026!';
const SELLER = { name: `Rokhaya Test ${RUN}`, email: `rs-${RUN}@e2e.jefeli.test`, handle: `rokhaya_${RUN}`, password: PASSWORD };
const BUYER = { name: `Ibou Test ${RUN}`, email: `rb-${RUN}@e2e.jefeli.test`, handle: `ibou_${RUN}`, password: PASSWORD };
const ITEM = `Sac en cuir ${RUN}`;
const DIR = 'resilience';

let ctxS: BrowserContext;
let ctxB: BrowserContext;
let s: Page;
let b: Page;
let productUrl = '';

const visible = (l: Locator) => l.filter({ visible: true }).first();

test.describe.serial('P1 resilience: network, double taps, restarts, expired sessions, stale links', () => {
  test.beforeAll(async ({ browser }) => {
    ({ ctx: ctxS, page: s } = await newDevice(browser));
    ({ ctx: ctxB, page: b } = await newDevice(browser));
    await signUp(s, SELLER);
    await signUp(b, BUYER);
  });

  test.afterAll(async () => {
    await ctxS?.close();
    await ctxB?.close();
  });

  test('an upload cut twice by the network still publishes the article (automatic retry)', async () => {
    let cut = 0;
    await s.route('**/storage/v1/object/public-media/**', async (route) => {
      if (route.request().method() !== 'GET' && cut < 2) {
        cut += 1;
        await route.abort('internetdisconnected');
        return;
      }
      await route.continue();
    });
    await publishListing(s, { file: FIXTURE('bag.jpg'), title: ITEM, price: '20000', category: 'Sacs & accessoires', condition: 'Neuf' });
    expect(cut).toBe(2);
    productUrl = new URL(s.url()).pathname;
    await expect(visible(s.getByText(ITEM, { exact: true }))).toBeVisible();
    await s.unroute('**/storage/v1/object/public-media/**');
    await shot(s, DIR, 'S-published-after-two-cuts');
  });

  test('a double tap on « Envoyer la proposition » records exactly one offer, without an error', async () => {
    await b.goto(productUrl);
    await btn(b, 'Faire une offre').click();
    await field(b, 'Votre offre').fill('17000');
    await btn(b, 'Envoyer la proposition').dblclick();
    await expect(b).toHaveURL(/\/chat\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(visible(b.getByText('OFFRE DE PRIX', { exact: true }))).toBeVisible();
    await b.waitForTimeout(1500);
    await expect(b.getByText('OFFRE DE PRIX', { exact: true }).filter({ visible: true })).toHaveCount(1);
    await expect(b.getByText('Vous avez déjà une proposition en attente pour cet article.')).toHaveCount(0);
    await shot(b, DIR, 'B-one-offer-after-double-tap');
  });

  test('a message that fails to send stays in the composer and goes out on retry', async () => {
    const text = `Je peux venir samedi ? ${RUN}`;
    let failed = false;
    await b.route('**/rest/v1/messages*', async (route) => {
      if (route.request().method() === 'POST' && !failed) {
        failed = true;
        await route.abort('internetdisconnected');
        return;
      }
      await route.continue();
    });
    const box = visible(b.getByRole('textbox', { name: 'Message' }));
    await box.fill(text);
    await btn(b, 'Envoyer').click();
    await expect(visible(b.getByText('Connexion impossible. Vérifiez votre réseau et réessayez.'))).toBeVisible({ timeout: 10_000 });
    await expect(box).toHaveValue(text);
    await btn(b, 'Envoyer').click();
    await expect(visible(b.getByText(text, { exact: true }))).toBeVisible({ timeout: 20_000 });
    await expect(box).toHaveValue('');
    await b.unroute('**/rest/v1/messages*');
    await shot(b, DIR, 'B-message-sent-on-retry');
  });

  test('an unfinished article survives the app being closed, and is only deleted on request (local draft)', async () => {
    const draftTitle = `Brouillon ${RUN}`;
    await s.goto('/publish/listing');
    await field(s, 'Nom de l’article').fill(draftTitle);
    await s.getByRole('button', { name: /^Description : facultatif/ }).click();
    await field(s, 'Description (facultatif)').fill('Cuir véritable, cousu main.');
    await btn(s, 'Terminé').click();
    await s.waitForTimeout(900); // the draft is saved 400 ms after the last keystroke
    await s.reload();
    // W1.3: the draft is never restored or replaced silently: the editor asks first.
    await expect(visible(s.getByTestId('draft-choice'))).toBeVisible({ timeout: 20_000 });
    await expect(visible(s.getByText(new RegExp(`Brouillon : « ${draftTitle} »`)))).toBeVisible();
    await btn(s, 'Continuer le brouillon').click();
    await expect(visible(s.getByRole('textbox', { name: 'Nom de l’article' }))).toHaveValue(draftTitle);
    await expect(visible(s.getByRole('button', { name: /^Description : Cuir véritable/ }))).toBeVisible();
    await s.reload();
    await btn(s, 'Nouvel article').click();
    await btn(s, 'Supprimer et commencer').click();
    await expect(visible(s.getByRole('textbox', { name: 'Nom de l’article' }))).toHaveValue('');
    await shot(s, DIR, 'S-draft-continued-then-deleted-on-request');
  });

  test('a returning member whose access token expired is signed back in silently', async () => {
    const before = await b.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => /auth-token$/.test(k));
      if (!key) return null;
      const session = JSON.parse(localStorage.getItem(key) as string);
      // As after hours in the background: the access token is past its expiry.
      session.expires_at = Math.floor(Date.now() / 1000) - 3600;
      localStorage.setItem(key, JSON.stringify(session));
      return { key, access: session.access_token as string };
    });
    expect(before).not.toBeNull();
    await b.goto('/messages');
    await expect(b.getByRole('button', { name: new RegExp(`Conversation avec ${SELLER.name}`) })).toBeVisible({ timeout: 30_000 });
    await expect(b.getByRole('button', { name: 'Créer un compte' })).toHaveCount(0);
    const after = await b.evaluate((key) => JSON.parse(localStorage.getItem(key) as string), before!.key);
    expect(after.access_token).not.toBe(before!.access);
    expect(after.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    await shot(b, DIR, 'B-signed-in-after-refresh');
  });

  test('an old shared link to a deleted article says it is unavailable, in the app and on the web', async () => {
    const id = productUrl.split('/').pop() as string;
    await s.goto(productUrl);
    await btn(s, 'Plus d’options').last().click();
    await btn(s, 'Supprimer l’article').click(); // the confirmation dialog is accepted by the helper
    await expect(s).not.toHaveURL(new RegExp(`/p/${id}$`), { timeout: 20_000 });

    await b.goto(productUrl);
    await expect(visible(b.getByText('Article indisponible', { exact: true }))).toBeVisible({ timeout: 30_000 });
    const web = await b.request.get(`${WEB_URL}/p/${id}`);
    expect(web.status()).toBe(404);
    await shot(b, DIR, 'B-deleted-article-link');
  });

  test('a feed the server cannot answer leaves a way forward, not a dead homepage (W1.3)', async () => {
    const feed = '**/rest/v1/rpc/get_feed*';
    let mode: 'offline' | 'outdated' | 'ok' = 'offline';
    let calls = 0;
    await b.route(feed, async (route) => {
      if (mode === 'ok') return route.continue();
      calls += 1;
      if (mode === 'offline') return route.abort('internetdisconnected');
      // What PostgREST answered on staging when the app asked for columns it didn't have yet.
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: '42703', message: 'column post_media.language does not exist', details: null, hint: null }),
      });
    });
    const state = b.getByTestId('error-state');

    // Offline: retried automatically (3 attempts), then a clear message and a way around.
    await b.goto('/');
    await expect(state.getByText('Connexion impossible', { exact: true })).toBeVisible({ timeout: 30_000 });
    expect(calls).toBe(3);
    await expect(state.getByRole('button', { name: 'Explorer' })).toBeVisible();

    // A database behind the app: not retried (it can't help), says so, and gives support the cause.
    mode = 'outdated';
    calls = 0;
    await state.getByRole('button', { name: 'Réessayer' }).click();
    await expect(state.getByText('Mise à jour en cours', { exact: true })).toBeVisible({ timeout: 20_000 });
    await b.waitForTimeout(2500);
    expect(calls).toBe(1);
    await state.getByRole('button', { name: 'Détails pour l’assistance' }).click();
    await expect(state.getByText(/Code : 42703/)).toBeVisible();
    await expect(state.getByText(/Écran : Accueil · Pour toi/)).toBeVisible();
    await expect(state.getByText(/column post_media\.language does not exist/)).toBeVisible();
    await expect(state.getByRole('button', { name: 'Copier les détails' })).toBeVisible();
    await expect(b.getByRole('button', { name: 'Rechercher' })).toBeVisible(); // header and navigation stay usable
    await shot(b, DIR, 'B-feed-outdated-database');

    // Once the database is up to date, « Réessayer » brings the feed back without a reload.
    mode = 'ok';
    await state.getByRole('button', { name: 'Réessayer' }).click();
    await expect(state).toHaveCount(0, { timeout: 20_000 });
    await b.unroute(feed);
    await shot(b, DIR, 'B-feed-recovered');
  });
});
