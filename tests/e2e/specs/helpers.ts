import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

export const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
/** The app under test: Expo web dev server by default, or a production export / deployment. */
export const APP_URL = (process.env.APP_URL ?? 'http://localhost:8081').replace(/\/+$/, '');
export const ROOT = path.resolve(__dirname, '..', '..', '..');
export const EVIDENCE = path.join(ROOT, 'docs', 'evidence', 'e2e');
export const FIXTURE = (name: string) => path.join(__dirname, '..', 'fixtures', name);

export const DEVICES = {
  android360: { width: 360, height: 780 },
  iphone15: { width: 393, height: 852 },
  iphoneSE: { width: 375, height: 667 },
  iphone15ProMax: { width: 430, height: 932 },
  pixel7: { width: 412, height: 915 },
} as const;

export function runId(): string {
  return Math.random().toString(36).slice(2, 7);
}

export async function newDevice(
  browser: Browser,
  size: { width: number; height: number } = DEVICES.iphone15,
  opts: { mic?: boolean } = {},
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Africa/Dakar' });
  if (opts.mic) await ctx.grantPermissions(['microphone'], { origin: APP_URL });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept()); // confirm() used for destructive confirmations on web
  return { ctx, page };
}

/** Per evidence folder, so file names do not depend on which specs ran before. */
const shotIndex = new Map<string, number>();
export async function shot(page: Page, folder: string, name: string) {
  const dir = path.join(EVIDENCE, folder);
  fs.mkdirSync(dir, { recursive: true });
  const n = (shotIndex.get(folder) ?? 0) + 1;
  shotIndex.set(folder, n);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(dir, `${String(n).padStart(2, '0')}-${name}.png`) });
}

export const btn = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
export const field = (page: Page, name: string | RegExp) => page.getByRole('textbox', { name, exact: typeof name === 'string' });

/** Real sign-up + onboarding through the UI. */
export async function signUp(page: Page, opts: { name: string; email: string; handle: string; password: string; city?: string }) {
  await page.goto('/');
  await btn(page, 'Créer un compte').click();
  await field(page, 'Votre nom').fill(opts.name);
  await field(page, 'E-mail').fill(opts.email);
  await field(page, 'Mot de passe').fill(opts.password);
  await page.getByRole('checkbox', { name: 'J’ai 18 ans ou plus.' }).click();
  await page.getByRole('checkbox', { name: /J’accepte les conditions/ }).click();
  await btn(page, 'Créer mon compte').click();
  // One-screen onboarding (Lovable parity): name, suggested + editable handle, city, 18+.
  // No boutique questionnaire and no interests gate before the first feed.
  await expect(page.getByText('Bienvenue chez vous.')).toBeVisible();
  await field(page, 'Votre nom').fill(opts.name);
  // The handle is suggested from the name; tests still set a unique one explicitly.
  await field(page, 'Votre pseudo').fill(opts.handle);
  await expect(page.getByText(/^Disponible/)).toBeVisible();
  if (opts.city && opts.city !== 'Dakar') await btn(page, opts.city).click();
  await page.getByRole('checkbox', { name: 'Je confirme avoir 18 ans ou plus' }).click();
  await btn(page, 'Entrer dans Jëfëli').click();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await field(page, 'E-mail').fill(email);
  await field(page, 'Mot de passe').fill(password);
  await btn(page, 'Se connecter').click();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
}

/** Picks a file through the web image picker (expo-image-picker opens a file input). */
export async function pickFile(page: Page, trigger: () => Promise<void>, file: string) {
  const chooserPromise = page.waitForEvent('filechooser');
  await trigger();
  const chooser = await chooserPromise;
  await chooser.setFiles(file);
}

/**
 * Publishes an article through the W1.3 « vitrine »: the cover first, then the name and price
 * written on the window, how it is offered (Vendre / Wecci (troc) / Les deux), how the price is
 * shown (a pill), and the details sheet (catégorie, état…). If a draft is waiting, starts anew
 * after the explicit confirmation.
 */
const MODE_LABELS = { Vente: 'Vendre', 'Vente ou troc': 'Les deux', Troc: 'Wecci (troc)' } as const;

export async function publishListing(
  page: Page,
  opts: {
    file: string;
    title: string;
    mode?: keyof typeof MODE_LABELS;
    priceMode?: 'Prix affiché' | 'Prix sur demande' | 'À discuter';
    price?: string;
    category: string;
    condition: string;
    description?: string;
  },
) {
  await page.goto('/publish/listing');
  const add = page.getByRole('button', { name: 'Ajouter des photos ou une vidéo' });
  await expect(add.or(page.getByTestId('draft-choice'))).toBeVisible();
  if (await page.getByTestId('draft-choice').isVisible()) {
    await btn(page, 'Nouvel article').click();
    await btn(page, 'Supprimer et commencer').click();
  }
  await pickFile(page, () => add.click(), opts.file);
  await expect(page.getByText('APERÇU ACHETEUR').last()).toBeVisible();
  await field(page, 'Nom de l’article').fill(opts.title);
  if (opts.mode) await page.getByRole('radio', { name: MODE_LABELS[opts.mode], exact: true }).click();
  if (opts.priceMode) {
    await page.getByRole('button', { name: /^Mode de prix/ }).click();
    await page.getByRole('radio', { name: opts.priceMode, exact: true }).click();
  }
  if (opts.price) await field(page, /^(Prix|Valeur estimée)/).fill(opts.price);
  await page.getByRole('button', { name: /^Catégorie : / }).click();
  await btn(page, opts.category).click();
  await btn(page, opts.condition).click();
  if (opts.description) await field(page, 'Description (facultatif)').fill(opts.description);
  await btn(page, 'Terminé').click();
  await page.getByRole('button', { name: opts.mode === 'Troc' ? 'Proposer en troc' : 'Mettre en vente', exact: true }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/, { timeout: 60_000 });
}

/** Local Supabase mail catcher (Mailpit, `supabase start`); no e-mail leaves the machine. */
export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

/** The Supabase Auth link (…/auth/v1/verify?…) in the newest e-mail sent to `to`. */
export async function latestAuthLink(to: string, subject: RegExp, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const list = (await res.json()) as { messages?: Array<{ ID: string; Subject: string }> };
    const hit = list.messages?.find((m) => subject.test(m.Subject));
    if (hit) {
      const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${hit.ID}`)).json()) as { HTML?: string; Text?: string };
      const link = `${msg.HTML ?? ''} ${msg.Text ?? ''}`.match(/https?:\/\/[^"'\s<>]+\/auth\/v1\/verify\?[^"'\s<>]+/)?.[0];
      if (link) return link.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No e-mail matching ${subject} for ${to}`);
}
