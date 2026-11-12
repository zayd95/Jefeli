import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { btn, DEVICES, field, FIXTURE, newDevice, pickFile, publishListing, runId, shot, signUp } from './helpers';

/**
 * W1.4 desktop web: the same app, backend and media in a desktop layout, in a real browser.
 *   - layouts: wide (≥ 1100: sidebar + rail), compact (768–1099: icon rail), phone (< 768: dock,
 *     unchanged), no sideways scroll at 1440 / 1280 / 1024 / 768 / 390 / 360 px and at browser
 *     zoom 125 / 150 / 200 % (a zoomed 1440 px window is a 1152 / 960 / 720 CSS px viewport);
 *   - keyboard: Tab walks the sidebar in order, Enter follows the focused link;
 *   - creation on desktop: an article, a narrated photo publication (photos + voice + article)
 *     beside its live feed preview, a video publication and a video status;
 *   - a buyer on desktop: Explorer grid, two-column article, listens to the narration in the feed,
 *     sees the video play muted, opens the status at phone proportions, sends a price offer and a
 *     Wecci from the article, and finds both in the Messages workspace context pane.
 */
test.use({ channel: 'chromium' });

const FFMPEG = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg'].find((p) => fs.existsSync(p));
const RUN = runId();
const PASSWORD = 'Jefeli-e2e-2026!';
const S = { name: `Bureau Vendeuse ${RUN}`, email: `dt-s-${RUN}@e2e.jefeli.test`, handle: `bureau_vend_${RUN}`, password: PASSWORD };
const B = { name: `Bureau Acheteur ${RUN}`, email: `dt-b-${RUN}@e2e.jefeli.test`, handle: `bureau_achat_${RUN}`, password: PASSWORD };
const ARTICLE = `Robe wax ${RUN}`;
const B_ITEM = `Sac cuir ${RUN}`;
const DIR = 'desktop';
const WIDE = { width: 1440, height: 900 };

const clipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jefeli-dt-clips-'));
function clip(seconds: number): string {
  const file = path.join(clipDir, `clip-${seconds}s.webm`);
  if (!fs.existsSync(file)) {
    execFileSync(FFMPEG!, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `testsrc=size=180x320:rate=8:duration=${seconds}`, '-c:v', 'libvpx', '-b:v', '40k', '-an', file]);
  }
  return file;
}

const playing = (p: Page) =>
  p.evaluate(() =>
    [...document.querySelectorAll('video')]
      .filter((v) => !v.paused && !v.ended && v.readyState >= 2)
      .map((v) => ({ muted: v.muted, t: v.currentTime, width: v.getBoundingClientRect().width })),
  );
const overflowX = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const sidebar = (p: Page) => p.getByRole('navigation', { name: 'Navigation principale' });
const navLink = (p: Page, name: string | RegExp) => sidebar(p).getByRole('link', { name });

let ctxS: BrowserContext;
let ctxB: BrowserContext;
let s: Page;
let b: Page;
let productUrl = '';

test.describe.serial('W1.4 desktop web', () => {
  test.skip(!FFMPEG, 'ffmpeg is needed to generate the test clips');

  test.beforeAll(async ({ browser }) => {
    ({ ctx: ctxS, page: s } = await newDevice(browser, WIDE, { mic: true }));
    ({ ctx: ctxB, page: b } = await newDevice(browser, WIDE, { mic: true }));
    await signUp(s, S);
    await signUp(b, B);
  });

  test.afterAll(async () => {
    await ctxS?.close();
    await ctxB?.close();
    fs.rmSync(clipDir, { recursive: true, force: true });
  });

  test('DT-01 · layouts and zoom: sidebar on desktop, the phone dock below 768 px, never a sideways scroll', async () => {
    const cases = [
      { size: { width: 1440, height: 900 }, mode: 'wide' },
      { size: { width: 1280, height: 800 }, mode: 'wide' },
      { size: { width: 1152, height: 720 }, mode: 'wide' }, // 1440 at 125 %
      { size: { width: 1024, height: 768 }, mode: 'compact' },
      { size: { width: 960, height: 600 }, mode: 'compact' }, // 1440 at 150 %
      { size: { width: 768, height: 1024 }, mode: 'compact' },
      { size: { width: 720, height: 450 }, mode: 'phone' }, // 1440 at 200 %
      { size: { width: 390, height: 844 }, mode: 'phone' },
      { size: DEVICES.android360, mode: 'phone' },
    ] as const;
    for (const { size, mode } of cases) {
      await b.setViewportSize(size);
      for (const route of ['/', '/explore', '/messages']) {
        await b.goto(route);
        await expect(b.getByRole('tab', { name: 'Publier' }).or(sidebar(b)).first()).toBeVisible();
        if (mode === 'phone') {
          await expect(sidebar(b)).toHaveCount(0);
          await expect(b.getByRole('tab', { name: 'Publier' })).toBeVisible();
        } else {
          await expect(sidebar(b)).toBeVisible();
          await expect(b.getByRole('tab', { name: 'Publier' })).toHaveCount(0);
          // Labels only when the sidebar is wide (Messages always keeps the icon rail).
          const labelled = mode === 'wide' && route !== '/messages';
          await expect(sidebar(b).getByText('Explorer', { exact: true })).toHaveCount(labelled ? 1 : 0);
        }
        expect(await overflowX(b), `${size.width}px ${route}`).toBeLessThanOrEqual(0);
      }
    }
    await b.setViewportSize(WIDE);
  });

  test('DT-02 · keyboard: Tab walks the sidebar in reading order; Enter follows the focused link', async () => {
    await b.goto('/');
    await expect(sidebar(b)).toBeVisible();
    const order: string[] = [];
    for (let i = 0; i < 10; i++) {
      await b.keyboard.press('Tab');
      order.push(await b.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''));
    }
    expect(order.slice(0, 10)).toEqual(['Jëfëli, accueil', 'Accueil', 'Explorer', 'Rechercher', 'Messages', 'Notifications', 'Enregistrés', 'Mon profil', 'Réglages', 'Créer']);
    await b.keyboard.press('Shift+Tab'); // back to Réglages
    await b.keyboard.press('Enter');
    await expect(b).toHaveURL(/\/settings$/);
    await expect(navLink(b, 'Réglages')).toHaveAttribute('aria-current', 'page');
  });

  test('DT-03 · seller on desktop: an article, then photos + narration + article beside the live feed preview', async () => {
    await publishListing(s, { file: FIXTURE('dress.jpg'), title: ARTICLE, mode: 'Vente ou troc', price: '25000', category: 'Chaussures', condition: 'Très bon état' });
    productUrl = new URL(s.url()).pathname;

    // « Créer » in the sidebar opens the same three-card menu as the phone's +.
    await s.goto('/');
    await sidebar(s).getByRole('button', { name: 'Créer' }).click();
    await s.getByTestId('create-post').click();
    await expect(s.getByRole('textbox', { name: 'Texte de la publication' })).toBeVisible();
    await expect(s.getByText('APERÇU DANS LE FIL · TEL QU’IL APPARAÎTRA')).toBeVisible();

    const chooser = s.waitForEvent('filechooser');
    await s.getByRole('button', { name: 'Média', exact: true }).click();
    await (await chooser).setFiles([FIXTURE('dress.jpg'), FIXTURE('bag.jpg')]);
    await expect(s.getByText('1/2', { exact: true }).first()).toBeVisible();

    await s.getByRole('button', { name: 'Voix', exact: true }).click();
    await expect(s.getByRole('button', { name: 'Mettre en pause' })).toBeVisible({ timeout: 10_000 });
    await s.waitForTimeout(2500);
    await s.getByRole('button', { name: 'Montrer la photo 2' }).click();
    await s.waitForTimeout(2500);
    await s.getByRole('button', { name: 'Terminer l’enregistrement' }).click();
    await expect(s.getByText(/^Votre explication · 0:0[4-6] · visite guidée$/)).toBeVisible();

    await s.getByRole('button', { name: 'Article', exact: true }).click();
    await s.getByRole('checkbox', { name: ARTICLE }).click();
    await btn(s, 'Terminé').click();
    await s.getByRole('textbox', { name: 'Légende' }).fill(`Ma robe expliquée depuis l’ordinateur ${RUN}`);
    // The preview pane is the feed's own card, with the caption and the article as they will appear.
    const preview = s.getByLabel('Aperçu dans le fil');
    await expect(preview.getByText(`Ma robe expliquée depuis l’ordinateur ${RUN}`)).toBeVisible();
    await expect(preview.getByText(ARTICLE).first()).toBeVisible();
    expect(await overflowX(s)).toBeLessThanOrEqual(0);
    await shot(s, DIR, 'S-desktop-editor-preview');

    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 90_000 });
    await expect(s.getByRole('button', { name: /^Écouter l’explication/ }).last()).toBeVisible();
  });

  test('DT-04 · seller on desktop: a 40-second video publication and a 12-second video status', async () => {
    await s.goto('/publish/post');
    if (await s.getByTestId('draft-choice').isVisible().catch(() => false)) {
      await btn(s, 'Nouvelle publication').click();
      await btn(s, 'Supprimer et commencer').click();
    }
    await pickFile(s, () => btn(s, 'Média').click(), clip(40));
    await expect(s.getByRole('button', { name: 'Couverture (vidéo)' })).toBeVisible({ timeout: 30_000 });
    await s.getByRole('textbox', { name: 'Légende' }).fill(`Défilé en vidéo ${RUN}`);
    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 120_000 });

    await s.goto('/publish/status');
    await pickFile(s, () => btn(s, 'Photo ou vidéo de la galerie').click(), clip(12));
    await btn(s, 'Écrire sur le statut').click();
    await s.getByRole('textbox', { name: 'Texte du statut' }).fill(`Statut vidéo bureau ${RUN}`);
    await btn(s, 'Publier le statut').click();
    await expect(sidebar(s)).toBeVisible({ timeout: 60_000 });
    await expect(s).not.toHaveURL(/publish/, { timeout: 60_000 });
  });

  test('DT-05 · buyer on desktop: the narration moves the photos; the video plays muted, one at a time', async () => {
    await b.goto(`/u/${S.handle}`);
    await btn(b, 'Suivre').click();
    await expect(b.getByRole('button', { name: 'Abonné(e)' })).toBeVisible();
    await b.goto('/');
    await b.getByRole('tab', { name: 'Abonnements' }).click();
    await expect(b.getByText(`Défilé en vidéo ${RUN}`).first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await playing(b)).length, { timeout: 30_000 }).toBe(1);
    const [v] = await playing(b);
    expect(v!.muted).toBe(true);
    expect(v!.width).toBeGreaterThan(500); // the centred desktop column, not a thumbnail
    await shot(b, DIR, 'B-desktop-feed-video');

    const listen = b.getByRole('button', { name: /^Écouter l’explication/ }).first();
    await listen.scrollIntoViewIfNeeded();
    await listen.click();
    await expect(b.getByText('2/2', { exact: true }).first()).toBeVisible({ timeout: 8_000 });
    await expect.poll(async () => (await playing(b)).length).toBe(0); // the voice took over
    await shot(b, DIR, 'B-desktop-narration-following');
    await b.getByRole('button', { name: 'Mettre en pause' }).first().click();
  });

  test('DT-06 · buyer on desktop: a video status at phone proportions, played to its end', async () => {
    await b.goto('/');
    await btn(b, `Voir le statut de ${S.name}`).click();
    const caption = b.getByText(`Statut vidéo bureau ${RUN}`, { exact: true }).last();
    await expect(caption).toBeVisible();
    await expect.poll(async () => (await playing(b)).length, { timeout: 30_000 }).toBe(1);
    const width = (await playing(b))[0]!.width;
    expect(width).toBeGreaterThan(380);
    expect(width).toBeLessThanOrEqual(520); // 9:16 stage, not stretched across 1192 px
    await shot(b, DIR, 'B-desktop-video-status');
    await b.waitForTimeout(8_000);
    await expect(caption).toBeVisible();
    expect((await playing(b))[0]?.t ?? 0).toBeGreaterThan(6);
    await expect(caption).toBeHidden({ timeout: 15_000 });
  });

  test('DT-07 · buyer on desktop: Explorer grid and the two-column article', async () => {
    await b.goto('/explore');
    await expect(b.getByText(ARTICLE).first()).toBeVisible({ timeout: 30_000 });
    // Several product cards share a row at 1440 px.
    const tops = await b.evaluate(() =>
      [...document.querySelectorAll('[data-testid="listing-card"]')].slice(0, 6).map((e) => Math.round(e.getBoundingClientRect().top)),
    );
    if (tops.length >= 4) expect(tops.filter((t) => t === tops[0]).length).toBeGreaterThanOrEqual(4);
    await b.goto(productUrl);
    const title = b.getByText(ARTICLE, { exact: true }).first();
    await expect(title).toBeVisible();
    const media = (await b.getByTestId('product-media').first().boundingBox())!;
    const head = (await title.boundingBox())!;
    expect(head.x).toBeGreaterThan(media.x + media.width - 1); // the panel sits beside the photos
    await shot(b, DIR, 'B-desktop-article');
  });

  test('DT-08 · buyer on desktop: a price offer and a Wecci from the article land in the Messages workspace', async () => {
    await publishListing(b, { file: FIXTURE('bag.jpg'), title: B_ITEM, mode: 'Vente ou troc', price: '18000', category: 'Sacs & accessoires', condition: 'Comme neuf' });

    await b.goto(productUrl);
    await btn(b, 'Faire une offre').click();
    await field(b, 'Votre offre').fill('22000');
    await btn(b, 'Envoyer la proposition').click();
    await expect(b.getByText('OFFRE DE PRIX', { exact: true }).last()).toBeVisible();

    // The seller accepts from their own desktop workspace (one pending proposal per article).
    await s.goto('/messages');
    await s.getByText(B.name).first().click();
    await expect(s.getByText('OFFRE DE PRIX', { exact: true }).last()).toBeVisible({ timeout: 30_000 });
    await btn(s, 'Accepter').first().click();
    await expect(btn(s, 'Voir l’accord').first()).toBeVisible();

    await b.goto(productUrl);
    await btn(b, 'Proposer un échange (troc)').click();
    await b.getByRole('radio', { name: B_ITEM }).click();
    await field(b, 'Différence en argent (facultatif)').fill('5000');
    await b.getByRole('radio', { name: /Moi/ }).click();
    await btn(b, 'Envoyer la proposition').click();
    await expect(b.getByText('PROPOSITION DE TROC', { exact: true }).last()).toBeVisible();

    // Three panes at 1440: conversations, the thread, its context (article + both proposals).
    await expect(b.getByPlaceholder('Rechercher une conversation')).toBeVisible();
    const context = b.getByLabel('Contexte de la conversation');
    await expect(context).toBeVisible();
    await expect(context.getByText(ARTICLE).first()).toBeVisible();
    await expect(context.getByText(/^Offre de prix · 22\s000\sF\sCFA/)).toBeVisible();
    await expect(context.getByText(/^Wecci \(troc\) · 5\s000\sF\sCFA/)).toBeVisible();
    await shot(b, DIR, 'B-desktop-messages-workspace');

    // Below 1100 px the context pane folds away; the thread stays.
    await b.setViewportSize({ width: 1024, height: 768 });
    await expect(context).toHaveCount(0);
    await expect(b.getByText('PROPOSITION DE TROC', { exact: true }).last()).toBeVisible();
    expect(await overflowX(b)).toBeLessThanOrEqual(0);
    await b.setViewportSize(WIDE);
  });
});
