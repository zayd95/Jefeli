/**
 * P4 — compose-first Studio (owner, 17 Nov): « + » opens a text box with a toolbar, like X, adapted to
 * a social commerce app; photos and a video can go together; the Wecci modes and the offer are smarter.
 *   CP-1 the composer is the first screen: text box, audience, toolbar, one gold button
 *   CP-2 a photo and a video in the same publication (the gallery brings both)
 *   CP-3 the article switch: price inline, four Wecci modes in one row
 *   CP-4 offer: quick amounts under the field
 */
import { expect, test } from '@playwright/test';
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { FIXTURE, goldFills, newDevice, pickFile, runId, shot, signIn } from './helpers';

const RUN = runId();
const DIR = 'p4-compose';
const PHONE = { width: 390, height: 844 };
const SELLER = ['awa@demo.jefeli.test', 'Demo-jefeli-2026!'] as const;

function psql(q: string): string {
  return execSync(`docker exec supabase_db_jefeli psql -U postgres -tAc "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

test.describe('P4 compose-first Studio', () => {
  test('CP-1 « + » opens the text box with the toolbar; « Publier » is the one gold button', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, PHONE);
    await signIn(page, ...SELLER);
    await page.getByRole('tab', { name: 'Publier' }).click();
    const composer = page.getByTestId('studio-composer');
    await expect(composer).toBeVisible();
    await expect(page.getByTestId('studio-caption')).toBeFocused();
    await expect(page.getByTestId('studio-caption')).toHaveAttribute('placeholder', /Quoi de neuf/);
    for (const id of ['studio-tool-gallery', 'studio-tool-camera', 'studio-tool-voice', 'studio-tool-sell']) await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId('studio-feed-audience')).toContainText('Tout le monde');
    for (const name of ['Je cherche…', 'Qui a… ?', 'Recommandez-moi…']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    expect((await goldFills(page)).map((h) => h.text)).toEqual(['Publier']);
    await shot(page, DIR, 'compose-first');

    // Nothing to publish yet: the button waits for content.
    await expect(page.getByTestId('studio-publish')).toBeDisabled();
    await page.getByTestId('studio-caption').fill('Bonjour tout le monde');
    await expect(page.getByTestId('studio-publish')).toBeEnabled();
    await ctx.close();
  });

  test('CP-2 a photo and a video go in the same publication', async ({ browser }) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p4-'));
    const clip = path.join(dir, 'clip.webm');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=320x240:rate=15', '-c:v', 'libvpx', '-b:v', '200k', clip]);
    const { ctx, page } = await newDevice(browser, PHONE);
    await signIn(page, ...SELLER);
    await page.getByRole('tab', { name: 'Publier' }).click();
    await expect(page.getByTestId('studio-composer')).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('studio-tool-gallery').click();
    await (await chooser).setFiles([FIXTURE('bag.jpg'), clip]);
    await expect(page.getByTestId('studio-thumb-image')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.getByTestId('studio-thumb-video')).toHaveCount(1);
    // The article switch is on for a Boutique account: turn it off, this is a plain publication.
    const sell = page.getByRole('switch', { name: 'Vendre ou troquer cet article' });
    if ((await sell.getAttribute('aria-checked')) === 'true') await sell.click();
    await page.getByTestId('studio-caption').fill(`Photo et vidéo ${RUN}`);
    await expect(page.getByTestId('studio-dest-reel')).toHaveAttribute('aria-checked', 'true'); // a video: Reel by default
    await shot(page, DIR, 'photo-and-video');
    await page.getByTestId('studio-publish').click();
    await expect(page).toHaveURL(/\/(post|reels)/, { timeout: 90_000 });
    await expect
      .poll(() => psql(`select string_agg(m.kind, ',' order by m.position) from post_media m join posts p on p.id = m.post_id where p.body = 'Photo et vidéo ${RUN}'`), { timeout: 30_000 })
      .toBe('image,video');
    await ctx.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('CP-4 offer: quick amounts under the field; the swap picker has no second gold button', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, PHONE);
    await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
    const [id, ask] = psql("select id || '|' || price_xof from products where title = 'Baskets blanches — pointure 42' and status = 'active' order by created_at limit 1").split('|') as [string, string];
    const price = Number(ask);
    const step = price >= 10_000 ? 500 : price >= 2_000 ? 100 : 50;
    const digits = async () => (await page.getByRole('textbox', { name: 'Votre offre' }).inputValue()).replace(/\D/g, '');
    await page.goto(`/offer/${id}?kind=price`);
    await expect(page.getByTestId('offer-quick-ask')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('offer-quick-m15').click();
    await expect.poll(digits).toBe(String(Math.round((price * 0.85) / step) * step));
    await expect(page.getByText(/% sous le prix affiché\./)).toBeVisible();
    await page.getByTestId('offer-quick-ask').click();
    await expect.poll(digits).toBe(String(price));
    await expect(page.getByText(/Au prix affiché/)).toBeVisible();
    await shot(page, DIR, 'offer-quick-amounts');

    // Swap: a member with no article sees one outline action, not two gold buttons.
    await page.goto(`/offer/${id}?kind=barter`);
    const empty = page.getByText('Aucun article à proposer');
    if (await empty.isVisible({ timeout: 15_000 }).catch(() => false)) {
      expect((await goldFills(page)).map((h) => h.text)).toEqual(['Envoyer la proposition']);
    }
    await shot(page, DIR, 'offer-swap');
    await ctx.close();
  });

  test('CP-3 the article card: four Wecci modes in one row, the price typed inline', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, PHONE);
    await signIn(page, ...SELLER);
    await page.getByRole('tab', { name: 'Publier' }).click();
    await pickFile(page, () => page.getByTestId('studio-tool-gallery').click(), FIXTURE('shoe.jpg'));
    await expect(page.getByTestId('studio-thumb-image')).toHaveCount(1);
    await expect(page.getByRole('switch', { name: 'Vendre ou troquer cet article' })).toHaveAttribute('aria-checked', 'true');
    for (const name of ['Vendre', 'Troquer', 'Vendre ou troquer', 'Donner']) await expect(page.getByRole('radio', { name, exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Vendre', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('studio-price').fill('15000');
    await expect(page.getByTestId('studio-price')).toHaveValue(/15.?000/);
    await page.getByRole('radio', { name: 'Vendre ou troquer', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Vendre ou troquer', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Vendre', exact: true })).toHaveAttribute('aria-checked', 'false');
    await shot(page, DIR, 'article-card');
    await page.getByRole('radio', { name: 'Donner', exact: true }).click();
    await expect(page.getByTestId('studio-price')).toHaveCount(0); // a gift has no price
    await expect(page.getByText(/Gratuit : vous offrez/)).toBeVisible();
    await shot(page, DIR, 'article-card-donner');
    await ctx.close();
  });
});
