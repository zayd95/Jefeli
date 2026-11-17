import { expect, test } from '@playwright/test';

import { btn, DEVICES, field, FIXTURE, newDevice, publishListing, runId, shot } from './helpers';

/**
 * Family preview (17 Nov): the whole journey of a brand-new person on the hosted preview
 * (https://jefeli.vercel.app, branch feature/p2-studio, jefeli-staging), on a 390 px phone viewport:
 *   FJ-1 sign-up (e-mail + the confirmation step)         FJ-4 publish an article through the Studio
 *   FJ-2 browse the aisles (Téléphones, Mode, Maison, Beauté) FJ-5 propose a swap on a DÉMO article
 *   FJ-3 open a Reel, then make an offer on a DÉMO article   FJ-6 clean up (the journey member and everything they created)
 * The order differs from the brief on purpose: a swap needs an article of one's own, so the Studio comes first.
 *
 * Only runs with `playwright.family.config.ts`. Env: APP_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (to
 * confirm the address of the journey member, because the mailbox of a test address cannot be read, and to
 * delete them afterwards). Everything created is removed at the end (offers, conversation, article, member).
 */
const APP = process.env.APP_URL ?? '';
const SB = process.env.SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
test.skip(!APP || !SB || !KEY, 'Family journey only (playwright.family.config.ts)');

const RUN = runId();
const DIR = 'family';
const EMAIL = `jefeli-journey-${RUN}@mailinator.com`;
const PASSWORD = `Parcours-${RUN}-2026!`;
const NAME = `Parcours ${RUN}`;
const HANDLE = `parcours_${RUN}`;
const MY_ITEM = `Sandales test ${RUN}`;

const admin = (p: string, init: RequestInit = {}) =>
  fetch(`${SB}${p}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });

async function userId(): Promise<string | null> {
  const r = await admin('/auth/v1/admin/users?per_page=200');
  const j = (await r.json()) as { users: { id: string; email: string }[] };
  return j.users.find((u) => u.email === EMAIL)?.id ?? null;
}

test.describe.serial('Family preview journey, 390 px', () => {
  test.setTimeout(10 * 60 * 1000);

  test('FJ-1…FJ-5 a new person signs up, browses, opens a Reel, offers, publishes and proposes a swap', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15.width === 393 ? { width: 390, height: 844 } : DEVICES.iphone15);
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 160)));
    const errors: string[] = [];
    page.on('response', (r) => { if (r.status() >= 500 && !/vercel|favicon/.test(r.url())) errors.push(`${r.status()} ${r.url().slice(0, 100)}`); });

    await test.step('FJ-1 sign-up with e-mail, then the confirmation step', async () => {
      await page.goto('/');
      await shot(page, DIR, 'fj1-welcome');
      await btn(page, 'Créer un compte').click();
      await field(page, 'Votre nom').fill(NAME);
      await field(page, 'E-mail').fill(EMAIL);
      await field(page, 'Mot de passe').fill(PASSWORD);
      await page.getByRole('checkbox', { name: 'J’ai 18 ans ou plus.' }).click();
      await page.getByRole('checkbox', { name: /J’accepte les conditions/ }).click();
      await shot(page, DIR, 'fj1-signup-form');
      await btn(page, 'Créer mon compte').click();
      const checkEmail = page.getByText('Vérifiez votre e-mail', { exact: true });
      const limited = page.getByText(/Trop de tentatives/);
      await expect(checkEmail.or(limited)).toBeVisible({ timeout: 30_000 });
      if (await limited.isVisible()) {
        // The built-in Supabase mailer allows 2 e-mails per hour for the WHOLE project: a finding, not a bug of the
        // app. The journey goes on with a member created by the admin API (address confirmed), from the sign-in.
        test.info().annotations.push({ type: 'finding', description: 'Sign-up refused with « Trop de tentatives » (hourly e-mail quota of the built-in mailer).' });
        await shot(page, DIR, 'fj1-email-quota');
        const created = await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { display_name: NAME, handle: HANDLE } }) });
        expect(created.ok).toBe(true);
        await page.goto('/sign-in');
        await field(page, 'E-mail').fill(EMAIL);
        await field(page, 'Mot de passe').fill(PASSWORD);
        await btn(page, 'Se connecter').click();
      } else {
        await shot(page, DIR, 'fj1-check-your-email');
        // The mailbox of a test address cannot be read from here: the address is confirmed through the
        // admin API, which is what the confirmation link does. Before that, signing in explains the wait.
        await btn(page, 'J’ai confirmé, me connecter').click();
        await field(page, 'E-mail').fill(EMAIL);
        await field(page, 'Mot de passe').fill(PASSWORD);
        await btn(page, 'Se connecter').click();
        await expect(page.getByText('Confirmez votre e-mail avant de vous connecter.')).toBeVisible();
        const id = await userId();
        expect(id).not.toBeNull();
        const res = await admin(`/auth/v1/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ email_confirm: true }) });
        expect(res.ok).toBe(true);
        await btn(page, 'Se connecter').click();
      }
      await expect(page.getByText('Bienvenue chez vous.')).toBeVisible({ timeout: 30_000 });
      await field(page, 'Votre nom').fill(NAME);
      await field(page, 'Votre pseudo').fill(HANDLE);
      await expect(page.getByText(/^Disponible/)).toBeVisible();
      await page.getByRole('checkbox', { name: 'Je confirme avoir 18 ans ou plus' }).click();
      await shot(page, DIR, 'fj1-onboarding');
      await btn(page, 'Entrer dans Jëfëli').click();
      await expect(page.getByRole('button', { name: 'Notifications', exact: true }).or(page.getByRole('link', { name: /^Notifications/ })).first()).toBeVisible({ timeout: 60_000 });
      await shot(page, DIR, 'fj1-home');
    });

    await test.step('FJ-2 browse the aisles', async () => {
      await page.goto('/explore');
      await expect(page.getByLabel('Les allées du marché')).toBeVisible({ timeout: 60_000 });
      await shot(page, DIR, 'fj2-explorer');
      // The two launch aisles are cards, the others are chips (« Maison & déco », « Beauté & soins »).
      const aisles: [string, string, string][] = [
        ['aisle-telephones', 'Smartphone Android 128 Go — reconditionné', 'telephones'],
        ['aisle-mode', 'Robe wax évasée — taille M', 'mode'],
        ['Maison', 'Fauteuil en rotin', 'maison'],
        ['Beauté', 'Beurre de karité pur — 250 g', 'beaute'],
      ];
      for (const [which, title, slug] of aisles) {
        await page.goto('/explore');
        await expect(page.getByLabel('Les allées du marché')).toBeVisible();
        await (which.startsWith('aisle-') ? page.getByTestId(which) : page.getByRole('button', { name: new RegExp(which) }).first()).click();
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText('DÉMO').first()).toBeVisible();
        await shot(page, DIR, `fj2-aisle-${slug}`);
      }
    });

    await test.step('FJ-3a open a Reel', async () => {
      await page.goto('/');
      await expect(page.getByTestId('home-reels')).toBeVisible({ timeout: 60_000 });
      await page.getByTestId('home-reels').click();
      await expect(page).toHaveURL(/\/reels/);
      await expect(page.getByTestId('reel').first()).toBeVisible({ timeout: 60_000 });
      const video = page.locator('video').first();
      await expect(video).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.readyState >= 2), { timeout: 30_000 }).toBe(true);
      await expect(page.getByTestId('reel-offer').first()).toBeVisible();
      await shot(page, DIR, 'fj3-reel');
    });

    await test.step('FJ-3b make an offer on a DÉMO article', async () => {
      await page.goto('/explore');
      await page.getByTestId('aisle-telephones').click();
      await page.getByText('Smartphone Android 128 Go — reconditionné').first().click();
      await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/);
      await shot(page, DIR, 'fj3-article');
      await btn(page, 'Faire une offre').click();
      await field(page, 'Votre offre').fill('70000');
      await shot(page, DIR, 'fj3-offer-composer');
      await btn(page, /^Envoyer/).first().click();
      await expect(page.getByText(/^· (Offre|Contre-offre)$/).last()).toBeVisible({ timeout: 30_000 });
      await shot(page, DIR, 'fj3-offer-sent');
    });

    await test.step('FJ-4 publish an article through the Studio', async () => {
      await publishListing(page, { file: FIXTURE('shoe.jpg'), title: MY_ITEM, mode: 'Vente ou troc', price: '8000', category: 'Chaussures', condition: 'Comme neuf' });
      await expect(page.getByText(MY_ITEM).first()).toBeVisible({ timeout: 60_000 });
      await shot(page, DIR, 'fj4-published');
    });

    await test.step('FJ-5 propose a swap on a DÉMO article', async () => {
      await page.goto('/explore');
      await page.getByTestId('aisle-mode').click();
      await page.getByText('Baskets blanches — pointure 42').first().click();
      await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/);
      await btn(page, 'Proposer un échange (troc)').click();
      await page.getByRole('radio', { name: MY_ITEM }).click();
      await shot(page, DIR, 'fj5-swap-composer');
      await btn(page, 'Envoyer la proposition').click();
      await expect(page.getByText(/^· (Troc|Contre-offre)$/).last()).toBeVisible({ timeout: 30_000 });
      await shot(page, DIR, 'fj5-swap-sent');
    });

    expect(errors, 'no server error during the journey').toEqual([]);
    await ctx.close();
  });

  // FJ-6 cleanup: the journey member and everything they created are deleted, even when a step failed.
  test.afterAll(async () => {
    const id = await userId();
    if (!id) return;
    // Files first (the storage rows are not removed with the member).
    for (const bucket of ['avatars', 'public-media', 'private-media']) {
      const files: string[] = [];
      const walk = async (prefix: string) => {
        const r = await admin(`/storage/v1/object/list/${bucket}`, { method: 'POST', body: JSON.stringify({ prefix, limit: 1000 }) });
        for (const it of ((await r.json()) as { name: string; id: string | null }[]) ?? []) {
          if (it.id) files.push(`${prefix}/${it.name}`);
          else await walk(`${prefix}/${it.name}`);
        }
      };
      await walk(id);
      if (files.length) await admin(`/storage/v1/object/${bucket}`, { method: 'DELETE', body: JSON.stringify({ prefixes: files }) });
    }
    const del = await admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
    expect(del.ok).toBe(true);
    expect(await userId()).toBeNull();
  });
});
