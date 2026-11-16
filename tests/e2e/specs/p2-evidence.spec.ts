/**
 * P2 before/after screenshots (owner request, 16 Nov). Not a regression test: run with
 * P2_PHASE=before on the code of `main`, then P2_PHASE=after on this branch.
 *   P2_PHASE=before pnpm exec playwright test p2-evidence
 * Files land in docs/evidence/p2/<phase>/<NN>-<name>-<width>.png
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { EVIDENCE, newDevice, signIn, WEB_URL } from './helpers';

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
});
