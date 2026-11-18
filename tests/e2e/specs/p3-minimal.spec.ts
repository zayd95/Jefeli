/**
 * P3 — minimalist actions and « coller depuis WhatsApp » (owner, 17 Nov), through the real UI at 390 px.
 *   MA-1 article page: one gold pill + one message icon; heart, share and « … » on the photo; the swap is a tab of the offer screen
 *   MA-2 Reels: three icons (like, message, more); share and save live behind « more »
 *   MA-3 Studio: pasting a WhatsApp announcement fills the article (price, pointures) and says so, with « Annuler »
 */
import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';

import { FIXTURE, newDevice, shot, signIn, studioWithFile } from './helpers';

const DIR = 'p3-minimal';
const PHONE = { width: 390, height: 844 };

function productId(title: string): string {
  return execSync(`docker exec supabase_db_jefeli psql -U postgres -tAc "select id from products where title='${title.replace(/'/g, "''")}' limit 1"`, { encoding: 'utf8' }).trim();
}

test.describe('P3 minimalist actions', () => {
  test('MA-1 article page: one pill + one icon below, heart/share/more on the photo, swap inside the offer', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, PHONE);
    await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
    await page.goto(`/p/${productId('Baskets blanches — pointure 42')}`);
    await expect(page.getByRole('button', { name: 'Faire une offre', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Envoyer un message au vendeur', exact: true })).toBeVisible();
    for (const name of ['Ajouter aux favoris', 'Partager l’article', 'Plus d’options']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    // No swap button of its own, no second share: the swap is a tab of the offer screen.
    await expect(page.getByRole('button', { name: 'Proposer un échange (troc)', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Partager sur WhatsApp' })).toHaveCount(0);
    await shot(page, DIR, 'article-minimal');

    await page.getByRole('button', { name: 'Faire une offre', exact: true }).click();
    const swap = page.getByRole('tab', { name: 'Proposer un échange (troc)', exact: true });
    await expect(swap).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Faire une offre en argent', exact: true })).toHaveAttribute('aria-selected', 'true');
    await swap.click();
    await expect(page.getByText('Que proposez-vous en échange ?')).toBeVisible();
    await shot(page, DIR, 'offer-swap-tab');
    await ctx.close();
  });

  test('MA-2 Reels: three icons, share and save behind « more »', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, PHONE);
    await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
    await page.goto('/reels');
    const reel = page.getByTestId('reel').first();
    const has = await reel.waitFor({ timeout: 30_000 }).then(() => true, () => false);
    test.skip(!has, 'no Reel on this database');
    await expect(reel.getByTestId('reel-like')).toBeVisible();
    await expect(reel.getByTestId('reel-message')).toBeVisible();
    await expect(reel.getByTestId('reel-more')).toBeVisible();
    await expect(page.getByTestId('reel-share')).toHaveCount(0);
    await shot(page, DIR, 'reel-three-icons');
    await reel.getByTestId('reel-more').click();
    await expect(page.getByTestId('reel-share')).toBeVisible();
    await expect(page.getByTestId('reel-save')).toBeVisible();
    await shot(page, DIR, 'reel-more-sheet');
    await ctx.close();
  });

  test('MA-3 Studio: a pasted WhatsApp announcement fills price and sizes, « Annuler » restores', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, PHONE);
    await signIn(page, 'awa@demo.jefeli.test', 'Demo-jefeli-2026!');
    await studioWithFile(page, FIXTURE('shoe.jpg'));
    const caption = page.getByTestId('studio-caption');
    await caption.fill('Dior b30 full White\n40-41-42-43-44-45\n*Prix 35.000f');
    const note = page.getByTestId('studio-paste-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText('prix 35 000 F');
    await expect(note).toContainText('pointures 40 à 45');
    await expect(caption).toHaveValue('Dior b30 full White\nPointures : 40 à 45.');
    await expect(page.getByRole('switch', { name: 'Vendre ou troquer cet article' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('studio-price')).toHaveValue(/35.?000/);
    await shot(page, DIR, 'paste-filled');

    await page.getByTestId('studio-paste-undo').click();
    await expect(note).toHaveCount(0);
    await expect(caption).toHaveValue('');
    await shot(page, DIR, 'paste-undone');

    // Ordinary typing and ordinary text never trigger it.
    await caption.fill('Bonjour à toutes et à tous, belle journée');
    await expect(page.getByTestId('studio-paste-note')).toHaveCount(0);
    await ctx.close();
  });
});
