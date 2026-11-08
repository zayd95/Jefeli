import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { btn, DEVICES, field, FIXTURE, newDevice, pickFile, publishListing, runId, shot, signUp, WEB_URL } from './helpers';

/**
 * W1.3 « créer, c’est montrer »: the three-card + menu, explicit drafts, the adaptive Publication
 * editor (writing canvas → photos with a narration and its « visite guidée » → published), and the
 * proof that the editor's preview and the published card behave the same: same voice control,
 * same photo navigation, same article chip, same buyer actions.
 *
 * Chromium's fake microphone plays a test tone, so recordings have real audio and a real length.
 */
test.use({ channel: 'chromium' });

const RUN = runId();
const PASSWORD = 'Jefeli-e2e-2026!';
const S = { name: `Awa Vitrine ${RUN}`, email: `cr-s-${RUN}@e2e.jefeli.test`, handle: `awa_vitrine_${RUN}`, password: PASSWORD };
const B = { name: `Moussa Acheteur ${RUN}`, email: `cr-b-${RUN}@e2e.jefeli.test`, handle: `moussa_achat_${RUN}`, password: PASSWORD };
const ARTICLE = `Boubou bazin ${RUN}`;
const DIR = 'create';

let ctxS: BrowserContext;
let ctxB: BrowserContext;
let s: Page;
let b: Page;
let postUrl = '';

const last = (l: Locator) => l.last();

async function openMenu(p: Page) {
  await p.getByRole('tab', { name: 'Publier' }).click();
  await expect(p.getByTestId('create-post')).toBeVisible();
}

test.describe.serial('W1.3 creation to feed', () => {
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

  test('CR-01 · the + : three cards side by side over a recognizable feed, nothing else; closes by ×, outside tap or Escape', async () => {
    await openMenu(s);
    const box = async (id: string) => (await s.getByTestId(id).boundingBox())!;
    const [status, post, listing] = [await box('create-status'), await box('create-post'), await box('create-listing')];
    const close = (await s.getByRole('button', { name: 'Fermer', exact: true }).boundingBox())!;
    const cx = (r: { x: number; width: number }) => r.x + r.width / 2;
    // Publication right above the ×, the others on each side, no overlap, all well above 44 pt.
    expect(Math.abs(cx(close) - cx(post))).toBeLessThan(4);
    expect(post.y + post.height).toBeLessThan(close.y);
    expect(status.x + status.width).toBeLessThanOrEqual(post.x + 2);
    expect(post.x + post.width).toBeLessThanOrEqual(listing.x + 2);
    for (const r of [status, post, listing, close]) expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(44);
    // No quick starts or second selector any more.
    await expect(s.getByText('COMMENCER PAR')).toHaveCount(0);
    await shot(s, DIR, 'S-plus-menu');
    await s.keyboard.press('Escape');
    await expect(s.getByTestId('create-post')).toHaveCount(0);
    await openMenu(s);
    await s.getByRole('button', { name: 'Fermer le menu de création' }).click({ position: { x: 20, y: 120 } });
    await expect(s.getByTestId('create-post')).toHaveCount(0);
  });

  test('CR-02 · narrow phone (360 pt): the same three cards fit without scrolling', async () => {
    await s.setViewportSize(DEVICES.android360);
    await openMenu(s);
    for (const id of ['create-status', 'create-post', 'create-listing']) {
      const r = (await s.getByTestId(id).boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(DEVICES.android360.width);
    }
    await shot(s, DIR, 'S-plus-menu-360');
    await s.keyboard.press('Escape');
    await s.setViewportSize(DEVICES.iphone15);
  });

  test('CR-03 · a draft is never replaced silently: badge, continue, or start anew after confirming', async () => {
    await openMenu(s);
    await s.getByTestId('create-post').click();
    await expect(s).toHaveURL(/\/publish\/post/);
    await s.getByRole('textbox', { name: 'Texte de la publication' }).fill(`Arrivage de bazin ce matin ${RUN}`);
    await s.waitForTimeout(700); // the draft is saved after 400 ms
    await s.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(s).not.toHaveURL(/\/publish\/post/);

    await openMenu(s);
    await expect(s.getByTestId('create-post')).toHaveAccessibleName(/Brouillon en cours/);
    await expect(s.getByText('BROUILLON')).toBeVisible();
    await shot(s, DIR, 'S-plus-menu-draft-badge');
    await s.getByTestId('create-post').click();
    await expect(s.getByTestId('draft-choice')).toBeVisible();
    await shot(s, DIR, 'S-draft-choice');
    await btn(s, 'Continuer le brouillon').click();
    await expect(s.getByRole('textbox', { name: 'Texte de la publication' })).toHaveValue(`Arrivage de bazin ce matin ${RUN}`);

    // Opening the editor from anywhere else asks too.
    await s.goto('/publish/post?intent=seek');
    await expect(s.getByTestId('draft-choice')).toBeVisible();
    await btn(s, 'Nouvelle publication').click();
    await expect(s.getByText('Supprimer le brouillon ?')).toBeVisible();
    await btn(s, 'Garder le brouillon').click();
    await btn(s, 'Nouvelle publication').click();
    await btn(s, 'Supprimer et commencer').click();
    await expect(s.getByRole('textbox', { name: 'Texte de la publication' })).toHaveValue('');
    await expect(s.getByRole('button', { name: /^Type de publication : Je cherche/ })).toBeVisible();
    await s.getByRole('button', { name: 'Fermer', exact: true }).click();
  });

  test('CR-04 · photos + a narration that walks through them + an article, in the adaptive editor', async () => {
    await publishListing(s, { file: FIXTURE('dress.jpg'), title: ARTICLE, price: '25000', category: 'Chaussures', condition: 'Très bon état' });
    await s.goto('/');
    await openMenu(s);
    await s.getByTestId('create-post').click();
    await expect(s.getByRole('textbox', { name: 'Texte de la publication' })).toBeVisible();
    await shot(s, DIR, 'S-editor-write');

    const chooser = s.waitForEvent('filechooser');
    await s.getByRole('button', { name: 'Média', exact: true }).click();
    await (await chooser).setFiles([FIXTURE('dress.jpg'), FIXTURE('bag.jpg'), FIXTURE('shoe.jpg')]);
    // The canvas became the preview, rendered by the feed's own component.
    await expect(last(s.getByTestId('post-media'))).toBeVisible();
    await expect(last(s.getByLabel('Photo 1 sur 3'))).toBeVisible();

    // Voix opens the studio and records at once; tap the photo being talked about.
    await s.getByRole('button', { name: 'Voix', exact: true }).click();
    await expect(s.getByText('Touchez la photo dont vous parlez')).toBeVisible();
    await expect(s.getByRole('button', { name: 'Mettre en pause' })).toBeVisible({ timeout: 10_000 });
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Montrer la photo 2' }).click();
    await shot(s, DIR, 'S-studio-photos');
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Montrer la photo 3' }).click();
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Terminer l’enregistrement' }).click();
    await expect(s.getByText(/^Votre explication · 0:0[5-7] · visite guidée$/)).toBeVisible();
    await s.getByRole('button', { name: /^Langue parlée/ }).click();
    await s.getByRole('radio', { name: 'Wolof' }).click();
    await expect(s.getByText(/^Votre explication · Wolof · 0:0[5-7] · visite guidée$/)).toBeVisible();

    // The gallery shows when each photo appears in the narration.
    await expect(s.getByRole('button', { name: /^Photo 2, montrée à 0:0[1-3]$/ })).toBeVisible();
    // Reorder without dragging: select photo 3, move it left; the narration keeps pointing to it.
    await s.getByRole('button', { name: /^Photo 3, montrée à/ }).click();
    await btn(s, 'Déplacer à gauche').click();
    await expect(s.getByRole('button', { name: /^Photo 2, montrée à 0:0[3-5]$/ })).toBeVisible();
    await expect(s.getByRole('button', { name: /^Photo 3, montrée à 0:0[1-3]$/ })).toBeVisible();
    // And by dragging: photo 3 back to its place.
    const from = (await s.getByTestId('thumb-1').boundingBox())!;
    await s.mouse.move(from.x + 30, from.y + 30);
    await s.mouse.down();
    await s.mouse.move(from.x + 60, from.y + 30, { steps: 4 });
    await s.mouse.move(from.x + 100, from.y + 30, { steps: 4 });
    await s.mouse.up();
    await expect(s.getByRole('button', { name: /^Photo 2, montrée à 0:0[1-3]$/ })).toBeVisible();

    await s.getByRole('button', { name: 'Article', exact: true }).click();
    await s.getByRole('checkbox', { name: ARTICLE }).click();
    await btn(s, 'Terminé').click();
    await s.getByRole('textbox', { name: 'Légende' }).fill(`Nouveau boubou, je vous explique tout ${RUN}`);
    await expect(last(s.getByRole('button', { name: new RegExp(`^Voir l’article ${ARTICLE}`) }))).toBeVisible();
    await shot(s, DIR, 'S-editor-photos-voice-article');

    // Preview = published: the narration in the editor moves the gallery like the feed will.
    await last(s.getByRole('button', { name: /^Écouter l’explication, Wolof/ })).click();
    await expect(last(s.getByLabel('Photo 2 sur 3'))).toBeVisible({ timeout: 6_000 });
    await shot(s, DIR, 'S-editor-preview-following');
    await last(s.getByRole('button', { name: 'Mettre en pause' })).click();

    await btn(s, 'Publier').click();
    await expect(s).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 90_000 });
    postUrl = new URL(s.url()).pathname;
    await expect(last(s.getByRole('button', { name: /^Écouter l’explication, Wolof · 0:0[5-7]/ }))).toBeVisible();
    await shot(s, DIR, 'S-published-post');
  });

  test('CR-05 · buyer in the feed: listens, the photos follow, opens the article, writes to the seller', async () => {
    await b.goto(`/u/${S.handle}`);
    await btn(b, 'Suivre').click();
    await b.goto('/');
    await b.getByRole('tab', { name: 'Abonnements' }).click();
    const listen = b.getByRole('button', { name: /^Écouter l’explication, Wolof/ }).first();
    await expect(listen).toBeVisible({ timeout: 30_000 });
    await b.waitForTimeout(1200);
    await expect(b.getByRole('button', { name: 'Mettre en pause' })).toHaveCount(0); // nothing plays by itself
    await shot(b, DIR, 'B-feed-narrated-post');
    await listen.click();
    await expect(b.getByLabel('Photo 2 sur 3').first()).toBeVisible({ timeout: 6_000 });
    await shot(b, DIR, 'B-feed-following-photo-2');
    await expect(b.getByLabel('Photo 3 sur 3').first()).toBeVisible({ timeout: 6_000 });
    await b.getByRole('button', { name: new RegExp(`^Voir l’article ${ARTICLE}`) }).first().click();
    await expect(b).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
    await btn(b, 'Envoyer un message').click();
    await expect(b).toHaveURL(/\/chat\/[0-9a-f-]{36}\?about=/, { timeout: 30_000 });
    await expect(b.getByText(`À propos de ${ARTICLE}`).last()).toBeVisible();
  });

  test('CR-06 · Article: a shop window, presented in the seller’s voice; buyers hear it on the app and the web', async () => {
    const TITLE = `Sac tressé ${RUN}`;
    await s.goto('/');
    await openMenu(s);
    await s.getByTestId('create-listing').click();
    await expect(s).toHaveURL(/\/publish\/listing/);
    await shot(s, DIR, 'S-article-empty-window');
    const chooser = s.waitForEvent('filechooser');
    await btn(s, 'Ajouter des photos ou une vidéo').click();
    await (await chooser).setFiles([FIXTURE('bag.jpg'), FIXTURE('shoe.jpg')]);
    await expect(last(s.getByText('APERÇU ACHETEUR'))).toBeVisible();
    await field(s, 'Nom de l’article').fill(TITLE);
    await field(s, 'Prix en francs CFA').fill('15000');
    await s.getByRole('radio', { name: 'Les deux', exact: true }).click();
    // Required details still empty: « Mettre en vente » says so and flags the pill, nothing is sent.
    await btn(s, 'Mettre en vente').click();
    await expect(last(s.getByText('À compléter : la catégorie'))).toBeVisible();
    await expect(s).toHaveURL(/\/publish\/listing/);

    await btn(s, 'Présenter l’article en voix').click();
    await expect(s.getByRole('button', { name: 'Mettre en pause' })).toBeVisible({ timeout: 10_000 });
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Montrer la photo 2' }).click();
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Terminer l’enregistrement' }).click();
    await expect(s.getByText(/^Votre présentation · 0:0[3-5] · visite guidée$/)).toBeVisible();
    await s.getByRole('button', { name: /^Catégorie : requis/ }).click();
    await btn(s, 'Sacs & accessoires').click();
    await btn(s, 'Comme neuf').click();
    await btn(s, 'Terminé').click();
    await shot(s, DIR, 'S-article-window-with-voice');
    await btn(s, 'Mettre en vente').click();
    await expect(s).toHaveURL(/\/p\/[0-9a-f-]{36}$/, { timeout: 90_000 });
    const productPath = new URL(s.url()).pathname;

    // The buyer hears the seller over the photos, which follow the voice, then writes.
    await b.goto(productPath);
    const listen = last(b.getByRole('button', { name: /^Écouter l’explication/ }));
    await expect(listen).toBeVisible({ timeout: 30_000 });
    await listen.click();
    await expect(last(b.getByLabel('Photo 2 sur 2'))).toBeVisible({ timeout: 6_000 });
    await shot(b, DIR, 'B-article-voice-following');
    // The same voice travels with the feed share of the article.
    await b.goto(`/u/${S.handle}`);
    await b.getByRole('button', { name: new RegExp(`^Publication\\. ${TITLE}`) }).first().click();
    await expect(last(b.getByRole('button', { name: /^Écouter l’explication/ }))).toBeVisible({ timeout: 30_000 });
    await expect(last(b.getByRole('button', { name: new RegExp(`^Voir l’article ${TITLE}`) }))).toBeVisible();
    // And the public web page plays it (never as a broken photo).
    const page = await b.context().newPage();
    await page.goto(`${WEB_URL}${productPath}`);
    await expect(page.getByLabel('Écouter la présentation du vendeur')).toBeVisible();
    await expect(page.locator('img[src*=".webm"], img[src*=".m4a"], img[src*=".mp4"]')).toHaveCount(0);
    await page.close();
  });
});
