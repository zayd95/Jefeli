import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

export const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
export const ROOT = path.resolve(__dirname, '..', '..', '..');
export const EVIDENCE = path.join(ROOT, 'docs', 'evidence', 'e2e');
export const FIXTURE = (name: string) => path.join(__dirname, '..', 'fixtures', name);

export const DEVICES = {
  iphone15: { width: 393, height: 852 },
  iphoneSE: { width: 375, height: 667 },
  iphone15ProMax: { width: 430, height: 932 },
  pixel7: { width: 412, height: 915 },
} as const;

export function runId(): string {
  return Math.random().toString(36).slice(2, 7);
}

export async function newDevice(browser: Browser, size: { width: number; height: number } = DEVICES.iphone15): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Africa/Dakar' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept()); // confirm() used for destructive confirmations on web
  return { ctx, page };
}

let shotIndex = 0;
export async function shot(page: Page, folder: string, name: string) {
  const dir = path.join(EVIDENCE, folder);
  fs.mkdirSync(dir, { recursive: true });
  shotIndex += 1;
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(dir, `${String(shotIndex).padStart(2, '0')}-${name}.png`) });
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
 * Publishes an article through the 3-step guided composer (L’essentiel → Détails → Remise).
 * `priceMode` defaults to « Prix affiché »; `price` is optional for the other modes.
 */
export async function publishListing(
  page: Page,
  opts: {
    file: string;
    title: string;
    mode?: 'Vente' | 'Vente ou troc' | 'Troc';
    priceMode?: 'Prix affiché' | 'Prix sur demande' | 'À discuter';
    price?: string;
    category: string;
    condition: string;
    description?: string;
  },
) {
  await page.goto('/publish/listing');
  await expect(page.getByText('Étape 1 sur 3', { exact: false }).last()).toBeVisible();
  await pickFile(page, () => btn(page, 'Ajouter depuis la galerie').click(), opts.file);
  await expect(page.getByText('Couverture', { exact: true }).last()).toBeVisible();
  await field(page, 'Titre').fill(opts.title);
  if (opts.mode) await page.getByRole('radio', { name: opts.mode, exact: true }).click();
  if (opts.priceMode) await page.getByRole('radio', { name: opts.priceMode, exact: true }).click();
  if (opts.price) await field(page, /^Prix/).fill(opts.price);
  await btn(page, 'Continuer').click();
  await expect(page.getByText('Étape 2 sur 3', { exact: false }).last()).toBeVisible();
  await btn(page, opts.category).click();
  await btn(page, opts.condition).click();
  if (opts.description) await field(page, 'Description (facultatif)').fill(opts.description);
  await btn(page, 'Continuer').click();
  await expect(page.getByText('Étape 3 sur 3', { exact: false }).last()).toBeVisible();
  await btn(page, 'Publier l’article').click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/, { timeout: 60_000 });
}
