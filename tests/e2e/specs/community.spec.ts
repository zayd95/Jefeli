/**
 * Feed engagement pass, through the real UI with two fresh accounts on a phone-sized viewport:
 * B asks the community (« Je cherche »), A votes (up, switch to down, persistence), answers in
 * private and in public, B sees the comment preview on its feed card, and a failed vote rolls
 * back. Downvotes never show up for the author.
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
const upButton = (p: Page) => visible(p.getByRole('button', { name: /^(Voter pour|Retirer mon vote pour)/ }));
const downButton = (p: Page) => visible(p.getByRole('button', { name: /^(Voter contre|Retirer mon vote contre)/ }));

test.describe.serial('Community: intents, votes, comments', () => {
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
    // The dock's Plus (and /publish) opens the Publication composer directly, no hub.
    await b.goto('/publish');
    await expect(b).toHaveURL(/\/publish\/post$/);
    await expect(b.getByRole('tab', { name: 'Publication' }).last()).toHaveAttribute('aria-selected', 'true');
    await expect(b.getByRole('radio', { name: 'Je partage' })).toHaveAttribute('aria-checked', 'true');
    await b.getByRole('radio', { name: 'Je cherche' }).click();
    await expect(b.getByRole('radio', { name: 'Je cherche' })).toHaveAttribute('aria-checked', 'true');
    await shot(b, DIR, 'B-composer-je-cherche');
    await b.getByRole('textbox', { name: 'Texte' }).fill(REQUEST);
    await btn(b, 'Publier').click();
    await expect(b).toHaveURL(/\/post\/[0-9a-f-]{36}/, { timeout: 30_000 });
    postUrl = new URL(b.url()).pathname;
    await expect(visible(b.getByLabel('Type de publication : Je cherche'))).toBeVisible();
    // Authors see their positive count but cannot vote on their own publication.
    await expect(visible(b.getByLabel('0 vote pour', { exact: true }))).toBeVisible();
    await expect(b.getByRole('button', { name: /^Voter pour/ }).filter({ visible: true })).toHaveCount(0);
    await shot(b, DIR, 'B-request-published');
  });

  test('A votes for it, switches to a private downvote, and both persist', async () => {
    await a.goto(postUrl);
    await expect(visible(a.getByText(REQUEST, { exact: true }))).toBeVisible();
    await upButton(a).click();
    await expect(upButton(a)).toHaveAccessibleName(/^Retirer mon vote pour\. 1 vote pour/);
    await a.reload();
    await expect(upButton(a)).toHaveAccessibleName(/^Retirer mon vote pour\. 1 vote pour/, { timeout: 20_000 });
    await shot(a, DIR, 'A-upvoted');

    await downButton(a).click();
    await expect(downButton(a)).toHaveAccessibleName('Retirer mon vote contre');
    await expect(upButton(a)).toHaveAccessibleName(/^Voter pour\. 0 vote pour/);
    await a.reload();
    await expect(downButton(a)).toHaveAccessibleName('Retirer mon vote contre', { timeout: 20_000 });
    await shot(a, DIR, 'A-downvoted-private');

    // The author never sees negative feedback: the public count simply stays at 0.
    await b.reload();
    await expect(visible(b.getByLabel('0 vote pour', { exact: true }))).toBeVisible({ timeout: 20_000 });

    // Back to a positive vote for the rest of the journey.
    await upButton(a).click();
    await expect(upButton(a)).toHaveAccessibleName(/^Retirer mon vote pour\. 1 vote pour/);
  });

  test('a failed vote is shown immediately, then rolled back with a French error', async () => {
    await a.route('**/rest/v1/rpc/vote_post', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom', code: 'XX000' }) });
    });
    await upButton(a).click(); // removes the vote optimistically
    await expect(upButton(a)).toHaveAccessibleName(/^Voter pour\. 0 vote pour/);
    await expect(visible(a.getByText('Une erreur est survenue. Réessayez.'))).toBeVisible({ timeout: 10_000 });
    await expect(upButton(a)).toHaveAccessibleName(/^Retirer mon vote pour\. 1 vote pour/);
    await shot(a, DIR, 'A-vote-rolled-back');
    await a.unroute('**/rest/v1/rpc/vote_post');
  });

  test('A offers help in private, then answers publicly', async () => {
    await visible(a.getByRole('button', { name: /^Je peux aider/ })).click();
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
    await expect(visible(b.getByLabel('1 vote pour', { exact: true }))).toBeVisible();
    await shot(b, DIR, 'B-feed-card-with-preview');
  });
});
