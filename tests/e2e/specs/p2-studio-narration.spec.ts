import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { btn, DEVICES, FIXTURE, newDevice, pickFile, runId, shot, signUp, WEB_URL } from './helpers';

/**
 * P2 « créer, c’est montrer », in the Studio (replaces the W1.3 menu and editors): photos with a
 * narration that walks through them, an article, a narrated publication shared as a 24-hour
 * status, a voice status; and the buyer's side — the feed card, the article page and the public web
 * page behave like what the seller composed.
 *
 * Chromium's fake microphone plays a test tone, so recordings have real audio and a real length.
 */
test.use({ channel: 'chromium' });

const RUN = runId();
const PASSWORD = 'Jefeli-e2e-2026!';
const S = { name: `Awa Vitrine ${RUN}`, email: `st-s-${RUN}@e2e.jefeli.test`, handle: `awa_vitrine_${RUN}`, password: PASSWORD };
const B = { name: `Moussa Acheteur ${RUN}`, email: `st-b-${RUN}@e2e.jefeli.test`, handle: `moussa_achat_${RUN}`, password: PASSWORD };
const ARTICLE = `Boubou bazin ${RUN}`;
const DIR = 'p2-studio-narration';

let ctxS: BrowserContext;
let ctxB: BrowserContext;
let s: Page;
let b: Page;
let productPath = '';

const last = (l: Locator) => l.last();

test.describe.serial('P2 Studio: creation to feed', () => {
  test.beforeAll(async ({ browser }) => {
    ({ ctx: ctxS, page: s } = await newDevice(browser, DEVICES.iphone15, { mic: true, camera: true }));
    ({ ctx: ctxB, page: b } = await newDevice(browser, DEVICES.pixel7, { mic: true }));
    await signUp(s, S);
    await signUp(b, B);
  });

  test.afterAll(async () => {
    await ctxS?.close();
    await ctxB?.close();
  });

  test('NA-01 · three photos + a narration that walks through them + an article, to Fil, Statut and Boutique', async () => {
    await s.getByRole('tab', { name: 'Publier' }).click();
    await expect(s.getByTestId('studio-composer')).toBeVisible();
    const chooser = s.waitForEvent('filechooser');
    await s.getByTestId('studio-tool-gallery').click();
    await (await chooser).setFiles([FIXTURE('dress.jpg'), FIXTURE('bag.jpg'), FIXTURE('shoe.jpg')]);
    await expect(s.getByTestId('studio-thumb-image')).toHaveCount(3);

    // P4: the voice records inline, under the photos; tap the photo being talked about.
    await s.getByTestId('studio-tool-voice').click();
    await expect(s.getByText('Touchez la photo dont vous parlez')).toBeVisible();
    await expect(s.getByRole('button', { name: 'Mettre en pause' })).toBeVisible({ timeout: 10_000 });
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Montrer la photo 2' }).click();
    await shot(s, DIR, 'S-studio-voice-over-photos');
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Montrer la photo 3' }).click();
    await s.waitForTimeout(2000);
    await s.getByRole('button', { name: 'Terminer l’enregistrement' }).click();
    await expect(s.getByText(/^Votre voix accompagne ce contenu · \d+ s$/)).toBeVisible();

    // The composer: the voice rides with the photos; the switch makes it an article.
    await expect(s.getByText(/^Votre voix accompagne ce contenu/)).toBeVisible();
    await s.getByRole('switch', { name: 'Vendre ou troquer cet article' }).click();
    await s.getByTestId('studio-caption').fill(`${ARTICLE}\nNouveau boubou, je vous explique tout.`);
    await s.getByRole('textbox', { name: 'Prix', exact: true }).fill('25000');
    await s.getByRole('button', { name: /^Catégorie : / }).click();
    await btn(s, 'Mode femme').click();
    await expect(s.getByTestId('studio-dest-feed')).toHaveAttribute('aria-checked', 'true');
    await s.getByTestId('studio-dest-status').click(); // narrated: shared from the publication, needs Fil
    await expect(s.getByTestId('studio-dest-status')).toHaveAttribute('aria-checked', 'true');
    await shot(s, DIR, 'S-composer-narrated-article');
    await s.getByTestId('studio-publish').click();
    await expect(s).toHaveURL(/\/p\/[0-9a-f-]{36}(\?first=1)?$/, { timeout: 90_000 });
    productPath = new URL(s.url()).pathname;
    if (s.url().endsWith('?first=1')) await s.getByTestId('share-boutique-moment').getByRole('button', { name: 'Plus tard', exact: true }).click();
    await expect(last(s.getByRole('button', { name: /^Écouter l’explication/ }))).toBeVisible({ timeout: 30_000 });
    await shot(s, DIR, 'S-published-article-narrated');
  });

  test('NA-02 · buyer in the feed: listens, the photos follow, opens the article, writes to the seller', async () => {
    await b.goto(`/u/${S.handle}`);
    await btn(b, 'Suivre').click();
    await b.goto('/');
    await b.getByRole('tab', { name: 'Abonnements' }).click();
    const listen = b.getByRole('button', { name: /^Écouter l’explication/ }).first();
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
    // P2: one gold pill, round icons; the message icon opens the chat about this article.
    await expect(b.getByRole('button', { name: 'Faire une offre', exact: true })).toBeVisible();
    await b.getByRole('button', { name: 'Envoyer un message au vendeur' }).click();
    await expect(b).toHaveURL(/\/chat\/[0-9a-f-]{36}\?about=/, { timeout: 30_000 });
    await expect(b.getByText(`À propos de ${ARTICLE}`).last()).toBeVisible();
  });

  test('NA-03 · the article page and the public web page play the seller’s voice', async () => {
    await b.goto(productPath);
    const listen = last(b.getByRole('button', { name: /^Écouter l’explication/ }));
    await expect(listen).toBeVisible({ timeout: 30_000 });
    await listen.click();
    await expect(last(b.getByLabel('Photo 2 sur 3'))).toBeVisible({ timeout: 6_000 });
    await shot(b, DIR, 'B-article-voice-following');
    const page = await b.context().newPage();
    await page.goto(`${WEB_URL}${productPath}`);
    await expect(page.getByLabel('Écouter la présentation du vendeur')).toBeVisible();
    await expect(page.locator('img[src*=".webm"], img[src*=".m4a"], img[src*=".mp4"]')).toHaveCount(0);
    await page.close();
  });

  test('NA-04 · the narrated publication shared as a 24-hour status plays its voice, photos following', async () => {
    await b.goto('/');
    await btn(b, `Voir le statut de ${S.name}`).click();
    await expect(b.getByRole('button', { name: 'Mettre le statut en pause' })).toBeVisible({ timeout: 15_000 });
    const photo = b.getByTestId('status-photo');
    await expect(photo).toHaveAccessibleName('Photo 1 sur 3');
    await expect(photo).toHaveAccessibleName('Photo 2 sur 3', { timeout: 8_000 });
    await shot(b, DIR, 'B-status-narration-photo-2');
    await b.getByRole('button', { name: 'Fermer', exact: true }).click();
  });

  test('NA-05 · a voice status: voice alone, Statut only, published', async () => {
    await s.goto('/');
    await s.getByRole('tab', { name: 'Publier' }).click();
    // P4: the toolbar's microphone opens the recorder straight away.
    await s.getByTestId('studio-tool-voice').click(); // the recorder starts recording at once
    await expect(s.getByRole('button', { name: 'Mettre en pause' })).toBeVisible({ timeout: 10_000 });
    await s.waitForTimeout(2500);
    await s.getByRole('button', { name: 'Terminer l’enregistrement' }).click();
    await expect(s.getByText(/^Message vocal · \d+ s$/)).toBeVisible();
    await s.getByTestId('studio-dest-feed').click(); // untick Fil
    await s.getByTestId('studio-dest-status').click(); // tick Statut
    await shot(s, DIR, 'S-composer-voice-status');
    await s.getByTestId('studio-publish').click();
    await expect(s.getByText('Statut publié pour 24 h').last()).toBeVisible({ timeout: 30_000 });
  });

  test('NA-06 · « Présenter cet article »: the Studio opens with the article attached', async () => {
    await s.goto(productPath);
    await s.getByRole('button', { name: /^Présenter cet article/ }).click();
    await expect(s).toHaveURL(/\/studio\?product=/);
    await expect(s.getByTestId('studio-composer')).toBeVisible();
    await s.getByTestId('studio-tool-camera').click();
    await expect(s.getByTestId('studio-capture')).toBeVisible();
    await pickFile(s, () => s.getByTestId('studio-gallery').click(), FIXTURE('bag.jpg'));
    await s.getByTestId('studio-next').click();
    await expect(s.getByRole('button', { name: new RegExp(`^Article lié : ${ARTICLE}`) })).toBeVisible();
    await expect(s.getByRole('switch', { name: 'Vendre ou troquer cet article' })).toHaveCount(0); // already an article
    await shot(s, DIR, 'S-studio-present-article');
  });
});
