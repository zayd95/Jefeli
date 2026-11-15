/**
 * W1.4 — phone sign-up and sign-in (+221) in the browser, against the real local auth server.
 *
 * Codes are generated and verified by Supabase Auth. The `send-sms` hook's local "sink"
 * provider posts each SMS to the small HTTP server below (like the local mail catcher used
 * for e-mails), so the test types the code a phone would have received. No verification is
 * simulated. Real delivery to Orange / Free / Expresso SIMs is an owner test (docs/PHONE_AUTH.md).
 *
 * Needs `supabase functions serve --env-file supabase/functions/.env.test` (hook + sink).
 */
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { expect, test, type Page } from '@playwright/test';

import { btn, DEVICES, field, newDevice, runId, shot, signUp } from './helpers';

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = (q: string) => execFileSync('psql', [DB_URL, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();

interface Sms {
  to: string;
  text: string;
}
const inbox: Sms[] = [];
let sink: Server;

function number(prefix = '77'): { national: string; e164: string; display: string } {
  const rest = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
  const national = `${prefix}${rest}`;
  return {
    national: `${prefix} ${rest.slice(0, 3)} ${rest.slice(3, 5)} ${rest.slice(5)}`,
    e164: `+221${national}`,
    display: `+221 ${prefix} ${rest.slice(0, 3)} ${rest.slice(3, 5)} ${rest.slice(5)}`,
  };
}

async function codeFor(e164: string, after: number): Promise<string> {
  await expect.poll(() => inbox.slice(after).some((m) => m.to === e164), { timeout: 15_000 }).toBe(true);
  const sms = [...inbox.slice(after)].reverse().find((m) => m.to === e164)!;
  return sms.text.match(/(\d{6})/)![1]!;
}

/** Lets the next code be requested now instead of after Supabase's 60 s (used where the wait is not the subject). */
function skipResendWait(e164: string) {
  sql(`update auth.users set confirmation_sent_at = now() - interval '2 minutes', recovery_sent_at = now() - interval '2 minutes', phone_change_sent_at = now() - interval '2 minutes' where phone = '${e164.slice(1)}'`);
}

const phoneInput = (page: Page) => page.getByTestId('phone-input');
const codeInput = (page: Page) => field(page, 'Code reçu par SMS');

async function requestCode(page: Page, national: string) {
  await phoneInput(page).fill(national);
  await btn(page, 'Recevoir le code par SMS').click();
  await expect(page.getByText(/^Code envoyé au \+221/)).toBeVisible();
}

async function finishOnboarding(page: Page, handle: string) {
  await expect(page.getByText('Bienvenue chez vous.')).toBeVisible();
  await field(page, 'Votre pseudo').fill(handle);
  await expect(page.getByText(/^Disponible/)).toBeVisible();
  await page.getByRole('checkbox', { name: 'Je confirme avoir 18 ans ou plus' }).click();
  await btn(page, 'Entrer dans Jëfëli').click();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  sink = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        inbox.push(JSON.parse(raw) as Sms);
      } catch {
        /* ignore */
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
    });
  });
  await new Promise<void>((resolve) => sink.listen(54399, '0.0.0.0', resolve));
  sql(`update public.feature_flags set enabled = true where key = 'phone_auth'`);
  // Every local browser reaches the auth server from the same Docker address.
  sql(`update private.sms_settings set per_ip_hour = 1000 where id`);
});

test.afterAll(async () => {
  sql(`update public.feature_flags set enabled = false where key = 'phone_auth'`);
  sql(`update private.sms_settings set per_ip_hour = 10, daily_budget = 300 where id`);
  await new Promise<void>((resolve) => sink.close(() => resolve()));
});

test('PH-01 sign-up by phone: precise number errors, wrong code, real code, onboarding', async ({ browser }) => {
  const { ctx, page } = await newDevice(browser);
  const id = runId();
  const n = number('77');
  await page.goto('/');
  await expect(page.getByText('Avec votre e-mail ou votre numéro de mobile (+221).')).toBeVisible();
  await btn(page, 'Créer un compte').click();
  await field(page, 'Votre nom').fill(`Awa Tel ${id}`);
  await page.getByRole('tab', { name: 'Téléphone' }).click();
  await expect(page.getByRole('tab', { name: 'Téléphone' })).toHaveAttribute('aria-selected', 'true');

  await phoneInput(page).fill('33 821 00 00');
  await expect(page.getByText(/Ce numéro est un fixe/)).toBeVisible();
  await phoneInput(page).fill('+33 6 12 34 56 78');
  await expect(page.getByText(/seuls les numéros du Sénégal \(\+221\)/)).toBeVisible();
  await phoneInput(page).fill(n.national);
  // Consents first, like the e-mail sign-up.
  await expect(btn(page, 'Recevoir le code par SMS')).toBeDisabled();
  await page.getByRole('checkbox', { name: 'J’ai 18 ans ou plus.' }).click();
  await page.getByRole('checkbox', { name: /J’accepte les conditions/ }).click();
  await shot(page, 'phone', 'V-signup-phone-number');

  const before = inbox.length;
  await btn(page, 'Recevoir le code par SMS').click();
  await expect(page.getByText(`Code envoyé au ${n.display}`)).toBeVisible();
  await expect(page.getByTestId('otp-countdown')).toContainText(/Renvoyer le code dans 0:[0-5]\d/);
  const code = await codeFor(n.e164, before);
  expect(inbox.at(-1)!.text).toBe(`Jëfëli : votre code est ${code}. Ne le partagez avec personne.`);

  await codeInput(page).fill(code === '000000' ? '111111' : '000000');
  await expect(page.getByTestId('phone-error')).toHaveText('Code incorrect ou expiré. Vérifiez-le ou demandez un nouveau code.');
  await shot(page, 'phone', 'V-wrong-code');
  await codeInput(page).fill(code);
  await expect(page.getByText('Bienvenue chez vous.')).toBeVisible();
  await expect(field(page, 'Votre nom')).toHaveValue(`Awa Tel ${id}`);
  await finishOnboarding(page, `awa.tel.${id}`);
  await shot(page, 'phone', 'V-home-after-phone-signup');

  // Phone-only account: no e-mail, profile handle from onboarding.
  expect(sql(`select coalesce(email, '') || '|' || phone from auth.users where phone = '${n.e164.slice(1)}'`)).toBe(`|${n.e164.slice(1)}`);
  await ctx.close();

  // PH-01b: sign in on another device with the same number (after a real 60 s resend wait elsewhere).
  skipResendWait(n.e164);
  const second = await newDevice(browser, DEVICES.pixel7);
  await second.page.goto('/sign-in');
  await second.page.getByRole('tab', { name: 'Téléphone' }).click();
  const before2 = inbox.length;
  await requestCode(second.page, n.national);
  await codeInput(second.page).fill(await codeFor(n.e164, before2));
  await expect(second.page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  await second.page.goto(`/u/awa.tel.${id}`);
  await expect(second.page.getByText(`Awa Tel ${id}`).first()).toBeVisible();
  await second.ctx.close();
});

test('PH-02 resend after the 60 s countdown, and the code request survives a reload', async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  const { ctx, page } = await newDevice(browser);
  const n = number('76');
  await page.goto('/sign-up?method=phone');
  await field(page, 'Votre nom').fill('Moussa Renvoi');
  await phoneInput(page).fill(n.national);
  await page.getByRole('checkbox', { name: 'J’ai 18 ans ou plus.' }).click();
  await page.getByRole('checkbox', { name: /J’accepte les conditions/ }).click();
  const first = inbox.length;
  await btn(page, 'Recevoir le code par SMS').click();
  await expect(page.getByText(`Code envoyé au ${n.display}`)).toBeVisible();
  const oldCode = await codeFor(n.e164, first);

  // Reload: still waiting for the same number, countdown continues.
  await page.reload();
  await expect(page.getByText(`Code envoyé au ${n.display}`)).toBeVisible();
  await expect(page.getByTestId('otp-countdown')).toBeVisible();
  await shot(page, 'phone', 'V-code-step-after-reload');

  await expect(btn(page, 'Renvoyer le code')).toBeVisible({ timeout: 75_000 });
  const second = inbox.length;
  await btn(page, 'Renvoyer le code').click();
  const newCode = await codeFor(n.e164, second);
  await expect(page.getByTestId('otp-countdown')).toBeVisible();
  if (newCode !== oldCode) {
    await codeInput(page).fill(oldCode);
    await expect(page.getByTestId('phone-error')).toBeVisible(); // the previous code no longer works
  }
  await codeInput(page).fill(newCode);
  await expect(page.getByText('Bienvenue chez vous.')).toBeVisible();
  await ctx.close();
});

test('PH-03 sign-in with an unknown number offers to create the account with it', async ({ browser }) => {
  const { ctx, page } = await newDevice(browser, DEVICES.android360);
  const n = number('70');
  await page.goto('/sign-in');
  await page.getByRole('tab', { name: 'Téléphone' }).click();
  await phoneInput(page).fill(n.national);
  await btn(page, 'Recevoir le code par SMS').click();
  await expect(page.getByTestId('phone-error')).toHaveText('Aucun compte n’utilise encore ce numéro.');
  expect(inbox.some((m) => m.to === n.e164)).toBe(false);
  await shot(page, 'phone', 'V-unknown-number-360');
  await btn(page, 'Créer un compte avec ce numéro').click();
  await expect(page.getByRole('tab', { name: 'Téléphone' })).toHaveAttribute('aria-selected', 'true');
  await expect(phoneInput(page)).toHaveValue(n.e164);
  await ctx.close();
});

test('PH-04 network failure and server refusals keep the form and say what happened', async ({ browser }) => {
  const { ctx, page } = await newDevice(browser);
  const n = number('78');
  await page.goto('/sign-up?method=phone');
  await field(page, 'Votre nom').fill('Fatou Réseau');
  await phoneInput(page).fill(n.national);
  await page.getByRole('checkbox', { name: 'J’ai 18 ans ou plus.' }).click();
  await page.getByRole('checkbox', { name: /J’accepte les conditions/ }).click();

  await page.route('**/auth/v1/otp**', (route) => route.abort('internetdisconnected'));
  await btn(page, 'Recevoir le code par SMS').click();
  await expect(page.getByTestId('phone-error')).toHaveText('Connexion impossible. Vérifiez votre réseau et réessayez.');
  await expect(phoneInput(page)).toHaveValue(n.national);
  await shot(page, 'phone', 'V-network-failure');
  await page.unroute('**/auth/v1/otp**');

  // The server-side budget refuses: the member reads why (message from the send-sms hook).
  sql(`update private.sms_settings set daily_budget = 0 where id`);
  try {
    await btn(page, 'Recevoir le code par SMS').click();
    await expect(page.getByTestId('phone-error')).toHaveText('Les SMS de connexion sont suspendus pour aujourd’hui. Utilisez votre e-mail ou réessayez demain.');
  } finally {
    sql(`update private.sms_settings set daily_budget = 300 where id`);
  }

  const before = inbox.length;
  await btn(page, 'Recevoir le code par SMS').click();
  await codeInput(page).fill(await codeFor(n.e164, before));
  await expect(page.getByText('Bienvenue chez vous.')).toBeVisible();
  await ctx.close();
});

test('PH-05 add a verified number to an e-mail account, then sign in with it (same account)', async ({ browser }) => {
  const { ctx, page } = await newDevice(browser);
  const id = runId();
  const handle = `mail.tel.${id}`;
  await signUp(page, { name: `Mail Tel ${id}`, email: `w14-${id}@e2e.jefeli.test`, handle, password: `Pw-${id}-secure` });
  await page.goto('/settings');
  await btn(page, 'E-mail et numéro de mobile').click();
  await expect(page.getByTestId('settings-phone-value')).toHaveText('Aucun numéro');
  await btn(page, 'Ajouter un numéro de mobile').click();
  const n = number('75');
  await phoneInput(page).fill(n.national);
  const before = inbox.length;
  await btn(page, 'Envoyer le code à ce numéro').click();
  await expect(page.getByText(`Code envoyé au ${n.display}`)).toBeVisible();
  await codeInput(page).fill(await codeFor(n.e164, before));
  await expect(page.getByText('Numéro vérifié : vous pouvez maintenant vous connecter avec lui.')).toBeVisible();
  await expect(page.getByTestId('settings-phone-value')).toHaveText(n.display);
  await shot(page, 'phone', 'V-settings-number-added');
  expect(sql(`select count(*) from auth.users where phone = '${n.e164.slice(1)}'`)).toBe('1');
  expect(sql(`select count(*) from public.profiles p join auth.users u on u.id = p.id where u.email = 'w14-${id}@e2e.jefeli.test'`)).toBe('1');
  await ctx.close();

  skipResendWait(n.e164);
  const other = await newDevice(browser);
  await other.page.goto('/sign-in?method=phone');
  const again = inbox.length;
  await requestCode(other.page, n.national);
  await codeInput(other.page).fill(await codeFor(n.e164, again));
  await expect(other.page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  await other.page.goto('/settings/phone');
  await expect(other.page.getByText(`w14-${id}@e2e.jefeli.test`)).toBeVisible();
  await other.ctx.close();
});

test('PH-06 a number already used by another account is refused', async ({ browser }) => {
  const taken = number('77');
  // An existing phone account (through the real API flow).
  const { ctx: c1, page: p1 } = await newDevice(browser);
  await p1.goto('/sign-up?method=phone');
  await field(p1, 'Votre nom').fill('Déjà Pris');
  await phoneInput(p1).fill(taken.national);
  await p1.getByRole('checkbox', { name: 'J’ai 18 ans ou plus.' }).click();
  await p1.getByRole('checkbox', { name: /J’accepte les conditions/ }).click();
  const before = inbox.length;
  await btn(p1, 'Recevoir le code par SMS').click();
  await codeInput(p1).fill(await codeFor(taken.e164, before));
  await expect(p1.getByText('Bienvenue chez vous.')).toBeVisible();
  await c1.close();

  const { ctx, page } = await newDevice(browser);
  const id = runId();
  await signUp(page, { name: `Autre ${id}`, email: `w14-other-${id}@e2e.jefeli.test`, handle: `autre.${id}`, password: `Pw-${id}-secure` });
  await page.goto('/settings/phone');
  await btn(page, 'Ajouter un numéro de mobile').click();
  await phoneInput(page).fill(taken.national);
  await btn(page, 'Envoyer le code à ce numéro').click();
  await expect(page.getByTestId('phone-error')).toHaveText('Ce numéro est déjà utilisé par un autre compte Jëfëli.');
  await shot(page, 'phone', 'V-number-already-used');
  await ctx.close();
});
