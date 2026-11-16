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
  opts: { mic?: boolean; camera?: boolean } = {},
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Africa/Dakar' });
  if (opts.mic || opts.camera) await ctx.grantPermissions([...(opts.mic ? (['microphone'] as const) : []), ...(opts.camera ? (['camera', 'microphone'] as const) : [])], { origin: APP_URL });
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

/**
 * Signed in and on the app: the header bell on phones, the sidebar link on desktop web (W1.4,
 * ≥ 768 px), where Accueil has no header bell.
 */
export const homeReady = (page: Page) =>
  page.getByRole('button', { name: 'Notifications', exact: true }).or(page.getByRole('link', { name: /^Notifications/ })).first();

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
  await expect(homeReady(page)).toBeVisible();
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await field(page, 'E-mail').fill(email);
  await field(page, 'Mot de passe').fill(password);
  await btn(page, 'Se connecter').click();
  await expect(homeReady(page)).toBeVisible();
}

/** Picks a file through the web image picker (expo-image-picker opens a file input). */
export async function pickFile(page: Page, trigger: () => Promise<void>, file: string) {
  const chooserPromise = page.waitForEvent('filechooser');
  await trigger();
  const chooser = await chooserPromise;
  await chooser.setFiles(file);
}

/**
 * Publishes an article through the Studio (P2): the gallery photo, the caption (its first line is the
 * name), the « Vendre ou troquer cet article » switch, the inline chips (price, Vendre · Troquer ·
 * Donner, catégorie, état), then « Publier ». Vendre + Troquer both on = « Les deux ».
 */
const PRICE_MODE_LABELS = { 'Prix affiché': 'Prix affiché', 'Prix sur demande': 'Sur demande', 'À discuter': 'À discuter' } as const;

/** Opens the Studio and brings one gallery file to the composer. */
export async function studioWithFile(page: Page, file: string, path = '/studio') {
  await page.goto(path);
  const gallery = page.getByTestId('studio-gallery');
  await expect(gallery).toBeVisible();
  await pickFile(page, () => gallery.click(), file);
  await page.getByTestId('studio-next').click();
  await expect(page.getByTestId('studio-composer')).toBeVisible();
}

export async function publishListing(
  page: Page,
  opts: {
    file: string;
    title: string;
    mode?: 'Vente' | 'Vente ou troc' | 'Troc' | 'Donner';
    priceMode?: keyof typeof PRICE_MODE_LABELS;
    price?: string;
    category: string;
    condition: string;
    description?: string;
    /** Pilot cut (e): leave the « Partage ta boutique » moment of a first listing open. */
    keepMoment?: boolean;
  },
) {
  await studioWithFile(page, opts.file);
  const sell = page.getByRole('switch', { name: 'Vendre ou troquer cet article' });
  if ((await sell.getAttribute('aria-checked')) !== 'true') await sell.click();
  await page.getByTestId('studio-caption').fill(opts.description ? `${opts.title}\n${opts.description}` : opts.title);
  const chip = (name: string) => page.getByTestId('studio-item-chips').getByRole('button', { name, exact: true });
  if (opts.mode === 'Vente ou troc') await chip('Troquer').click();
  if (opts.mode === 'Troc') {
    await chip('Troquer').click();
    await chip('Vendre').click();
  }
  if (opts.mode === 'Donner') await chip('Donner').click();
  if (opts.priceMode || opts.price) {
    await page.getByRole('button', { name: /^Prix : / }).click();
    if (opts.priceMode) await page.getByRole('radio', { name: PRICE_MODE_LABELS[opts.priceMode], exact: true }).click();
    if (opts.price) await field(page, /^(Prix|Valeur estimée)/).fill(opts.price);
    await btn(page, 'Terminé').click();
  }
  await page.getByRole('button', { name: /^Catégorie : / }).click();
  await btn(page, opts.category).click();
  await page.getByRole('button', { name: /^État : / }).click();
  await btn(page, opts.condition).click();
  await page.getByTestId('studio-publish').click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}(\?first=1)?$/, { timeout: 60_000 });
  // A seller's first listing opens « Partage ta boutique » (pilot cut e): close it unless asked.
  if (page.url().endsWith('?first=1') && !opts.keepMoment) {
    const moment = page.getByTestId('share-boutique-moment');
    await expect(moment).toBeVisible();
    await moment.getByRole('button', { name: 'Plus tard', exact: true }).click();
    await expect(moment).toBeHidden();
  }
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

export type GoldHit = { tag: string; text: string; w: number; h: number };

/** Filled-gold elements on the page right now. */
export async function goldFills(page: Page): Promise<GoldHit[]> {
  return page.evaluate(() => {
    const GOLD = [
      [239, 189, 56],
      [243, 198, 77],
    ];
    const hits: { tag: string; text: string; w: number; h: number }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.1) continue;
      const m = cs.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) continue;
      const a = m[4] === undefined ? 1 : Number(m[4]);
      if (a < 0.9) continue;
      if (!GOLD.some(([r, g, b]) => r === +m[1]! && g === +m[2]! && b === +m[3]!)) continue;
      const r = el.getBoundingClientRect();
      if (Math.min(r.width, r.height) < 28) continue;
      if (r.bottom <= 0 || r.right <= 0) continue; // off-screen (skip link before focus)
      // Under a sheet or scrim (centre inside the viewport but not on top): not on screen.
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight) {
        const top = document.elementFromPoint(cx, cy);
        if (top && !el.contains(top) && !top.contains(el)) continue;
      }
      hits.push({ tag: el.tagName.toLowerCase(), text: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
    }
    // Nested gold boxes (a gold button inside a gold wrapper) count once.
    return hits.filter((h, i) => !hits.some((o, j) => j !== i && o.text === h.text && o.w >= h.w && o.h >= h.h && j < i));
  });
}

