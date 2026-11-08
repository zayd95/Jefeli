import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { btn, FIXTURE, newDevice, pickFile, publishListing, runId, shot, signUp } from './helpers';

/**
 * W1.1 media-first commerce, in a real browser against the real backend:
 *   - a seller publishes an exactly 3-minute video tied to one of their articles; 3 min 01 s is
 *     refused as soon as it is chosen;
 *   - a buyer who follows them sees it in « Abonnements » with its poster, playing muted, one
 *     video at a time, paused when leaving Accueil; the article and the conversation are one tap
 *     away;
 *   - a 12-second video status plays to its end instead of being cut at the 5.5 s image timer.
 *
 * Clips are generated with ffmpeg when the run starts (WebM/VP8: Playwright's Chromium has no
 * H.264), not committed. Without ffmpeg the spec is skipped.
 */
const FFMPEG = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg'].find((p) => fs.existsSync(p));
const RUN = runId();
const PASSWORD = 'Jefeli-e2e-2026!';
const S = { name: `Vidéo Boutique ${RUN}`, email: `vs-${RUN}@e2e.jefeli.test`, handle: `video_seller_${RUN}`, password: PASSWORD };
const B = { name: `Vidéo Acheteur ${RUN}`, email: `vb-${RUN}@e2e.jefeli.test`, handle: `video_buyer_${RUN}`, password: PASSWORD };
const ARTICLE = `Sandales cuir ${RUN}`;
const DIR = 'media';

const clipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jefeli-clips-'));
function clip(seconds: number): string {
  const file = path.join(clipDir, `clip-${seconds}s.webm`);
  if (!fs.existsSync(file)) {
    execFileSync(FFMPEG!, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `testsrc=size=180x320:rate=8:duration=${seconds}`, '-c:v', 'libvpx', '-b:v', '40k', '-an', file]);
  }
  return file;
}

/** Videos currently playing on the page (decoded frames advancing, not just « not paused »). */
const playing = (p: Page) =>
  p.evaluate(() =>
    [...document.querySelectorAll('video')]
      .filter((v) => !v.paused && !v.ended && v.readyState >= 2)
      // Rendered width: the 180×320 test clip must be scaled to the frame, not drawn at its pixel size.
      .map((v) => ({ muted: v.muted, t: v.currentTime, width: v.getBoundingClientRect().width })),
  );

let ctxS: BrowserContext;
let ctxB: BrowserContext;
let s: Page;
let b: Page;
let postPath = '';

test.describe.serial('Media-first commerce: 3-minute videos', () => {
  test.skip(!FFMPEG, 'ffmpeg is needed to generate the test clips');

  test.beforeAll(async ({ browser }) => {
    ({ ctx: ctxS, page: s } = await newDevice(browser));
    ({ ctx: ctxB, page: b } = await newDevice(browser));
    await signUp(s, S);
    await signUp(b, B);
  });

  test.afterAll(async () => {
    await ctxS?.close();
    await ctxB?.close();
    fs.rmSync(clipDir, { recursive: true, force: true });
  });

  test('MED-01 · a video over 3 minutes is refused as soon as it is chosen', async () => {
    await s.goto('/publish/post');
    await pickFile(s, () => btn(s, 'Média').click(), clip(181));
    await expect(s.getByText('Vidéo trop longue : 3 minutes maximum.').last()).toBeVisible();
    await expect(s.getByTestId('reorder-strip')).toHaveCount(0);
    await shot(s, DIR, 'S-181s-refused');
  });

  test('MED-02 · the seller publishes an exactly 3-minute video tied to their article', async () => {
    await publishListing(s, { file: FIXTURE('shoe.jpg'), title: ARTICLE, price: '12000', category: 'Chaussures', condition: 'Très bon état' });

    await s.goto('/publish/post');
    await pickFile(s, () => btn(s, 'Média').click(), clip(180));
    // The browser read the real duration and captured a cover frame before anything was sent: the
    // editor's preview is the feed's player, poster first.
    await expect(s.getByRole('button', { name: 'Couverture (vidéo)' })).toBeVisible({ timeout: 30_000 });
    await expect(s.getByRole('button', { name: 'Lire la vidéo' }).last()).toBeVisible();
    // A video keeps its own sound: no voice over it.
    await expect(s.getByRole('button', { name: 'Voix', exact: true })).toBeDisabled();
    await btn(s, 'Article').click();
    await s.getByRole('checkbox', { name: ARTICLE }).click();
    await btn(s, 'Terminé').click();
    await s.getByRole('textbox', { name: 'Légende' }).fill(`Nouvelle collection en vidéo ${RUN}`);
    await shot(s, DIR, 'S-composer-180s-video');
    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 120_000 });
    postPath = new URL(s.url()).pathname;
    await expect(s.getByText(`Nouvelle collection en vidéo ${RUN}`).last()).toBeVisible();
    await expect(s.getByRole('button', { name: new RegExp(`^Voir l’article ${ARTICLE}`) }).last()).toBeVisible();
    // Poster image shown before playback (captured on upload), and the stored file lasts 180 s.
    await expect(s.getByRole('button', { name: 'Lire la vidéo' }).last()).toBeVisible();
    await btn(s, 'Lire la vidéo').last().click();
    await expect.poll(async () => s.evaluate(() => Math.round(document.querySelector('video')?.duration ?? 0)), { timeout: 30_000 }).toBe(180);
    await shot(s, DIR, 'S-post-published');
  });

  test('MED-03 · a follower sees it play muted in Abonnements, one video at a time', async () => {
    await b.goto(`/u/${S.handle}`);
    await btn(b, 'Suivre').click();
    await expect(b.getByRole('button', { name: 'Abonné(e)' })).toBeVisible();

    await b.goto('/');
    await b.getByRole('tab', { name: 'Abonnements' }).click();
    await expect(b.getByText(`Nouvelle collection en vidéo ${RUN}`).last()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await playing(b)).length, { timeout: 30_000 }).toBe(1);
    const [first] = await playing(b);
    expect(first!.muted).toBe(true);
    expect(first!.width).toBeGreaterThan(300); // full card width on a 393 px phone
    await shot(b, DIR, 'B-following-video-autoplay');

    // Tap: pause; tap again: resume. Never more than one video at a time.
    await btn(b, 'Mettre en pause').last().click();
    await expect.poll(async () => (await playing(b)).length).toBe(0);
    await btn(b, 'Lire la vidéo').last().click();
    await expect.poll(async () => (await playing(b)).length).toBe(1);

    // Leaving Accueil pauses it.
    await b.goto('/explore');
    await expect.poll(async () => (await playing(b)).length).toBe(0);
  });

  test('MED-04 · from the video, the article and the conversation are one tap away', async () => {
    await b.goto(postPath);
    await b.getByRole('button', { name: new RegExp(`^Voir l’article ${ARTICLE}`) }).last().click();
    await expect(b).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
    await expect(b.getByText(ARTICLE).last()).toBeVisible();
    await b.goBack();
    await b.getByRole('button', { name: `Écrire au vendeur à propos de ${ARTICLE}` }).last().click();
    // W1.2: a conversation opened from an article carries it as context (?about=<article>).
    await expect(b).toHaveURL(/\/chat\/[0-9a-f-]{36}(\?about=[0-9a-f-]{36})?$/, { timeout: 30_000 });
    await expect(b.getByText(ARTICLE).last()).toBeVisible();
    await shot(b, DIR, 'B-conversation-from-video');
  });

  test('MED-05 · a 12-second video status plays to its end, not cut at the image timer', async () => {
    await s.goto('/publish/status');
    await pickFile(s, () => btn(s, 'Choisir dans la galerie').click(), clip(12));
    await s.getByRole('textbox', { name: 'Légende du statut' }).fill(`Arrivage en vidéo ${RUN}`);
    await btn(s, 'Publier le statut').click();
    await expect(s.getByRole('button', { name: 'Notifications' })).toBeVisible({ timeout: 60_000 });

    await b.goto('/');
    await btn(b, `Voir le statut de ${S.name}`).click();
    const caption = b.getByText(`Arrivage en vidéo ${RUN}`, { exact: true }).last();
    await expect(caption).toBeVisible();
    await expect.poll(async () => (await playing(b)).length, { timeout: 30_000 }).toBe(1);
    expect((await playing(b))[0]!.width).toBeGreaterThan(380); // full screen
    await shot(b, DIR, 'B-video-status');
    // Past the 5.5 s image duration the viewer is still on this status, driven by the video.
    await b.waitForTimeout(8_000);
    await expect(caption).toBeVisible();
    expect((await playing(b))[0]?.t ?? 0).toBeGreaterThan(6);
    // At the end of the video it moves on (only status: the viewer closes).
    await expect(caption).toBeHidden({ timeout: 15_000 });
  });
});
