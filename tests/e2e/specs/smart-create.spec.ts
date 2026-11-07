import { expect, test, type BrowserContext, type Page } from '@playwright/test';


import { execFileSync } from 'node:child_process';

import { APP_URL, btn, DEVICES, field, FIXTURE, newDevice, publishListing, runId, shot, signIn, signUp } from './helpers';

/**
 * W1.2 « Montre, raconte, vends »: the smart + menu, a publication made of photos + a narration
 * (« visite guidée ») + an article, a voice-only publication, voice messages about an article,
 * sharing a publication to a 24-hour status by reference, and the reliability cases (refused
 * microphone, cancelled recording, refresh with a draft).
 *
 * Chromium's fake microphone plays a test tone, so recordings have real audio and a real length.
 */
// getUserMedia is not available in Playwright's headless shell; the full Chromium build (new
// headless mode) has the fake microphone.
test.use({ channel: 'chromium' });

const RUN = runId();
const PASSWORD = 'Jefeli-e2e-2026!';
const S = { name: `Awa Voix ${RUN}`, email: `sc-s-${RUN}@e2e.jefeli.test`, handle: `awa_voix_${RUN}`, password: PASSWORD };
const B = { name: `Moussa Écoute ${RUN}`, email: `sc-b-${RUN}@e2e.jefeli.test`, handle: `moussa_ecoute_${RUN}`, password: PASSWORD };
const ARTICLE = `Boubou brodé ${RUN}`;
const DIR = 'smart-create';

let ctxS: BrowserContext;
let ctxB: BrowserContext;
let s: Page;
let b: Page;
let narratedPost = '';
let voicePost = '';

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const LOCAL = /localhost|127\.0\.0\.1/.test(APP_URL);
const sql = (q: string) => execFileSync('psql', [DB_URL, '-tAc', q], { encoding: 'utf8' });

async function openCreateMenu(p: Page) {
  await p.getByRole('tab', { name: 'Publier' }).click();
  await expect(p.getByRole('button', { name: 'Publication', exact: true })).toBeVisible();
}

/** Records `seconds` of the fake microphone in the open recorder panel, tapping photos at the given seconds. */
async function record(p: Page, seconds: number, showPhotos: Record<number, number> = {}) {
  await p.getByRole('button', { name: 'Commencer l’enregistrement' }).click();
  await expect(p.getByText(/^0:0\d \/ 3:00$/)).toBeVisible();
  for (let t = 1; t <= seconds; t++) {
    await p.waitForTimeout(1000);
    if (showPhotos[t] !== undefined) await p.getByRole('button', { name: `Montrer la photo ${showPhotos[t]}` }).click();
  }
  await btn(p, 'Terminer').click();
  await expect(p.getByRole('button', { name: 'Écouter l’enregistrement' })).toBeVisible();
}

test.describe.serial('W1.2 smart create & connected media', () => {
  test.beforeAll(async ({ browser }) => {
    ({ ctx: ctxS, page: s } = await newDevice(browser, DEVICES.iphone15, { mic: true }));
    ({ ctx: ctxB, page: b } = await newDevice(browser, DEVICES.pixel7, { mic: true }));
    await signUp(s, S);
    await signUp(b, B);
  });

  test.afterAll(async () => {
    await ctxS?.close();
    await ctxB?.close();
  });

  test('SC-01 · the + menu: three choices over the dimmed feed, voice quick start, closes by ×, outside tap or Escape', async () => {
    await openCreateMenu(s);
    for (const name of ['Statut', 'Article']) await expect(s.getByRole('button', { name, exact: true })).toBeVisible();
    await expect(s.getByRole('button', { name: /^Commencer par ma voix/ })).toBeVisible();
    // No article yet: no « Présenter un article »; no draft yet: no « Reprendre ».
    await expect(s.getByRole('button', { name: /^Présenter un de mes articles/ })).toHaveCount(0);
    await expect(s.getByRole('button', { name: /^Reprendre le brouillon/ })).toHaveCount(0);
    // The arc: Publication right above the + (same centre, higher), Statut on its left, Article on its right.
    const box = async (name: string) => (await s.getByRole('button', { name, exact: true }).boundingBox())!;
    const [close, pub, status, article] = [await box('Fermer'), await box('Publication'), await box('Statut'), await box('Article')];
    const cx = (r: { x: number; width: number }) => r.x + r.width / 2;
    expect(Math.abs(cx(close) - cx(pub))).toBeLessThan(4);
    expect(pub.y + pub.height).toBeLessThan(close.y);
    expect(cx(status)).toBeLessThan(cx(pub) - 60);
    expect(cx(article)).toBeGreaterThan(cx(pub) + 60);
    expect(pub.y).toBeLessThan(status.y);
    for (const r of [pub, status, article, close]) expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(44);
    await shot(s, DIR, 'S-create-menu');
    await s.keyboard.press('Escape');
    await expect(s.getByRole('button', { name: 'Publication', exact: true })).toHaveCount(0);
    await openCreateMenu(s);
    await s.getByRole('button', { name: 'Fermer le menu de création' }).click({ position: { x: 20, y: 120 } });
    await expect(s.getByRole('button', { name: 'Publication', exact: true })).toHaveCount(0);
    await openCreateMenu(s);
    await s.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(s.getByRole('button', { name: 'Publication', exact: true })).toHaveCount(0);
  });

  test('SC-02 · seller: four photos, a narration in Wolof that walks through them, an article, published', async () => {
    await publishListing(s, { file: FIXTURE('dress.jpg'), title: ARTICLE, price: '25000', category: 'Chaussures', condition: 'Très bon état' });
    await s.goto('/');
    await openCreateMenu(s);
    await s.getByRole('button', { name: 'Publication', exact: true }).click();
    await expect(s).toHaveURL(/\/publish\/post/);
    const chooser = s.waitForEvent('filechooser');
    await s.getByRole('button', { name: 'Photos · vidéo' }).click();
    await (await chooser).setFiles([FIXTURE('dress.jpg'), FIXTURE('bag.jpg'), FIXTURE('shoe.jpg'), FIXTURE('dress.jpg')]);
    await expect(s.getByText('4/10')).toBeVisible();
    await s.getByRole('button', { name: /^Voix/ }).click();
    await expect(s.getByText('Expliquez vos photos').last()).toBeVisible();
    await record(s, 6, { 2: 2, 4: 3 });
    await expect(s.getByText(/Visite guidée : 3 photos/)).toBeVisible();
    await shot(s, DIR, 'S-recorder-review');
    await btn(s, 'Ajouter').click();
    await expect(s.getByText('Votre explication')).toBeVisible();
    await s.getByRole('radio', { name: 'Wolof' }).click();
    await s.getByRole('checkbox', { name: ARTICLE }).click();
    await field(s, 'Texte').fill(`Nouveau boubou, je vous explique tout ${RUN}`);
    await shot(s, DIR, 'S-composer-photos-voice-article');
    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 90_000 });
    narratedPost = new URL(s.url()).pathname;
    await expect(s.getByRole('button', { name: /^Écouter l’explication, Wolof · 0:0[5-7]/ }).last()).toBeVisible();
    await shot(s, DIR, 'S-narrated-post');
  });

  test('SC-03 · buyer: photos without sound, chooses to listen, the gallery follows the explanation, then the article and the seller', async () => {
    await b.goto(narratedPost);
    const listen = b.getByRole('button', { name: /^Écouter l’explication, Wolof/ }).last();
    await expect(listen).toBeVisible();
    // Nothing plays by itself.
    await b.waitForTimeout(1500);
    await expect(b.getByRole('button', { name: 'Mettre en pause' })).toHaveCount(0);
    await expect(b.getByLabel('Photo 1 sur 4').last()).toBeVisible();
    await listen.click();
    await expect(b.getByRole('button', { name: 'Mettre en pause' }).last()).toBeVisible();
    await expect(b.getByText(/^0:0[1-6] \/ 0:0[5-7]$/).last()).toBeVisible({ timeout: 10_000 });
    // « Visite guidée »: the seller showed photo 2 at about 2 s, photo 3 at about 4 s.
    await expect(b.getByLabel('Photo 2 sur 4').last()).toBeVisible({ timeout: 6_000 });
    await shot(b, DIR, 'B-narration-following-photo-2');
    await expect(b.getByLabel('Photo 3 sur 4').last()).toBeVisible({ timeout: 6_000 });
    await b.getByRole('button', { name: new RegExp(`^Voir l’article ${ARTICLE}`) }).last().click();
    await expect(b).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
    await btn(b, 'Envoyer un message').click();
    await expect(b).toHaveURL(/\/chat\/[0-9a-f-]{36}\?about=/, { timeout: 30_000 });
    await expect(b.getByText(`À propos de ${ARTICLE}`).last()).toBeVisible();
  });

  test('SC-04 · chat: the buyer asks by voice about the article, listens before sending; the seller answers by voice', async () => {
    await b.getByRole('button', { name: 'Enregistrer un message vocal' }).click();
    await expect(b.getByText(/^0:0\d \/ 3:00$/)).toBeVisible();
    await b.waitForTimeout(1500);
    await b.getByRole('button', { name: 'Mettre l’enregistrement en pause' }).click();
    await b.waitForTimeout(800);
    await b.getByRole('button', { name: 'Reprendre l’enregistrement' }).click();
    await b.waitForTimeout(1200);
    await b.getByRole('button', { name: 'Terminer l’enregistrement' }).click();
    await expect(b.getByRole('button', { name: 'Écouter l’enregistrement' })).toBeVisible();
    await shot(b, DIR, 'B-chat-voice-preview');
    await b.getByRole('button', { name: 'Envoyer le message vocal' }).click();
    await expect(b.getByRole('link', { name: `À propos de ${ARTICLE}` }).last()).toBeVisible({ timeout: 30_000 });
    await expect(b.getByRole('button', { name: 'Écouter le message vocal' }).last()).toBeVisible();
    const conversation = new URL(b.url()).pathname;

    await s.goto(conversation);
    await expect(s.getByRole('button', { name: 'Écouter le message vocal' }).last()).toBeVisible({ timeout: 30_000 });
    await s.getByRole('button', { name: 'Écouter le message vocal' }).last().click();
    await expect(s.getByRole('button', { name: 'Pause' }).last()).toBeVisible();
    await s.getByRole('button', { name: 'Enregistrer un message vocal' }).click();
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Terminer l’enregistrement' }).click();
    await s.getByRole('button', { name: 'Envoyer le message vocal' }).click();
    await expect(s.getByRole('button', { name: 'Écouter le message vocal' })).toHaveCount(2, { timeout: 30_000 });
    await b.reload();
    await expect(b.getByRole('button', { name: 'Écouter le message vocal' })).toHaveCount(2, { timeout: 30_000 });
    await shot(b, DIR, 'B-chat-two-voices');
  });

  test('SC-05 · audio only: « Ma voix » from the + menu, published, shown as a voice card in the feed and on the profile', async () => {
    await s.goto('/');
    await openCreateMenu(s);
    await s.getByRole('button', { name: /^Commencer par ma voix/ }).click();
    await expect(s.getByText('Votre voix').last()).toBeVisible();
    await record(s, 3);
    await btn(s, 'Ajouter').click();
    await expect(s.getByText('Votre message vocal')).toBeVisible();
    await s.getByRole('radio', { name: 'Français' }).click();
    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 60_000 });
    voicePost = new URL(s.url()).pathname;
    await expect(s.getByText('EN FRANÇAIS').last()).toBeVisible();
    await s.getByRole('button', { name: 'Écouter la publication vocale' }).last().click();
    await expect(s.getByRole('button', { name: 'Mettre en pause' }).last()).toBeVisible();
    await shot(s, DIR, 'S-voice-post');

    await b.goto(`/u/${S.handle}`);
    await btn(b, 'Suivre').click();
    await expect(b.getByRole('button', { name: 'Abonné(e)' })).toBeVisible();
    await b.goto('/');
    await b.getByRole('tab', { name: 'Abonnements' }).click();
    await expect(b.getByRole('button', { name: 'Écouter la publication vocale' }).first()).toBeVisible({ timeout: 30_000 });
    await shot(b, DIR, 'B-feed-voice-card');
    await b.goto(`/u/${S.handle}`);
    await expect(b.getByRole('button', { name: /^Publication vocale/ }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('SC-06 · the narrated publication shared as a 24-hour status, without copying it; expiry leaves the publication', async () => {
    await s.goto(narratedPost);
    await s.getByRole('button', { name: 'Plus d’options' }).first().click();
    await s.getByRole('button', { name: 'Partager en statut' }).click();
    await s.getByRole('textbox', { name: 'Légende du statut' }).fill('Regardez la nouvelle collection');
    // The menu action that opened the sheet has the same name; the sheet's button comes last.
    await btn(s, 'Partager en statut').last().click();
    await expect(s.getByText('Statut publié pour 24 heures').last()).toBeVisible();

    await b.goto('/');
    await btn(b, `Voir le statut de ${S.name}`).click();
    await expect(b.getByText('Regardez la nouvelle collection').last()).toBeVisible();
    await expect(b.getByRole('button', { name: 'Voir la publication' })).toBeVisible();
    await shot(b, DIR, 'B-status-pointing-to-post');
    await b.getByRole('button', { name: 'Voir la publication' }).click();
    await expect(b).toHaveURL(new RegExp(`${narratedPost}$`));

    test.skip(!LOCAL, 'Expiry is forced through the local database');
    sql(`update stories set expires_at = now() - interval '1 second' where post_id = '${narratedPost.split('/').pop()}'`);
    await b.goto('/');
    await expect(b.getByRole('tab', { name: 'Abonnements' })).toBeVisible();
    await expect(b.getByRole('button', { name: `Voir le statut de ${S.name}` })).toHaveCount(0);
    await b.goto(narratedPost);
    await expect(b.getByRole('button', { name: /^Écouter l’explication/ }).last()).toBeVisible();
  });

  test('SC-07 · reliability: refused microphone, cancelled take, refresh with a draft (photo + voice) and its « Reprendre » pill', async ({ browser }) => {
    // Refused microphone: a clear message, nothing attached.
    const { ctx, page: d } = await newDevice(browser, DEVICES.android360);
    await signIn(d, S.email, S.password);
    await d.goto('/publish/post?start=voice');
    await d.getByRole('button', { name: 'Commencer l’enregistrement' }).click();
    await expect(d.getByText('Micro non autorisé')).toBeVisible();
    await shot(d, DIR, 'S-mic-refused-360');
    await ctx.close();

    // Cancelled take: nothing attached.
    await s.goto('/publish/post');
    await s.getByRole('button', { name: /^Voix/ }).click();
    await s.getByRole('button', { name: 'Commencer l’enregistrement' }).click();
    await s.waitForTimeout(1200);
    await btn(s, 'Annuler').click();
    await expect(s.getByText('Votre message vocal')).toHaveCount(0);

    // Draft: a photo and a narration survive a refresh (files kept in the browser).
    const chooser = s.waitForEvent('filechooser');
    await s.getByRole('button', { name: 'Photos · vidéo' }).click();
    await (await chooser).setFiles([FIXTURE('shoe.jpg')]);
    await s.getByRole('button', { name: /^Voix/ }).click();
    await record(s, 2);
    await btn(s, 'Ajouter').click();
    await expect(s.getByText('Votre explication')).toBeVisible();
    await s.waitForTimeout(1200);
    await s.goto('/');
    await openCreateMenu(s);
    await expect(s.getByRole('button', { name: /^Reprendre le brouillon : 1 photo · voix 0:0[1-3]/ })).toBeVisible();
    await shot(s, DIR, 'S-create-menu-with-draft');
    await s.getByRole('button', { name: /^Reprendre le brouillon/ }).click();
    await s.reload();
    await expect(s.getByText('Brouillon restauré.')).toBeVisible();
    await expect(s.getByText('Votre explication')).toBeVisible();
    await expect(s.getByText('1/10')).toBeVisible();
    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await expect(s.getByRole('button', { name: /^Écouter l’explication/ }).last()).toBeVisible();
  });

  test('SC-08 · layout at 360, 390 and 412 pt: menu and composer fit, no sideways scroll', async ({ browser }) => {
    for (const size of [DEVICES.android360, { width: 390, height: 844 }, DEVICES.pixel7]) {
      const { ctx, page: d } = await newDevice(browser, size, { mic: true });
      await signIn(d, S.email, S.password);
      await openCreateMenu(d);
      for (const name of ['Statut', 'Publication', 'Article', 'Fermer']) {
        const r = (await d.getByRole('button', { name, exact: true }).boundingBox())!;
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(size.width);
      }
      await shot(d, DIR, `menu-${size.width}`);
      await d.getByRole('button', { name: 'Publication', exact: true }).click();
      await expect(d.getByRole('button', { name: 'Photos · vidéo' })).toBeInViewport();
      await expect(d.getByRole('button', { name: /^Voix/ })).toBeInViewport();
      await expect(d.getByRole('button', { name: /^Article/ }).last()).toBeInViewport();
      expect(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await shot(d, DIR, `composer-${size.width}`);
      await ctx.close();
    }
  });
});


