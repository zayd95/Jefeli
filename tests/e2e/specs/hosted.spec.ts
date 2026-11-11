import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

import { btn, field, FIXTURE, pickFile, publishListing, shot } from './helpers';

/**
 * Hosted acceptance (W1.3, owner's list of 11 Nov): the Vercel preview of the branch against
 * jefeli-staging, with two test accounts (`.test` addresses, names « Test … W1.3 »).
 *
 * Only runs with `playwright.hosted.config.ts` and its environment: APP_URL, WEB_URL, HOSTED_COOKIES
 * (Vercel access cookies for the protected previews), HOSTED_ACCOUNTS (JSON file) and
 * HOSTED_SQL (a script that runs one SQL statement on staging, for the expiry step only).
 * Chromium with a fake microphone; Safari is not available here.
 */
test.use({ channel: 'chromium' });

const ACCOUNTS = process.env.HOSTED_ACCOUNTS ? JSON.parse(fs.readFileSync(process.env.HOSTED_ACCOUNTS, 'utf8')) : null;
const APP = process.env.APP_URL ?? '';
const WEB = process.env.WEB_URL ?? '';
const RUN = Date.now().toString(36).slice(-5);
const DIR = 'hosted';
const ARTICLE = `Boubou bazin test ${RUN}`;
const S = ACCOUNTS?.seller;
const B = ACCOUNTS?.buyer;

test.skip(!ACCOUNTS || !APP || !process.env.HOSTED_COOKIES, 'Hosted acceptance only (playwright.hosted.config.ts)');

function sql(q: string): unknown[] {
  return JSON.parse(execFileSync('python3', ['-I', process.env.HOSTED_SQL as string, q], { encoding: 'utf8' }));
}

/**
 * The Vercel access cookies (`_vercel_jwt`), saved by redeeming each share link once right after
 * creating it (HOSTED_COOKIES, a JSON array): share links stop working for browsers after a few
 * minutes, the cookies they set last much longer.
 */
const access = process.env.HOSTED_COOKIES ? JSON.parse(fs.readFileSync(process.env.HOSTED_COOKIES, 'utf8')) : [];

async function device(browser: Browser, size = { width: 393, height: 852 }, mic = true): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Africa/Dakar' });
  if (mic) await ctx.grantPermissions(['microphone'], { origin: APP });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  // The previews are protected: the share links set the access cookie for each host.
  await ctx.addCookies(access);
  return { ctx, page };
}

async function signIn(page: Page, acc: { email: string; password: string; name: string; handle: string }) {
  await page.goto('/sign-in');
  await field(page, 'E-mail').fill(acc.email);
  await field(page, 'Mot de passe').fill(acc.password);
  await btn(page, 'Se connecter').click();
  const home = page.getByRole('button', { name: 'Notifications' });
  const onboarding = page.getByText('Bienvenue chez vous.');
  await expect(home.or(onboarding)).toBeVisible({ timeout: 60_000 });
  if (await onboarding.isVisible()) {
    await field(page, 'Votre nom').fill(acc.name);
    await field(page, 'Votre pseudo').fill(acc.handle);
    await expect(page.getByText(/^Disponible/)).toBeVisible();
    await page.getByRole('checkbox', { name: 'Je confirme avoir 18 ans ou plus' }).click();
    await btn(page, 'Entrer dans Jëfëli').click();
  }
  await expect(home).toBeVisible({ timeout: 60_000 });
}

const last = <T extends { last(): T }>(l: T) => l.last();
let s: Page;
let b: Page;
let ctxS: BrowserContext;
let ctxB: BrowserContext;
let postPath = '';
let productPath = '';

test.describe.serial('Hosted acceptance: preview + jefeli-staging', () => {
  test.beforeAll(async ({ browser }) => {
    ({ ctx: ctxS, page: s } = await device(browser));
    ({ ctx: ctxB, page: b } = await device(browser, { width: 412, height: 915 }));
  });
  test.afterAll(async () => {
    await ctxS?.close();
    await ctxB?.close();
  });

  test('H-00 · sign-up: an address Supabase refuses gets a precise message, not « Une erreur est survenue »', async ({ browser }) => {
    // A `.test` address never receives mail; Supabase Auth refuses it outright (no e-mail is sent).
    // Whether real addresses receive the confirmation e-mail depends on the project's e-mail
    // settings (see the go/no-go report), not on this code.
    const { ctx, page } = await device(browser);
    await page.goto('/');
    await btn(page, 'Créer un compte').click();
    await field(page, 'Votre nom').fill('Visiteur Test W1.3');
    await field(page, 'E-mail').fill(`w13-visiteur-${RUN}@e2e.jefeli.test`);
    await field(page, 'Mot de passe').fill(`Jf-${RUN}-visiteur-2026`);
    await page.getByRole('checkbox', { name: 'J’ai 18 ans ou plus.' }).click();
    await page.getByRole('checkbox', { name: /J’accepte les conditions/ }).click();
    await btn(page, 'Créer mon compte').click();
    await expect(page.getByText('Adresse e-mail invalide. Vérifiez-la.')).toBeVisible();
    await shot(page, DIR, 'V-signup-invalid-address');
    await ctx.close();
  });

  test('H-01 · seller: a real article, then photos + a narration walking through them + the article, published, in Accueil', async () => {
    await signIn(s, S);
    await publishListing(s, { file: FIXTURE('dress.jpg'), title: ARTICLE, price: '25000', category: 'Chaussures', condition: 'Très bon état' });
    productPath = new URL(s.url()).pathname;

    await s.goto('/publish/post');
    const choice = s.getByTestId('draft-choice');
    await expect(s.getByRole('textbox', { name: 'Texte de la publication' }).or(choice)).toBeVisible();
    if (await choice.isVisible()) {
      await btn(s, 'Nouvelle publication').click();
      await btn(s, 'Supprimer et commencer').click();
    }
    const chooser = s.waitForEvent('filechooser');
    await btn(s, 'Média').click();
    await (await chooser).setFiles([FIXTURE('dress.jpg'), FIXTURE('bag.jpg'), FIXTURE('shoe.jpg')]);
    await expect(last(s.getByTestId('post-media'))).toBeVisible();
    await btn(s, 'Voix').click();
    await expect(s.getByRole('button', { name: 'Mettre en pause' })).toBeVisible({ timeout: 15_000 });
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Montrer la photo 2' }).click();
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Montrer la photo 3' }).click();
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Terminer l’enregistrement' }).click();
    await expect(s.getByText(/^Votre explication · (.+ · )?0:0[5-7] · visite guidée$/)).toBeVisible();
    await btn(s, 'Article').click();
    await s.getByRole('checkbox', { name: ARTICLE }).click();
    await btn(s, 'Terminé').click();
    await s.getByRole('textbox', { name: 'Légende' }).fill(`Nouveau boubou, écoutez ${RUN}`);
    await shot(s, DIR, 'S-editor-before-publish');
    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 120_000 });
    postPath = new URL(s.url()).pathname;
    await expect(last(s.getByRole('button', { name: /^Écouter l’explication/ }))).toBeVisible();
    // The stored voice: what the browser recorded (for the cross-browser note).
    const id = postPath.split('/').pop();
    const voice = sql(`select m.storage_path, o.metadata->>'mimetype' as mime, m.duration_ms, jsonb_array_length(m.cues) as cues from public.post_media m join storage.objects o on o.bucket_id = m.bucket and o.name = m.storage_path where m.post_id = '${id}' and m.kind = 'audio'`);
    test.info().annotations.push({ type: 'recorded voice', description: JSON.stringify(voice) });
    expect(voice).toHaveLength(1);

    await s.goto('/');
    await expect(s.getByText(`Nouveau boubou, écoutez ${RUN}`).first()).toBeVisible({ timeout: 60_000 });
    await shot(s, DIR, 'S-accueil-with-post');
  });

  test('H-02 · buyer: follows, finds it in Accueil, listens (photos follow), opens the article and writes to the seller', async () => {
    await signIn(b, B);
    await b.goto(`/u/${S.handle}`);
    const follow = b.getByRole('button', { name: 'Suivre' });
    const following = b.getByRole('button', { name: 'Abonné(e)' });
    await expect(follow.or(following)).toBeVisible({ timeout: 60_000 });
    if (await follow.isVisible()) await follow.click();
    await expect(following).toBeVisible();
    await b.goto('/');
    await b.getByRole('tab', { name: 'Abonnements' }).click();
    const listen = b.getByRole('button', { name: /^Écouter l’explication/ }).first();
    await expect(listen).toBeVisible({ timeout: 60_000 });
    await b.waitForTimeout(1500);
    await expect(b.getByRole('button', { name: 'Mettre en pause' })).toHaveCount(0); // nothing plays by itself
    await listen.click();
    await expect(b.getByRole('button', { name: 'Mettre en pause' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(b.getByLabel('Photo 2 sur 3').first()).toBeVisible({ timeout: 10_000 });
    await shot(b, DIR, 'B-accueil-narration-photo-2');
    await b.getByRole('button', { name: new RegExp(`^Voir l’article ${ARTICLE}`) }).first().click();
    await expect(b).toHaveURL(new RegExp(`${productPath}$`));
    await btn(b, 'Envoyer un message').click();
    await expect(b).toHaveURL(/\/chat\/[0-9a-f-]{36}\?about=/, { timeout: 60_000 });
    const message = `Bonjour, toujours disponible ? ${RUN}`;
    await b.getByRole('textbox', { name: 'Message', exact: true }).last().fill(message);
    await btn(b, 'Envoyer').last().click();
    await expect(b.getByText(message).last()).toBeVisible({ timeout: 30_000 });
    const chat = new URL(b.url()).pathname;
    await s.goto(chat);
    await expect(s.getByText(message).last()).toBeVisible({ timeout: 60_000 });
    await shot(s, DIR, 'S-message-received');
  });

  test('H-03 · the narrated publication shared as a status plays its voice, photos following', async () => {
    await s.goto(postPath);
    await s.getByRole('button', { name: 'Plus d’options' }).first().click();
    await s.getByRole('button', { name: 'Partager en statut' }).click();
    await s.getByRole('textbox', { name: 'Légende du statut' }).fill(`Écoutez ${RUN}`);
    await btn(s, 'Partager en statut').last().click();
    await expect(s.getByText('Statut publié pour 24 heures').last()).toBeVisible({ timeout: 30_000 });
    await b.goto('/');
    await btn(b, `Voir le statut de ${S.name}`).click();
    await expect(b.getByText(`Écoutez ${RUN}`).last()).toBeVisible();
    await expect(b.getByRole('button', { name: 'Mettre le statut en pause' })).toBeVisible({ timeout: 20_000 });
    await expect(b.getByTestId('status-photo')).toHaveAccessibleName('Photo 2 sur 3', { timeout: 12_000 });
    await shot(b, DIR, 'B-status-narration');
    await b.getByRole('button', { name: 'Fermer', exact: true }).click();
  });

  test('H-04 · after 24 hours the status is gone; the publication and its files stay', async () => {
    const id = postPath.split('/').pop();
    const paths = sql(`select storage_path, bucket from public.post_media where post_id = '${id}'`) as { storage_path: string; bucket: string }[];
    // Simulate the 24 hours on this test status only.
    sql(`update public.stories set expires_at = now() - interval '1 second' where post_id = '${id}'`);
    await b.goto('/');
    await expect(b.getByRole('tab', { name: 'Abonnements' })).toBeVisible();
    await expect(b.getByRole('button', { name: `Voir le statut de ${S.name}` })).toHaveCount(0);
    await b.goto(postPath);
    await expect(last(b.getByRole('button', { name: /^Écouter l’explication/ }))).toBeVisible();
    const objects = sql(`select count(*)::int as n from storage.objects o join public.post_media m on m.bucket = o.bucket_id and m.storage_path = o.name where m.post_id = '${id}'`) as { n: number }[];
    expect(objects[0]!.n).toBe(paths.length);
    for (const p of paths.filter((x) => x.bucket === 'public-media')) {
      const res = await b.request.get(`https://gbsoifwllbacwsknydkq.supabase.co/storage/v1/object/public/public-media/${p.storage_path}`);
      expect(res.status()).toBe(200);
    }
  });

  test('H-05 · private media: a friends-only publication is not visible to a non-friend, and its file is not public', async () => {
    await s.goto('/publish/post');
    await expect(s.getByRole('textbox', { name: 'Texte de la publication' })).toBeVisible();
    await pickFile(s, () => btn(s, 'Média').click(), FIXTURE('bag.jpg'));
    await s.getByRole('button', { name: /^Audience/ }).click();
    await s.getByRole('radio', { name: 'Mes amis' }).click();
    await s.getByRole('textbox', { name: 'Légende' }).fill(`Pour mes amis ${RUN}`);
    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 120_000 });
    const privatePath = new URL(s.url()).pathname;
    const id = privatePath.split('/').pop();
    await expect(s.getByRole('img', { name: 'Photo' }).last()).toBeVisible(); // the author sees it (signed URL)
    const media = sql(`select bucket, storage_path from public.post_media where post_id = '${id}'`) as { bucket: string; storage_path: string }[];
    expect(media[0]!.bucket).toBe('private-media');
    const pub = await b.request.get(`https://gbsoifwllbacwsknydkq.supabase.co/storage/v1/object/public/private-media/${media[0]!.storage_path}`);
    expect(pub.status()).not.toBe(200);
    await b.goto(privatePath);
    await expect(b.getByText(`Pour mes amis ${RUN}`)).toHaveCount(0);
    await shot(b, DIR, 'B-private-post-hidden');
  });

  test('H-06 · uploads: cut twice and retried automatically; a failed publication keeps its draft and « Réessayer » sends it', async () => {
    await s.goto('/publish/post');
    await expect(s.getByRole('textbox', { name: 'Texte de la publication' })).toBeVisible();
    let cut = 0;
    await s.route('**/storage/v1/object/public-media/**', async (route) => {
      if (route.request().method() !== 'GET' && cut < 2) {
        cut += 1;
        return route.abort('internetdisconnected');
      }
      return route.continue();
    });
    await pickFile(s, () => btn(s, 'Média').click(), FIXTURE('shoe.jpg'));
    await s.getByRole('textbox', { name: 'Légende' }).fill(`Coupé deux fois ${RUN}`);
    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 120_000 });
    expect(cut).toBe(2);
    await s.unroute('**/storage/v1/object/public-media/**');

    // Always failing now: the draft stays and says so; then the network comes back.
    await s.goto('/publish/post');
    await expect(s.getByRole('textbox', { name: 'Texte de la publication' })).toBeVisible();
    await s.route('**/storage/v1/object/public-media/**', (route) => (route.request().method() !== 'GET' ? route.abort('internetdisconnected') : route.continue()));
    await pickFile(s, () => btn(s, 'Média').click(), FIXTURE('dress.jpg'));
    await s.getByRole('textbox', { name: 'Légende' }).fill(`Envoi repris ${RUN}`);
    await btn(s, 'Publier').click();
    await expect(s.getByText(/^Publication non envoyée/)).toBeVisible({ timeout: 120_000 });
    await expect(s.getByText(/brouillon/i)).toHaveCount(1); // said once, not twice
    await expect(s.getByRole('textbox', { name: 'Légende' })).toHaveValue(`Envoi repris ${RUN}`);
    await shot(s, DIR, 'S-publish-failed-draft-kept');
    await s.unroute('**/storage/v1/object/public-media/**');
    await s.getByTestId('inline-retry').getByRole('button', { name: 'Réessayer' }).click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 120_000 });
  });

  test('H-07 · a refused microphone is explained, nothing is attached', async ({ browser }) => {
    const { ctx, page } = await device(browser, { width: 360, height: 780 }, false);
    await signIn(page, B);
    await page.goto('/publish/post?start=voice');
    const choice = page.getByTestId('draft-choice');
    if (await choice.isVisible().catch(() => false)) await btn(page, 'Continuer le brouillon').click();
    await expect(page.getByText('Micro non autorisé')).toBeVisible({ timeout: 20_000 });
    await shot(page, DIR, 'B-mic-refused-360');
    await ctx.close();
  });

  test('H-08 · the public web page of the publication plays the voice (no app needed)', async () => {
    test.skip(!WEB, 'no web preview');
    await b.goto(`${WEB}${postPath}`);
    await expect(b.getByLabel('Écouter le message vocal')).toBeVisible({ timeout: 60_000 });
    await shot(b, DIR, 'B-web-share-page');
  });
});
