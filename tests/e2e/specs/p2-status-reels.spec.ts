/**
 * P2.3 / P2.4 — better statuses and Reels, through the real UI (camera fake device, DÉMO seed).
 *   SR-1 a status with an article shows its sticker (photo, price, Wecci) that opens the article
 *   SR-2 quick reaction and « Faire une offre » open the chat with the item card attached
 *   SR-3 the end of the statuses offers « Voir les Reels »
 *   SR-4 an item video published as a Reel shows in Reels with its sticker and « Faire une offre »
 *   SR-5 a video status turns into a Reel (« Garder en Reel »)
 */
import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';

import { btn, DEVICES, FIXTURE, newDevice, runId, shot, signIn, studioWithFile } from './helpers';

const RUN = runId();
const DIR = 'p2-status-reels';
const SELLER = ['awa@demo.jefeli.test', 'Demo-jefeli-2026!'] as const;
const BUYER = ['fatou@demo.jefeli.test', 'Demo-jefeli-2026!'] as const;
const PHOTO = FIXTURE('shoe.jpg');

/** Earlier runs' test statuses are hidden first, so the viewer walk stays short (local stack only). */
function hideOldTestStatuses() {
  try {
    execSync(`docker exec supabase_db_jefeli psql -U postgres -c "update stories set deleted_at = now() where deleted_at is null and (caption like 'Sandales statut%' or caption like 'Statut vidéo %' or caption like 'Arrivage en vidéo%' or caption like 'Statut studio%')"`, { stdio: 'ignore' });
  } catch {
    /* the walk is only slower */
  }
}

/** Publishes an item as a status (photo → Statut + Boutique, no Fil). `trade` also opens it to swaps. */
async function publishStatusItem(page: Page, title: string, opts: { trade?: boolean } = {}) {
  await studioWithFile(page, PHOTO);
  await page.getByTestId('studio-caption').fill(`${title}\nÉtat impeccable.`);
  if (opts.trade) await page.getByRole('radio', { name: 'Vendre ou troquer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Prix', exact: true }).fill('18000');
  await page.getByRole('button', { name: /^Catégorie : / }).click();
  await btn(page, 'Chaussures').click();
  await page.getByTestId('studio-dest-feed').click(); // untick Fil
  await page.getByTestId('studio-dest-status').click(); // tick Statut
  await page.getByTestId('studio-publish').click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/, { timeout: 60_000 });
  if (page.url().endsWith('?first=1')) await page.getByTestId('share-boutique-moment').getByRole('button', { name: 'Plus tard', exact: true }).click();
}

/** Opens the seller's statuses as the buyer and walks to the one carrying `title`. */
async function openStatusWithItem(page: Page, title: string) {
  await page.goto('/u/awa_couture');
  await page.getByRole('button', { name: 'Voir ses statuts' }).click();
  const sticker = page.getByTestId('product-sticker').filter({ hasText: title });
  const anySticker = page.getByTestId('product-sticker');
  for (let i = 0; i < 20 && !(await sticker.isVisible().catch(() => false)); i++) {
    // Let the status settle (its article loads after the photo) before deciding to move on.
    await anySticker.first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await sticker.isVisible().catch(() => false)) break;
    await page.getByRole('button', { name: 'Statut suivant' }).click({ position: { x: 150, y: 300 } }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await expect(sticker).toBeVisible();
  return sticker;
}

test.describe('P2.3 statuses', () => {
  test('SR-1/2/3 sticker, reaction, offer and end card', async ({ browser }) => {
    const title = `Sandales statut ${RUN}`;
    hideOldTestStatuses();
    const seller = await newDevice(browser, DEVICES.iphone15);
    await signIn(seller.page, ...SELLER);
    await publishStatusItem(seller.page, title, { trade: true });
    await seller.ctx.close();

    const { ctx, page } = await newDevice(browser, DEVICES.iphone15);
    await signIn(page, ...BUYER);
    const sticker = await openStatusWithItem(page, title);
    await expect(sticker.getByText(/18\s?000/)).toBeVisible();
    await expect(sticker.getByText('WECCI')).toBeVisible(); // « Vendre + Troquer » is a Wecci article
    await expect(page.getByTestId('status-offer')).toBeVisible();

    // The sticker opens the article (at once: a photo status moves on after 5.5 s).
    await sticker.click();
    await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/);
    await expect(page.getByText(title).filter({ visible: true }).first()).toBeVisible();

    // A quick reaction opens the chat with the item card attached.
    await openStatusWithItem(page, title);
    await shot(page, DIR, 'status-product-sticker-reactions-offer');
    await page.getByTestId('status-react-🔥').click();
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}/);
    await expect(page.getByText(title).filter({ visible: true }).first()).toBeVisible();
    await shot(page, DIR, 'chat-with-item-card-after-reaction');

    // « Faire une offre » opens the chat with the card, then the offer form.
    await openStatusWithItem(page, title);
    await page.getByTestId('status-offer').click();
    await expect(page.getByText('Faire une offre', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/offer\//);
    await shot(page, DIR, 'offer-form-from-status');

    // The end of the statuses: « Voir les Reels ».
    await page.goto('/u/awa_couture');
    await page.getByRole('button', { name: 'Voir ses statuts' }).click();
    for (let i = 0; i < 14 && !(await page.getByTestId('status-end-card').isVisible().catch(() => false)); i++) {
      await page.getByRole('button', { name: 'Statut suivant' }).click({ position: { x: 150, y: 300 } }).catch(() => {});
      await page.waitForTimeout(350);
    }
    await expect(page.getByTestId('status-end-card')).toBeVisible();
    await shot(page, DIR, 'status-end-card-voir-les-reels');
    await page.getByTestId('status-see-reels').click();
    await expect(page).toHaveURL(/\/reels/);
    await ctx.close();
  });
});

test.describe('P2.4 Reels', () => {
  test.setTimeout(240_000);
  test('SR-4 an item video is a Reel: sticker, gold pill, offer', async ({ browser }) => {
    const title = `Reel vente ${RUN}`;
    const seller = await newDevice(browser, DEVICES.iphone15, { camera: true, mic: true });
    await signIn(seller.page, ...SELLER);
    await seller.page.getByRole('tab', { name: 'Publier' }).click();
    await seller.page.getByTestId('studio-tool-camera').click();
    await seller.page.getByRole('tab', { name: 'Vidéo', exact: true }).click();
    await seller.page.getByTestId('studio-shutter').click();
    await seller.page.waitForTimeout(2500);
    await seller.page.getByTestId('studio-shutter').click();
    await seller.page.getByTestId('studio-next').click();
    await seller.page.getByTestId('studio-caption').fill(`${title}\nTrès beau modèle.`);
    await seller.page.getByRole('textbox', { name: 'Prix', exact: true }).fill('9500');
    await seller.page.getByRole('button', { name: /^Catégorie : / }).click();
    await btn(seller.page, 'Chaussures').click();
    await expect(seller.page.getByTestId('studio-dest-reel')).toHaveAttribute('aria-checked', 'true');
    await seller.page.getByTestId('studio-publish').click();
    await expect(seller.page).toHaveURL(/\/p\/[0-9a-f-]{36}/, { timeout: 90_000 });
    await seller.ctx.close();

    const { ctx, page } = await newDevice(browser, DEVICES.iphone15);
    await signIn(page, ...BUYER);
    await page.getByTestId('home-reels').click();
    await expect(page.getByTestId('reels')).toBeVisible();
    const reel = page.getByTestId('reel').filter({ hasText: title }).first();
    await expect(reel).toBeVisible({ timeout: 30_000 });
    await expect(reel.getByTestId('product-sticker')).toContainText(/9\s?500/);
    await expect(reel.getByRole('button', { name: 'Faire une offre' })).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Navigation principale' })).toHaveCount(0); // no tab bar in Reels
    await shot(page, DIR, 'reels-feed-sticker-offer');
    await reel.getByTestId('reel-offer').click();
    await expect(page).toHaveURL(/\/offer\//);
    await expect(page.getByRole('textbox').first()).toBeVisible();
    await shot(page, DIR, 'offer-form-from-reel');
    await ctx.close();
  });

  test('SR-5 a video status turns into a Reel', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15, { camera: true, mic: true });
    await signIn(page, ...SELLER);
    await page.getByRole('tab', { name: 'Publier' }).click();
    await page.getByTestId('studio-tool-camera').click();
    await page.getByRole('tab', { name: 'Vidéo', exact: true }).click();
    await page.getByTestId('studio-shutter').click();
    await page.waitForTimeout(9000); // long enough to walk to it before it ends
    await page.getByTestId('studio-shutter').click();
    await page.getByTestId('studio-next').click();
    await page.getByRole('switch', { name: 'Vendre ou troquer cet article' }).click(); // off: a plain video
    await page.getByTestId('studio-caption').fill(`Statut vidéo ${RUN}`);
    await page.getByTestId('studio-dest-feed').click(); // untick Fil
    await page.getByTestId('studio-dest-reel').click(); // untick Reel
    await page.getByTestId('studio-dest-status').click(); // Statut only
    await page.getByTestId('studio-publish').click();
    await expect(page.getByText('Statut publié pour 24 h')).toBeVisible({ timeout: 90_000 });
    await page.goto('/u/awa_couture');
    await page.getByRole('button', { name: 'Voir mon statut' }).click();
    // The newest status is last: walk to it.
    const keep = page.getByTestId('status-keep-reel');
    for (let i = 0; i < 20 && !(await keep.isVisible().catch(() => false)); i++) {
      await keep.waitFor({ state: 'visible', timeout: 1200 }).catch(() => {});
      if (await keep.isVisible().catch(() => false)) break;
      await page.getByRole('button', { name: 'Statut suivant' }).click({ position: { x: 150, y: 300 } }).catch(() => {});
      await page.waitForTimeout(300);
    }
    // The fake-camera video lasts 2.5 s and the viewer moves on when it ends: tap at once.
    await keep.click({ timeout: 2000 });
    await expect(page.getByText('Gardé en Reel')).toBeVisible({ timeout: 30_000 });
    await shot(page, DIR, 'own-video-status-kept-as-reel');
    await ctx.close();
  });

  test('RM-1 Accueil shows a Reels carousel of real Reels, and a tap opens the Reels feed at that video', async ({ browser }) => {
    test.setTimeout(120_000);
    const count = Number(execSync(`docker exec supabase_db_jefeli psql -U postgres -tAc "select count(*) from posts where in_reels and visibility='public' and deleted_at is null and moderation_status='active'"`, { encoding: 'utf8' }).trim());
    test.skip(count < 3, 'fewer than 3 Reels on this database: the module stays hidden (that is the rule)');
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15);
    await signIn(page, ...BUYER);
    const module = page.getByTestId('reels-module');
    for (let i = 0; i < 14 && !(await module.first().isVisible().catch(() => false)); i++) {
      await page.mouse.move(200, 400);
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(500);
    }
    await expect(module.first()).toBeVisible();
    expect(await page.getByTestId('reel-tile').count()).toBeGreaterThanOrEqual(3);
    await shot(page, DIR, 'accueil-reels-carousel');
    await page.getByTestId('reel-tile').first().click();
    await expect(page).toHaveURL(/\/reels\?start=[0-9a-f-]{36}/);
    await expect(page.getByTestId('reel').first()).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });
});
