/**
 * Feed engagement pass, through the real UI with two fresh accounts on a phone-sized viewport:
 * B asks the community (« Je cherche »), A hearts it and rates it ⭐ (persistence), answers in
 * private and in public, B sees the comment preview on its feed card, and a failed heart rolls
 * back. Ratings stay private: the author sees no individual note.
 */
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { btn, newDevice, runId, shot, signUp } from './helpers';

const RUN = runId();
const PASSWORD = 'Test-jefeli-2026!';
const A = { name: `Aminata Test ${RUN}`, email: `ca-${RUN}@e2e.jefeli.test`, handle: `aminata_${RUN}`, password: PASSWORD };
const B = { name: `Babacar Test ${RUN}`, email: `cb-${RUN}@e2e.jefeli.test`, handle: `babacar_${RUN}`, password: PASSWORD };
const REQUEST = `Je cherche un réparateur de machine à coudre à Dakar (test ${RUN})`;
const ANSWER = `Essayez l’atelier du marché HLM, ils réparent les Singer (test ${RUN}).`;
const DIR = 'community';

let ctxA: BrowserContext;
let ctxB: BrowserContext;
let a: Page;
let b: Page;
let postUrl = '';

// Screens lower in the navigation stack stay mounted (hidden): only target what the member sees.
const visible = (l: Locator) => l.filter({ visible: true }).first();
const heartButton = (p: Page) => visible(p.getByRole('button', { name: /^(Aimer|Retirer mon j’aime)/ }));
const rateButton = (p: Page) => visible(p.getByTestId('act-rate'));

test.describe.serial('Community: intents, hearts, ratings, comments', () => {
  test.beforeAll(async ({ browser }) => {
    ({ ctx: ctxA, page: a } = await newDevice(browser));
    ({ ctx: ctxB, page: b } = await newDevice(browser));
    await signUp(b, B);
    await signUp(a, A);
  });

  test.afterAll(async () => {
    await ctxA?.close();
    await ctxB?.close();
  });

  test('B asks the community with an optional intent in the one publication composer (« Je cherche »)', async () => {
    // P2: the Studio's « Texte » card with the « Je cherche… » starter (a request, never an article).
    await b.goto('/studio?intent=seek');
    await expect(b.getByTestId('studio-composer')).toBeVisible();
    await expect(b.getByTestId('studio-caption')).toHaveValue('Je cherche ');
    await b.getByTestId('studio-caption').fill(REQUEST);
    await shot(b, DIR, 'B-studio-je-cherche');
    await b.getByTestId('studio-publish').click();
    await expect(b).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 30_000 });
    postUrl = new URL(b.url()).pathname;
    await expect(visible(b.getByLabel('Type de publication : Je cherche'))).toBeVisible();
    // Authors see their count but can neither heart nor rate their own publication.
    await expect(visible(b.getByLabel('0 j’aime', { exact: true }))).toBeVisible();
    await expect(b.getByRole('button', { name: /^Aimer/ }).filter({ visible: true })).toHaveCount(0);
    await expect(b.getByTestId('act-rate').filter({ visible: true })).toHaveCount(0);
    await expect(visible(b.getByTestId('act-views'))).toBeVisible(); // 👁 is the author's own
    await shot(b, DIR, 'B-request-published');
  });

  test('A hearts it and rates it ⭐ privately, and both persist', async () => {
    await a.goto(postUrl);
    await expect(visible(a.getByText(REQUEST, { exact: true }))).toBeVisible();
    await heartButton(a).click();
    await expect(heartButton(a)).toHaveAccessibleName(/^Retirer mon j’aime\. 1 j’aime/);
    await a.reload();
    await expect(heartButton(a)).toHaveAccessibleName(/^Retirer mon j’aime\. 1 j’aime/, { timeout: 20_000 });
    await shot(a, DIR, 'A-hearted');

    await rateButton(a).click();
    await visible(a.getByTestId('rate-4')).click();
    await expect(rateButton(a)).toHaveAccessibleName(/^Votre note : 4 sur 5/);
    await a.reload();
    await expect(rateButton(a)).toHaveAccessibleName(/^Votre note : 4 sur 5/, { timeout: 20_000 });
    await shot(a, DIR, 'A-rated-private');

    // The author sees the heart in the public count but never an individual rating.
    await b.reload();
    await expect(visible(b.getByLabel('1 j’aime', { exact: true }))).toBeVisible({ timeout: 20_000 });
    await expect(visible(b.getByLabel(/^Pas encore noté|^1 note/))).toBeVisible();
  });

  test('a failed heart is shown immediately, then rolled back with a French error', async () => {
    await a.route('**/rest/v1/rpc/vote_post', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom', code: 'XX000' }) });
    });
    await heartButton(a).click(); // removes the heart optimistically
    await expect(heartButton(a)).toHaveAccessibleName(/^Aimer\. 0 j’aime/);
    await expect(visible(a.getByText('Une erreur est survenue. Réessayez.'))).toBeVisible({ timeout: 10_000 });
    await expect(heartButton(a)).toHaveAccessibleName(/^Retirer mon j’aime\. 1 j’aime/);
    await shot(a, DIR, 'A-heart-rolled-back');
    await a.unroute('**/rest/v1/rpc/vote_post');
  });

  test('A answers a request in private with « Écrire » (no « Je peux aider » button), then publicly', async () => {
    await expect(a.getByRole('button', { name: /^Je peux aider/ })).toHaveCount(0);
    await visible(a.getByRole('button', { name: /^Écrire à .* en privé$/ })).click();
    await expect(a).toHaveURL(/\/chat\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await expect(visible(a.getByRole('textbox', { name: 'Message' }))).toBeVisible();
    await shot(a, DIR, 'A-private-help-chat');

    await a.goto(postUrl);
    await visible(a.getByRole('textbox', { name: 'Commentaire' })).fill(ANSWER);
    await visible(btn(a, 'Publier le commentaire')).click();
    // The body is rendered inline after the author's name (« Aminata … Essayez … »).
    await expect(visible(a.getByText(ANSWER))).toBeVisible();
  });

  test('B sees the genuine comment preview and vote count on its feed card', async () => {
    await b.goto('/');
    const card = visible(b.getByText(REQUEST, { exact: true }));
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.scrollIntoViewIfNeeded();
    await expect(visible(b.getByText(ANSWER))).toBeVisible();
    await expect(visible(b.getByLabel('1 j’aime', { exact: true }))).toBeVisible();
    await shot(b, DIR, 'B-feed-card-with-preview');
  });
});
