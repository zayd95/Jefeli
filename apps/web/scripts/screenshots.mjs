#!/usr/bin/env node
/**
 * Screenshots of the web app (requires `next dev` on :3000 and `scripts/dev-fixtures.mjs` output).
 *
 *   node scripts/screenshots.mjs            → apps/web/screenshots/*.png
 *   node scripts/screenshots.mjs --og       → also regenerates public/og-default.png
 *   SHOTS_DIR=/tmp/x node scripts/screenshots.mjs --all   → extra pages for design review
 *
 * Uses the globally installed Playwright (`require('playwright')`).
 */
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.env.SHOTS_DIR || join(webRoot, 'screenshots');
const args = new Set(process.argv.slice(2));
const fixtures = JSON.parse(await readFile(join(here, '.fixtures.local.json'), 'utf8'));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-SN' };
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'fr-SN' };

/** Scroll the whole page so loading="lazy" media is fetched before a full-page capture. */
async function loadLazyMedia(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 300) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
  // Off-screen carousel slides stay lazy on purpose: never wait more than 3 s for them.
  await page.evaluate(() =>
    Promise.race([
      Promise.all([...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null)))),
      new Promise((r) => setTimeout(r, 3000)),
    ]),
  );
}

async function shoot(name, path, ctxOptions, { fullPage = true, before } = {}) {
  const ctx = await browser.newContext(ctxOptions);
  const page = await ctx.newPage();
  const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
  if (fullPage) await loadLazyMedia(page);
  if (before) await before(page);
  await page.evaluate(() => document.fonts.ready);
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log(`${res?.status()} ${path} → ${file}`);
  await ctx.close();
}

const u = fixtures.urls;

await shoot('profile-390', u.profile, MOBILE);
await shoot('profile-1280', u.profile, DESKTOP);
await shoot('product-390', u.product, MOBILE);
await shoot('product-1280', u.product, DESKTOP);

if (args.has('--all')) {
  await shoot('landing-390', '/', MOBILE);
  await shoot('landing-1280', '/', DESKTOP);
  await shoot('private-390', u.privateProfile, MOBILE);
  await shoot('trade-390', u.tradeProduct, MOBILE);
  await shoot('sold-390', u.soldProduct, MOBILE);
  await shoot('post-390', u.post, MOBILE);
  await shoot('live-390', u.live, MOBILE);
  await shoot('legal-390', '/legal/regles', MOBILE, { fullPage: false });
  await shoot('notfound-390', '/inconnu_zz9', MOBILE);
  await shoot('product-390-fold', u.product, MOBILE, { fullPage: false });
  await shoot('profile-390-fold', u.profile, MOBILE, { fullPage: false });
}

// Moderation console --------------------------------------------------------
{
  const ctx = await browser.newContext(DESKTOP);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  if (args.has('--all')) await page.screenshot({ path: join(OUT, 'admin-login-1280.png') });
  await page.getByLabel('E-mail').fill(fixtures.members.admin.email);
  await page.getByLabel('Mot de passe').fill(fixtures.members.admin.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByRole('heading', { name: 'Signalements' }).waitFor();
  await page.locator('.report-row').first().waitFor();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(OUT, 'admin-queue-1280.png'), fullPage: true });
  console.log(`admin queue → ${join(OUT, 'admin-queue-1280.png')}`);

  // Detail drawer for the product reported twice.
  await page.locator('.report-row', { hasText: 'Sac à main violet' }).first().click();
  await page.locator('.drawer .timeline, .drawer .drawer-section').first().waitFor();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, 'admin-drawer-1280.png') });
  console.log(`admin drawer → ${join(OUT, 'admin-drawer-1280.png')}`);

  if (args.has('--all')) {
    await page.keyboard.press('Escape');
    await page.locator('.report-row', { hasText: 'Statut' }).first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, 'admin-drawer-story-1280.png') });
    await page.keyboard.press('Escape');
    for (const [slug, name] of [
      ['verifications', 'admin-verifications'],
      ['contestations', 'admin-appeals'],
      ['journal', 'admin-journal'],
      ['reglages', 'admin-settings'],
    ]) {
      await page.goto(`${BASE}/admin/${slug}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(OUT, `${name}-1280.png`), fullPage: true });
    }
    const m = await browser.newContext(MOBILE);
    const mp = await m.newPage();
    await mp.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    await mp.getByLabel('E-mail').fill(fixtures.members.admin.email);
    await mp.getByLabel('Mot de passe').fill(fixtures.members.admin.password);
    await mp.getByRole('button', { name: 'Se connecter' }).click();
    await mp.locator('.report-row').first().waitFor();
    await mp.screenshot({ path: join(OUT, 'admin-queue-390.png'), fullPage: true });
    await m.close();
  }
  await ctx.close();
}

// Default OpenGraph image (brand typography, no photo) ----------------------
if (args.has('--og')) {
  const font = await readFile(require.resolve('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', { paths: [webRoot] }));
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Inter Variable'; src: url(data:font/woff2;base64,${font.toString('base64')}) format('woff2'); font-weight: 100 900; }
    html, body { margin: 0; width: 1200px; height: 630px; }
    body { background: #F6F5F1; color: #10252C; font-family: 'Inter Variable'; display: flex; flex-direction: column; justify-content: center; padding: 0 96px; box-sizing: border-box; position: relative; }
    .wm { font-size: 168px; font-weight: 800; letter-spacing: -0.045em; line-height: 1; display: flex; align-items: baseline; }
    .dot { width: 0.15em; height: 0.15em; margin-left: 0.06em; border-radius: 0.03em; background: #2E8C73; display: inline-block; }
    .tag { margin-top: 28px; font-size: 52px; font-weight: 800; letter-spacing: -0.03em; }
    .sub { margin-top: 10px; font-size: 30px; color: #607071; }
    .band { position: absolute; left: 0; right: 0; bottom: 0; height: 18px; background: #A3E4D7; }
  </style></head><body><div class="wm">Jëfëli<span class="dot"></span></div><div class="tag">Découvre. Partage. Vends.</div><div class="sub">Le réseau social du commerce sénégalais</div><div class="band"></div></body></html>`;
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 } });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(webRoot, 'public', 'og-default.png') });
  console.log(`og → ${join(webRoot, 'public', 'og-default.png')}`);
  await ctx.close();
}

await browser.close();
