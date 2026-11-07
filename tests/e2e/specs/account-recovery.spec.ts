/**
 * P1: a returning pilot member who forgot their password gets back in from the e-mail link
 * (Mailpit, local Supabase Auth), with a fresh account. Before the fix the link opened
 * « Unmatched Route » and the recovery session was never used (docs/evidence/p1/password-recovery).
 * Browser render of the React Native app (Expo web build), not a device: on a phone the same route
 * is opened by the jefeli:// (or Expo Go exp://) deep link.
 */
import { expect, test } from '@playwright/test';

import { btn, field, latestAuthLink, newDevice, runId, shot, signIn, signUp } from './helpers';

const RUN = runId();
const OLD = 'Test-jefeli-2026!';
const NEW = 'Nouveau-jefeli-2026!';
const MEMBER = { name: `Awa Retour ${RUN}`, email: `rec-${RUN}@e2e.jefeli.test`, handle: `awa_retour_${RUN}`, password: OLD };
const DIR = 'account-recovery';

test.describe.serial('P1 account recovery: forgotten password, from the e-mail link', () => {
  let link = '';

  test.beforeAll(async ({ browser }) => {
    const { ctx, page } = await newDevice(browser);
    await signUp(page, MEMBER);
    await ctx.close();
  });

  test('the member asks for a link, opens it, chooses a new password and is signed in', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser);
    await page.goto('/sign-in');
    await btn(page, 'Mot de passe oublié ?').click();
    await field(page, 'E-mail').fill(MEMBER.email);
    await btn(page, 'Envoyer le lien').click();
    await expect(page.getByText(`Si un compte existe pour ${MEMBER.email}`, { exact: false })).toBeVisible();

    link = await latestAuthLink(MEMBER.email, /reset your password/i);
    // The link brings the member back to this app's own reset screen (not the old jefeli:// on the web).
    expect(new URL(link).searchParams.get('redirect_to')).toBe('http://localhost:8081/reset-password');
    await page.goto(link);
    await expect(page.getByRole('textbox', { name: 'Nouveau mot de passe' })).toBeVisible({ timeout: 20_000 });
    await shot(page, DIR, 'new-password-form');

    // Re-typing the old password is refused with a French message, not a generic error.
    await field(page, 'Nouveau mot de passe').fill(OLD);
    await btn(page, 'Enregistrer').click();
    await expect(page.getByText('Choisissez un mot de passe différent de l’ancien.')).toBeVisible();

    await field(page, 'Nouveau mot de passe').fill(NEW);
    await btn(page, 'Enregistrer').click();
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible({ timeout: 20_000 });
    await shot(page, DIR, 'signed-in-after-reset');
    await ctx.close();
  });

  test('the new password works on another phone and the old one no longer does', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser);
    await page.goto('/sign-in');
    await field(page, 'E-mail').fill(MEMBER.email);
    await field(page, 'Mot de passe').fill(OLD);
    await btn(page, 'Se connecter').click();
    await expect(page.getByText('E-mail ou mot de passe incorrect.')).toBeVisible();
    await signIn(page, MEMBER.email, NEW);

    // Signed in, but not from a recovery link: no password form here.
    await page.goto('/reset-password');
    await expect(page.getByText('Lien expiré', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('textbox', { name: 'Nouveau mot de passe' })).toHaveCount(0);
    await btn(page, 'Continuer').click();
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
    await ctx.close();
  });

  test('a link that was already used says so and offers a new one', async ({ browser }) => {
    const { ctx, page } = await newDevice(browser);
    await page.goto(link);
    await expect(page.getByText('Lien expiré', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('textbox', { name: 'Nouveau mot de passe' })).toHaveCount(0);
    await shot(page, DIR, 'used-link');
    await btn(page, 'Demander un nouveau lien').click();
    await expect(page.getByRole('button', { name: 'Envoyer le lien' })).toBeVisible();
    await ctx.close();
  });
});
