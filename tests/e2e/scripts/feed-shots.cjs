/**
 * Before/after screenshots of the home feed for the feed engagement pass.
 * Usage: node tests/e2e/scripts/feed-shots.cjs <out-dir> [app-url]
 * Signs in as the DÉMO account fatou@demo.jefeli.test and captures the same screens at three
 * phone sizes: feed (top), feed scrolled, a post with its comments, the publication composer.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(process.argv[2] || 'shots');
const APP = process.argv[3] || 'http://localhost:8081';
const DEVICES = {
  'iphone-se': { width: 375, height: 667 },
  'iphone-15': { width: 393, height: 852 },
  'pixel-7': { width: 412, height: 915 },
};

async function shoot(browser, name, size) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Africa/Dakar' });
  const p = await ctx.newPage();
  const snap = async (file) => {
    await p.waitForTimeout(1200);
    await p.screenshot({ path: path.join(dir, `${file}.png`) });
  };
  await p.goto(`${APP}/sign-in`);
  await p.getByRole('textbox', { name: 'E-mail', exact: true }).fill('fatou@demo.jefeli.test');
  await p.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill('Demo-jefeli-2026!');
  await p.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await p.getByRole('button', { name: 'Notifications' }).waitFor({ timeout: 60000 });
  await p.waitForTimeout(2500);
  await snap('01-feed');
  for (let i = 0; i < 3; i += 1) {
    await p.mouse.move(size.width / 2, size.height / 2);
    await p.mouse.wheel(0, Math.round(size.height * 0.75));
    await p.waitForTimeout(700);
    await snap(`0${2 + i}-feed-scrolled-${i + 1}`);
  }
  // First post that has comments (falls back to the first post) — opened like a user would.
  const postLink = p.getByRole('button', { name: /commentaire/i }).first();
  if (await postLink.count()) {
    await postLink.click();
    await p.waitForTimeout(2000);
    await snap('05-post-comments');
    await p.goBack().catch(() => {});
  }
  await p.goto(`${APP}/publish/post`);
  await p.waitForTimeout(2000);
  await snap('06-composer');
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const [name, size] of Object.entries(DEVICES)) {
    await shoot(browser, name, size);
    console.log(`captured ${name}`);
  }
  await browser.close();
})();
