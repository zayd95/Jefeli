/**
 * P1: sign-up on a project that requires e-mail confirmation (as a hosted pilot project may),
 * with a fresh address and the local mail catcher. Skipped on the default local config
 * (`enable_confirmations = false`); run it with confirmations on, see docs/PILOT_TEST_PLAN.md.
 * Browser render of the React Native app (Expo web build), not a device.
 */
import { expect, test } from '@playwright/test';

import { APP_URL, btn, field, latestAuthLink, newDevice, runId, shot } from './helpers';

const RUN = runId();
const PASSWORD = 'Test-jefeli-2026!';
const EMAIL = `conf-${RUN}@e2e.jefeli.test`;
const DIR = 'email-confirmation';

test.skip(process.env.E2E_EMAIL_CONFIRMATIONS !== '1', 'needs [auth.email] enable_confirmations = true');

test('a new member confirms their e-mail from the link and lands in onboarding', async ({ browser }) => {
  const { ctx, page } = await newDevice(browser);
  await page.goto('/');
  await btn(page, 'Créer un compte').click();
  await field(page, 'Votre nom').fill(`Fatou Conf ${RUN}`);
  await field(page, 'E-mail').fill(EMAIL);
  await field(page, 'Mot de passe').fill(PASSWORD);
  await page.getByRole('checkbox', { name: 'J’ai 18 ans ou plus.' }).click();
  await page.getByRole('checkbox', { name: /J’accepte les conditions/ }).click();
  await btn(page, 'Créer mon compte').click();
  await expect(page.getByText('Vérifiez votre e-mail', { exact: true })).toBeVisible();
  await shot(page, DIR, 'check-your-email');

  // Before confirming, signing in explains why it fails.
  await btn(page, 'J’ai confirmé, me connecter').click();
  await field(page, 'E-mail').fill(EMAIL);
  await field(page, 'Mot de passe').fill(PASSWORD);
  await btn(page, 'Se connecter').click();
  await expect(page.getByText('Confirmez votre e-mail avant de vous connecter.')).toBeVisible();

  const link = await latestAuthLink(EMAIL, /confirm/i);
  expect(new URL(link).searchParams.get('redirect_to')).toBe(`${APP_URL}/sign-in`);
  await page.goto(link);
  await expect(page.getByText('Bienvenue chez vous.')).toBeVisible({ timeout: 20_000 });
  await shot(page, DIR, 'confirmed-onboarding');
  await ctx.close();

  // On another phone the confirmed account signs in with its password (onboarding next).
  const other = await newDevice(browser);
  await other.page.goto('/sign-in');
  await field(other.page, 'E-mail').fill(EMAIL);
  await field(other.page, 'Mot de passe').fill(PASSWORD);
  await btn(other.page, 'Se connecter').click();
  await expect(other.page.getByText('Bienvenue chez vous.')).toBeVisible({ timeout: 20_000 });
  await other.ctx.close();
});
