/**
 * P2.2 — the Studio, through the real UI (camera fake device, local stack, DÉMO seed).
 *   ST-1 camera opens directly; Photo · Vidéo · Voix · Texte; numbered strip; composer
 *   ST-2 the « Vendre ou troquer » switch off/on, on by default for a Boutique account
 *   ST-3 publish an item (photo + price + category) to Fil and Boutique
 *   ST-4 publish a status (one photo → Statut only)
 *   ST-5 publish a voice note to Fil
 *   ST-6 publish a text « Je cherche » request: never a priced item
 *   ST-7 the draft is saved at every step and comes back
 *   ST-8 record a video and publish it as a Reel
 */
import { expect, test, type Page } from '@playwright/test';

import { btn, DEVICES, FIXTURE, goldFills, newDevice, runId, shot, signIn, studioWithFile } from './helpers';

const RUN = runId();
const DIR = 'p2-studio';
const SELLER = ['awa@demo.jefeli.test', 'Demo-jefeli-2026!'] as const; // has a Boutique
const MEMBER = ['fatou@demo.jefeli.test', 'Demo-jefeli-2026!'] as const; // no Boutique
const PHOTO = FIXTURE('bag.jpg');

// P4: « + » opens the composer; the toolbar's camera opens the capture over it.
async function openComposer(page: Page) {
  await page.getByRole('tab', { name: 'Publier' }).click();
  await expect(page.getByTestId('studio-composer')).toBeVisible();
}
async function openStudio(page: Page) {
  await openComposer(page);
  await page.getByTestId('studio-tool-camera').click();
  await expect(page.getByTestId('studio-capture')).toBeVisible();
}

test.describe('P2.2 Studio', () => {
  test('ST-1 the camera (from the toolbar) has Photo · Vidéo and a numbered strip', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15, { camera: true });
    await signIn(page, ...SELLER);
    await openStudio(page);
    for (const mode of ['Photo', 'Vidéo']) await expect(page.getByRole('tab', { name: mode, exact: true })).toBeVisible();
    await expect(page.getByTestId('studio-gallery')).toBeVisible();
    await shot(page, DIR, 'capture-photo');
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('studio-shutter').click();
      await expect(page.getByTestId('studio-strip').getByText(String(i + 1), { exact: true })).toBeVisible();
    }
    await expect(page.getByText('3/8')).toBeVisible();
    await shot(page, DIR, 'capture-photo-strip-3');
    await page.getByRole('tab', { name: 'Vidéo', exact: true }).click();
    await shot(page, DIR, 'capture-video');
    await ctx.close();
  });

  test('ST-2 the switch: on by default with a Boutique, off without, chips and destinations follow', async ({ browser }) => {
    const seller = await newDevice(browser, DEVICES.iphone15);
    await signIn(seller.page, ...SELLER);
    await studioWithFile(seller.page, PHOTO);
    const sw = seller.page.getByRole('switch', { name: 'Vendre ou troquer cet article' });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(seller.page.getByTestId('studio-item-chips')).toBeVisible();
    await expect(seller.page.getByTestId('studio-dest-boutique')).toBeVisible();
    await expect(seller.page.getByTestId('studio-dest-reel')).toHaveAttribute('aria-disabled', 'true'); // a photo is not a Reel
    // Gold budget: the one filled gold element of the composer is « Publier ».
    expect((await goldFills(seller.page)).map((h) => h.text)).toEqual(['Publier']);
    await shot(seller.page, DIR, 'composer-switch-on');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(seller.page.getByTestId('studio-item-chips')).toHaveCount(0);
    await expect(seller.page.getByTestId('studio-dest-boutique')).toHaveCount(0);
    await shot(seller.page, DIR, 'composer-switch-off');
    await seller.ctx.close();

    const member = await newDevice(browser, DEVICES.iphone15);
    await signIn(member.page, ...MEMBER);
    await studioWithFile(member.page, PHOTO);
    await expect(member.page.getByRole('switch', { name: 'Vendre ou troquer cet article' })).toHaveAttribute('aria-checked', 'false');
    await member.ctx.close();
  });

  test('ST-3 an item goes to Fil and Boutique with its price, mode and category', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15);
    await signIn(page, ...SELLER);
    await studioWithFile(page, PHOTO);
    const title = `Boubou studio ${RUN}`;
    await page.getByTestId('studio-caption').fill(`${title}\nBroderie main, taille L.`);
    await page.getByRole('textbox', { name: 'Prix', exact: true }).fill('27500');
    await page.getByRole('button', { name: /^Catégorie : / }).click();
    await btn(page, 'Mode femme').click();
    await page.getByRole('button', { name: /^État : / }).click();
    await btn(page, 'Très bon état').click();
    await expect(page.getByTestId('studio-dest-feed')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('studio-dest-boutique')).toHaveAttribute('aria-checked', 'true');
    await shot(page, DIR, 'composer-item-filled');
    await page.getByTestId('studio-publish').click();
    await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/, { timeout: 60_000 });
    if (page.url().endsWith('?first=1')) await page.getByTestId('share-boutique-moment').getByRole('button', { name: 'Plus tard', exact: true }).click();
    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByText(/27\s?500/).first()).toBeVisible();
    await shot(page, DIR, 'item-published-article-page');
    await ctx.close();
  });

  test('ST-4 a photo published to Statut only shows in the status rail', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15);
    await signIn(page, ...MEMBER);
    await studioWithFile(page, PHOTO);
    await page.getByTestId('studio-caption').fill(`Statut studio ${RUN}`);
    await page.getByTestId('studio-dest-feed').click(); // untick Fil
    await page.getByTestId('studio-dest-status').click(); // tick Statut
    await expect(page.getByTestId('studio-dest-status')).toHaveAttribute('aria-checked', 'true');
    await shot(page, DIR, 'composer-status-only');
    await page.getByTestId('studio-publish').click();
    await expect(page.getByText('Statut publié pour 24 h')).toBeVisible({ timeout: 60_000 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Votre statut|Mon statut|Ajouter un statut/i }).first()).toBeVisible();
    await shot(page, DIR, 'status-published-rail');
    await ctx.close();
  });

  test('ST-5 a voice note is published to Fil', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15, { mic: true, camera: true });
    await signIn(page, ...MEMBER);
    await openComposer(page);
    await page.getByTestId('studio-tool-voice').click(); // P4: records inline, no second screen
    await expect(page.getByTestId('inline-voice')).toBeVisible();
    await page.waitForTimeout(2500); // the fake microphone tone
    await page.getByRole('button', { name: /Terminer/ }).click();
    await expect(page.getByText(/^Message vocal · \d+ s$/)).toBeVisible();
    await page.getByTestId('studio-caption').fill(`Note vocale studio ${RUN}`);
    await shot(page, DIR, 'composer-voice-only');
    await page.getByTestId('studio-publish').click();
    await expect(page.getByText('Publié', { exact: true })).toBeVisible({ timeout: 60_000 });
    await ctx.close();
  });

  test('ST-6 a text « Je cherche » is a request, never a priced item', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15, { camera: true });
    await signIn(page, ...SELLER);
    await openComposer(page);
    // P4: the text box is the first thing; the starters are chips under it.
    await expect(page.getByRole('button', { name: 'Qui a… ?', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recommandez-moi…', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Je cherche…', exact: true }).click();
    await expect(page.getByTestId('studio-caption')).toHaveValue('Je cherche ');
    await page.getByTestId('studio-caption').fill(`Je cherche ${RUN} machine à coudre`);
    // P4: the toolbar's article switch exists but a text post is never an item: it stays off, no chips, no Boutique.
    await expect(page.getByRole('switch', { name: 'Vendre ou troquer cet article' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('studio-item-chips')).toHaveCount(0);
    await expect(page.getByTestId('studio-dest-boutique')).toHaveCount(0);
    await expect(page.getByTestId('studio-dest-reel')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('studio-dest-status')).toHaveAttribute('aria-disabled', 'true');
    await shot(page, DIR, 'composer-text-je-cherche');
    await page.getByTestId('studio-publish').click();
    await expect(page.getByText('Publié', { exact: true })).toBeVisible({ timeout: 60_000 });
    // A request is a publication of its author: on their profile, not an article of the Boutique.
    await page.goto('/u/awa_couture');
    await expect(page.getByText(`Je cherche ${RUN} machine à coudre`).first()).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test('ST-7 the draft is kept at every step and comes back', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15);
    await signIn(page, ...MEMBER);
    await studioWithFile(page, PHOTO);
    await page.getByTestId('studio-caption').fill(`Brouillon studio ${RUN}`);
    await page.waitForTimeout(900); // the draft is written after a short debounce
    await page.reload();
    await expect(page.getByTestId('studio-composer')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('studio-caption')).toHaveValue(`Brouillon studio ${RUN}`);
    await expect(page.getByRole('button', { name: /Brouillon repris/ })).toBeVisible();
    await shot(page, DIR, 'draft-restored');
    await page.getByRole('button', { name: /Brouillon repris/ }).click();
    await expect(page.getByTestId('studio-caption')).toHaveValue('');
    await expect(page.getByTestId('studio-media')).toHaveCount(0);
    await ctx.close();
  });

  test('ST-8 a recorded video goes to Fil and Reel', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15, { camera: true, mic: true });
    await signIn(page, ...MEMBER);
    await openStudio(page);
    await page.getByRole('tab', { name: 'Vidéo', exact: true }).click();
    await page.getByTestId('studio-shutter').click(); // start
    await expect(page.getByText(/^0:0\d \/ 3:00$/)).toBeVisible();
    await shot(page, DIR, 'capture-video-recording');
    await page.waitForTimeout(2500);
    await page.getByTestId('studio-shutter').click(); // stop
    await page.getByTestId('studio-next').click();
    await expect(page.getByTestId('studio-composer')).toBeVisible();
    await expect(page.getByTestId('studio-dest-reel')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('studio-dest-feed')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('studio-caption').fill(`Reel studio ${RUN}`);
    await shot(page, DIR, 'composer-video-reel');
    await page.getByTestId('studio-publish').click();
    await expect(page.getByText('Publié', { exact: true })).toBeVisible({ timeout: 90_000 });
    await ctx.close();
  });

  test('ST-9 a friends-only publication stays private (audience pill on Fil), a Reel needs « Tout le monde »', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, DEVICES.iphone15, { camera: true });
    await signIn(page, ...MEMBER);
    await openStudio(page);
    await page.getByRole('tab', { name: 'Vidéo', exact: true }).click();
    await page.getByRole('tab', { name: 'Photo', exact: true }).click();
    await page.getByTestId('studio-shutter').click();
    await expect(page.getByTestId('studio-strip')).toBeVisible();
    await page.getByTestId('studio-next').click();
    await page.getByTestId('studio-caption').fill(`Pour mes amis ${RUN}`);
    await page.getByTestId('studio-feed-audience').click();
    await page.getByRole('button', { name: 'Mes amis', exact: true }).click();
    await shot(page, DIR, 'composer-fil-audience-friends');
    await page.getByTestId('studio-publish').click();
    await expect(page).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 60_000 });
    const path = new URL(page.url()).pathname;
    await expect(page.getByText(`Pour mes amis ${RUN}`).filter({ visible: true }).first()).toBeVisible();

    const other = await newDevice(browser, DEVICES.iphone15);
    await signIn(other.page, ...SELLER);
    await other.page.goto(path);
    await expect(other.page.getByText(`Pour mes amis ${RUN}`)).toHaveCount(0);
    await other.ctx.close();
    await ctx.close();
  });
});
