import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { btn, DEVICES, field, FIXTURE, newDevice, publishListing, runId, shot, signIn, signUp } from './helpers';

/**
 * Voice across Jëfëli (W1.2, on the W1.3 editors): voice messages about an article, a voice-only
 * publication, and the reliability cases (refused microphone, cancelled take, refresh with a
 * draft), then the layout at 360, 390 and 412 pt. The photo + narration journey, the article's
 * voice and statuses are in create.spec.ts.
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

async function openCreateMenu(p: Page) {
  await p.getByRole('tab', { name: 'Publier' }).click();
  await expect(p.getByTestId('create-post')).toBeVisible();
}

/** The studio records as soon as it opens: wait `seconds`, then finish. */
async function record(p: Page, seconds: number) {
  await expect(p.getByRole('button', { name: 'Mettre en pause' })).toBeVisible({ timeout: 10_000 });
  await p.waitForTimeout(seconds * 1000);
  await p.getByRole('button', { name: 'Terminer l’enregistrement' }).click();
}

test.describe.serial('Voice: messages, voice publications, reliability, layout', () => {
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

  test('SC-01 · chat: the buyer asks by voice about the article, listens before sending; the seller answers by voice', async () => {
    await publishListing(s, { file: FIXTURE('dress.jpg'), title: ARTICLE, price: '25000', category: 'Chaussures', condition: 'Très bon état' });
    const productPath = new URL(s.url()).pathname;
    await b.goto(productPath);
    await btn(b, 'Envoyer un message').click();
    await expect(b).toHaveURL(/\/chat\/[0-9a-f-]{36}\?about=/, { timeout: 30_000 });
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

  test('SC-02 · voice only: Voix on the empty canvas records at once; the editor shows the feed’s voice card; published', async () => {
    await s.goto('/');
    await openCreateMenu(s);
    await s.getByTestId('create-post').click();
    await btn(s, 'Voix').click();
    await expect(s.getByText('Votre message vocal').last()).toBeVisible();
    await record(s, 3);
    // The voice became the publication: the same card buyers will see.
    await expect(s.getByRole('button', { name: 'Écouter la publication vocale' })).toBeVisible();
    await s.getByRole('button', { name: /^Langue parlée/ }).click();
    await s.getByRole('radio', { name: 'Français' }).click();
    await expect(s.getByText('EN FRANÇAIS').last()).toBeVisible();
    await field(s, 'Texte de la publication').fill(`Arrivage de wax ce matin ${RUN}`);
    await shot(s, DIR, 'S-editor-voice-only');
    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 60_000 });
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
  });

  test('SC-03 · reliability: refused microphone, cancelled take, refresh with a draft (photo + voice)', async ({ browser }) => {
    // Refused microphone: a clear message in the studio, nothing attached.
    const { ctx, page: d } = await newDevice(browser, DEVICES.android360);
    await signIn(d, S.email, S.password);
    await d.goto('/publish/post?start=voice');
    await expect(d.getByText('Micro non autorisé')).toBeVisible({ timeout: 15_000 });
    await shot(d, DIR, 'S-mic-refused-360');
    await ctx.close();

    // Cancelled take: nothing attached.
    await s.goto('/publish/post');
    await btn(s, 'Voix').click();
    await expect(s.getByRole('button', { name: 'Mettre en pause' })).toBeVisible({ timeout: 10_000 });
    await s.waitForTimeout(1200);
    await s.getByRole('button', { name: 'Supprimer l’enregistrement' }).click();
    await expect(s.getByRole('button', { name: 'Voix', exact: true })).toBeVisible();
    await expect(s.getByRole('button', { name: 'Écouter la publication vocale' })).toHaveCount(0);

    // Draft: a photo and a narration survive a refresh (files kept in the browser).
    const chooser = s.waitForEvent('filechooser');
    await btn(s, 'Média').click();
    await (await chooser).setFiles([FIXTURE('shoe.jpg')]);
    await btn(s, 'Voix').click();
    await record(s, 2);
    await expect(s.getByText(/^Votre explication · /)).toBeVisible();
    await s.waitForTimeout(1200);
    await s.goto('/');
    await openCreateMenu(s);
    await expect(s.getByTestId('create-post')).toHaveAccessibleName(/Brouillon en cours : 1 photo · voix 0:0[1-3]/);
    await s.getByTestId('create-post').click();
    await btn(s, 'Continuer le brouillon').click();
    await s.reload();
    await expect(s.getByText(/^Votre explication · /)).toBeVisible({ timeout: 20_000 });
    await expect(s.getByRole('button', { name: 'Couverture' })).toBeVisible();
    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await expect(s.getByRole('button', { name: /^Écouter l’explication/ }).last()).toBeVisible();
  });

  test('SC-04 · layout at 360, 390 and 412 pt: menu and the three editors fit, no sideways scroll', async ({ browser }) => {
    for (const size of [DEVICES.android360, { width: 390, height: 844 }, DEVICES.pixel7]) {
      const { ctx, page: d } = await newDevice(browser, size, { mic: true });
      await signIn(d, S.email, S.password);
      await openCreateMenu(d);
      for (const id of ['create-status', 'create-post', 'create-listing']) {
        const r = (await d.getByTestId(id).boundingBox())!;
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(size.width);
      }
      await shot(d, DIR, `menu-${size.width}`);
      await d.getByTestId('create-post').click();
      for (const name of ['Média', 'Voix', 'Article', 'Publier']) await expect(d.getByRole('button', { name, exact: true })).toBeInViewport();
      expect(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await shot(d, DIR, `editor-${size.width}`);
      await d.goto('/publish/listing');
      await expect(d.getByRole('button', { name: 'Mettre en vente' })).toBeInViewport();
      expect(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await shot(d, DIR, `article-${size.width}`);
      await d.goto('/publish/status');
      await expect(d.getByRole('button', { name: 'Ma voix' })).toBeInViewport();
      await ctx.close();
    }
  });
});
