/**
 * Visual QA tour: renders the key screens at three phone sizes with the DEMO seed
 * (`node scripts/seed-demo.mjs`) and saves screenshots to docs/evidence/e2e/screens/.
 * These are browser renders of the Expo web build — not physical-device captures.
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { DEVICES, EVIDENCE, newDevice, signIn, WEB_URL } from './helpers';

const PASSWORD = 'Demo-jefeli-2026!';
const SIZES = { 'iphone-se': DEVICES.iphoneSE, 'iphone-15-pro-max': DEVICES.iphone15ProMax, 'pixel-7': DEVICES.pixel7 } as const;

async function capture(page: Page, device: string, name: string) {
  const dir = path.join(EVIDENCE, 'screens', device);
  fs.mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

for (const [device, size] of Object.entries(SIZES)) {
  test(`screens · ${device}`, async ({ browser }) => {
    const { ctx, page } = await newDevice(browser, size);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Créer un compte' })).toBeVisible();
    await capture(page, device, '01-welcome');

    await signIn(page, 'fatou@demo.jefeli.test', PASSWORD);
    await expect(page.getByText('Awa Ndiaye', { exact: true }).first()).toBeVisible();
    await capture(page, device, '02-home-pour-toi');

    await page.getByRole('button', { name: 'Occasions', exact: true }).click();
    await capture(page, device, '03-home-occasions');

    await page.goto('/explore');
    await expect(page.getByRole('button', { name: 'Toutes les catégories', exact: true })).toHaveAttribute('aria-selected', 'true');
    await capture(page, device, '04-explore');

    await page.goto('/u/awa_couture');
    await expect(page.getByText('Sa boutique', { exact: true })).toBeVisible();
    await capture(page, device, '05-profile-boutique');
    await page.getByRole('tab', { name: 'Boutique' }).click();
    await capture(page, device, '06-profile-boutique-tab');

    await page.goto('/u/baolmode');
    await page.getByRole('button', { name: /Baskets blanches/ }).first().click();
    await expect(page.getByText('Très bon état', { exact: true }).last()).toBeVisible();
    await capture(page, device, '07-product');

    await page.goto('/messages');
    await page.getByRole('button', { name: /Conversation avec BaolMode/ }).click();
    await expect(page.getByText('PROPOSITION DE TROC', { exact: true }).last()).toBeVisible();
    await capture(page, device, '08-chat-barter');

    await page.goto('/');
    await page.getByRole('button', { name: 'Voir le statut de Awa Ndiaye' }).click();
    await expect(page.getByText('Arrivage du jour', { exact: true }).last()).toBeVisible();
    await capture(page, device, '09-status-viewer');

    await page.goto('/publish');
    await expect(page.getByRole('button', { name: /^Live\./ })).toHaveAttribute('aria-disabled', 'true');
    await capture(page, device, '10-publish-live-disabled');

    await page.goto('/publish/listing');
    await capture(page, device, '11-listing-composer');

    await page.goto('/notifications');
    await capture(page, device, '12-notifications');

    await page.goto('/profile');
    await capture(page, device, '13-own-profile');

    await page.goto('/settings');
    await capture(page, device, '14-settings');
    await ctx.close();

    // Seller side: incoming barter proposal with actions.
    const seller = await newDevice(browser, size);
    await signIn(seller.page, 'baol@demo.jefeli.test', PASSWORD);
    await seller.page.goto('/messages');
    await seller.page.getByRole('button', { name: /Conversation avec Fatou Sarr/ }).click();
    await expect(seller.page.getByRole('button', { name: 'Accepter' }).first()).toBeVisible();
    await capture(seller.page, device, '15-seller-barter-actions');
    await seller.ctx.close();

    // Public web share pages (no login), as seen from WhatsApp on a phone.
    const visitor = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'fr-FR' });
    const v = await visitor.newPage();
    await v.goto(`${WEB_URL}/awa_couture`);
    await expect(v.getByText('Awa Ndiaye').first()).toBeVisible();
    await capture(v, device, '16-web-public-profile');
    await visitor.close();
  });
}
