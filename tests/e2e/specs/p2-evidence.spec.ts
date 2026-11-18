/**
 * P2 before/after screenshots (owner request, 16 Nov). Not a regression test: run with
 * P2_PHASE=before on the code of `main`, then P2_PHASE=after on this branch.
 *   P2_PHASE=before pnpm exec playwright test p2-evidence
 * Files land in docs/evidence/p2/<phase>/<NN>-<name>-<width>.png
 */
import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { EVIDENCE, FIXTURE, newDevice, pickFile, signIn, WEB_URL } from './helpers';

function sql(q: string): string {
  try {
    return execSync(`docker exec supabase_db_jefeli psql -U postgres -tAc "${q}"`, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const PHASE = process.env.P2_PHASE;
const OUT = path.join(EVIDENCE, '..', 'p2', PHASE ?? 'none');
const WIDTHS = [390, 360] as const;

async function snap(page: Page, name: string, width: number) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`) });
}

test.describe('P2 evidence', () => {
  test.skip(!PHASE, 'set P2_PHASE=before|after');

  for (const width of WIDTHS) {
    test(`article, profile and web page at ${width}`, async ({ browser }) => {
      const { ctx, page } = await newDevice(browser, { width, height: 780 });
      await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
      await page.goto('/explore');
      const card = page.getByTestId('listing-card').first();
      await expect(card).toBeVisible();
      await card.click();
      await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/);
      const id = page.url().match(/\/p\/([0-9a-f-]{36})/)![1]!;
      await snap(page, '10-article', width);
      await page.goto('/u/awa_couture');
      await page.waitForTimeout(1500);
      await snap(page, '20-profile-visitor', width);
      const web = await ctx.newPage();
      await web.setViewportSize({ width, height: 780 });
      await web.goto(`${WEB_URL}/p/${id}`);
      await expect(web.getByTestId('web-make-offer').or(web.getByRole('link', { name: /Voir sur Jëfëli|Écrire au vendeur/ })).first()).toBeVisible();
      await snap(web, '30-web-article', width);
      await ctx.close();
    });
  }

  // New screens (no « before »: they did not exist). Studio steps, status with sticker, Reels, notification.
  for (const width of WIDTHS) {
    test(`studio, status, reels and notification at ${width}`, async ({ browser }) => {
      test.setTimeout(240_000);
      const { ctx, page } = await newDevice(browser, { width, height: 780 }, { camera: true, mic: true });
      await signIn(page, 'awa@demo.jefeli.test', 'Demo-jefeli-2026!');
      await page.getByRole('tab', { name: 'Publier' }).click();
      await expect(page.getByTestId('studio-composer')).toBeVisible();
      await page.getByTestId('studio-tool-camera').click();
      await expect(page.getByTestId('studio-capture')).toBeVisible();
      await snap(page, '40-studio-photo', width);
      for (let i = 0; i < 3; i++) {
        await page.getByTestId('studio-shutter').click();
        await page.waitForTimeout(500);
      }
      await snap(page, '41-studio-strip', width);
      for (const [mode, name] of [['Vidéo', '42-studio-video']] as const) {
        await page.getByRole('tab', { name: mode, exact: true }).click();
        await snap(page, name, width);
      }
      await page.getByRole('tab', { name: 'Photo', exact: true }).click();
      await page.getByTestId('studio-next').click();
      await snap(page, '45-composer-switch-on', width);
      await page.getByRole('switch', { name: 'Vendre ou troquer cet article' }).click();
      await snap(page, '46-composer-switch-off', width);
      await page.getByRole('switch', { name: 'Vendre ou troquer cet article' }).click();
      await page.getByTestId('studio-caption').fill('Ensemble wax brodé\nTaille M, très bon état.');
      await page.getByRole('textbox', { name: 'Prix', exact: true }).fill('32000');
      await page.getByRole('button', { name: 'Terminé', exact: true }).click();
      await page.getByRole('button', { name: /^Catégorie : / }).click();
      await page.getByRole('button', { name: 'Mode femme', exact: true }).click();
      await page.getByTestId('studio-dest-status').click();
      await snap(page, '47-composer-filled-destinations', width);
      await page.getByRole('button', { name: 'Revenir à la caméra' }).click();
      await ctx.close();

      // Buyer: a status with its sticker, the end card, Reels.
      const b = await newDevice(browser, { width, height: 780 });
      await signIn(b.page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
      await b.page.goto('/u/awa_couture');
      await b.page.getByRole('button', { name: 'Voir ses statuts' }).click();
      const sticker = b.page.getByTestId('product-sticker').last();
      for (let i = 0; i < 25 && !(await b.page.getByTestId('status-end-card').isVisible().catch(() => false)); i++) {
        await b.page.getByTestId('product-sticker').first().waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
        if (i === 1 && (await sticker.isVisible().catch(() => false))) await snap(b.page, '50-status-sticker-reactions', width);
        await b.page.getByRole('button', { name: 'Statut suivant' }).click({ position: { x: 150, y: 300 } }).catch(() => {});
        await b.page.waitForTimeout(300);
      }
      await snap(b.page, '51-status-end-card', width);
      await b.page.getByTestId('status-see-reels').click();
      await expect(b.page.getByTestId('reel').first()).toBeVisible({ timeout: 30_000 });
      await snap(b.page, '52-reels', width);
      await b.ctx.close();

      // « Le garder en Reel ? » — a notification as the hourly job writes it (a held, well-watched video status).
      const storyId = sql(`select id from stories where author_id=(select id from profiles where handle='awa_couture') and media_kind='video' and deleted_at is null order by created_at desc limit 1`);
      const awa = sql(`select id from profiles where handle='awa_couture'`);
      if (storyId && awa) {
        sql(`insert into notifications (recipient_id, type, entity_type, entity_id, data) values ('${awa}', 'reel_candidate', 'story', '${storyId}', jsonb_build_object('views', 132))`);
        const n = await newDevice(browser, { width, height: 780 });
        await signIn(n.page, 'awa@demo.jefeli.test', 'Demo-jefeli-2026!');
        await n.page.goto('/notifications');
        await expect(n.page.getByText(/Le garder en Reel/).first()).toBeVisible({ timeout: 20_000 });
        await snap(n.page, '53-notification-garder-en-reel', width);
        await n.ctx.close();
      }
    });
  }
});
