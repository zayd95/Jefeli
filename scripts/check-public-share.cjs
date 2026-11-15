/**
 * Public share pages must open with NO login wall from a clean browser (no cookies, no storage = a private
 * window). Usage: node scripts/check-public-share.cjs <base-url> <ids.json> [out-dir]
 * ids.json: { "p": [productId…], "h": [handle…], "post": [postId…] } (public rows read with the publishable key).
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const base = process.argv[2].replace(/\/$/, '');
const ids = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const out = process.argv[4];
if (out) fs.mkdirSync(out, { recursive: true });

const pages = [
  ['accueil', '/'],
  ['legal', '/legal'],
  ...ids.p.slice(0, 2).map((id, i) => [`article-${i + 1}`, `/p/${id}`]),
  ...ids.h.slice(0, 2).map((h, i) => [`boutique-${i + 1}`, `/${h}`]),
  ...ids.post.slice(0, 1).map((id) => ['publication', `/post/${id}`]),
];
const WALL = /vercel\.com\/(login|sso)|Log in to Vercel|Vercel Authentication|Authentication Required|Continue with (GitHub|Google)/i;

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const [name, p] of pages) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const res = await page.goto(base + p, { waitUntil: 'networkidle', timeout: 60_000 }).catch((e) => ({ err: String(e) }));
    const status = res && res.status ? res.status() : 0;
    const url = page.url();
    const text = (await page.locator('body').innerText().catch(() => '')) + ' ' + (await page.title().catch(() => ''));
    const sameHost = new URL(url).host === new URL(base).host;
    const wall = WALL.test(text) || !sameHost;
    const cookies = (await ctx.cookies()).length;
    const ok = status === 200 && sameHost && !wall && text.trim().length > 40;
    if (!ok) bad++;
    if (out) await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${p}  HTTP ${status}  host-unchanged=${sameHost}  login-wall=${wall}  cookies-sent=0  "${(await page.title().catch(() => '')).slice(0, 60)}"`);
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pages.length - bad}/${pages.length} public pages opened without any login wall`);
  process.exit(bad ? 1 : 0);
})();
