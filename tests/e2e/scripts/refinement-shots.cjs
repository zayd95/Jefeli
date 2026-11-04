/**
 * Before/after screenshots for the post-playtest UX refinement.
 * Usage: node tests/e2e/scripts/refinement-shots.cjs <out-dir> [app-url] [web-url]
 * Signs in as the DÉMO seller awa@demo.jefeli.test and captures the same screens at three phone
 * sizes: home, Publier, publication composer, article composer, Explorer, own profile, a product
 * page, a conversation, and the public web product page.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(process.argv[2] || 'shots');
const APP = process.argv[3] || 'http://localhost:8081';
const WEB = process.argv[4] || 'http://localhost:3000';
const DEVICES = {
  'iphone-se': { width: 375, height: 667 },
  'iphone-15': { width: 393, height: 852 },
  'pixel-7': { width: 412, height: 915 },
};

async function shoot(browser, name, size, productId) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Africa/Dakar' });
  const p = await ctx.newPage();
  let n = 0;
  const snap = async (label) => {
    n += 1;
    await p.waitForTimeout(1300);
    await p.screenshot({ path: path.join(dir, `${String(n).padStart(2, '0')}-${label}.png`) });
  };
  const scroll = async (factor = 0.8) => {
    await p.mouse.move(size.width / 2, size.height / 2);
    await p.mouse.wheel(0, Math.round(size.height * factor));
  };
  await p.goto(`${APP}/sign-in`);
  await p.getByRole('textbox', { name: 'E-mail', exact: true }).fill('awa@demo.jefeli.test');
  await p.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill('Demo-jefeli-2026!');
  await p.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await p.getByRole('button', { name: 'Notifications' }).waitFor({ timeout: 60000 });
  await p.waitForTimeout(2000);
  await snap('home');
  await p.goto(`${APP}/publish`);
  await snap('publish-chooser');
  await p.goto(`${APP}/publish/post`);
  await snap('post-composer');
  await p.goto(`${APP}/publish/listing`);
  await snap('listing-composer');
  await scroll(1);
  await snap('listing-composer-scrolled');
  await p.goto(`${APP}/explore`);
  await snap('explore');
  await scroll(0.8);
  await snap('explore-scrolled');
  await p.goto(`${APP}/profile`);
  await snap('own-profile');
  await scroll(0.8);
  await snap('own-profile-scrolled');
  if (productId) {
    await p.goto(`${APP}/p/${productId}`);
    await snap('product');
  }
  await p.goto(`${APP}/messages`);
  await snap('messages');
  if (productId) {
    await p.goto(`${WEB}/p/${productId}`);
    await snap('web-product');
  }
  // After-only extras: a « Prix sur demande » article (app + public page) and the public storefront.
  const onRequestId = process.env.ON_REQUEST_ID;
  if (onRequestId) {
    await p.goto(`${APP}/p/${onRequestId}`);
    await snap('product-on-request');
    await p.goto(`${WEB}/p/${onRequestId}`);
    await snap('web-product-on-request');
  }
  if (process.env.EXTRAS) {
    await p.goto(`${WEB}/awa_couture`);
    await snap('web-storefront');
    await p.goto(`${APP}/u/ousmane_cabas`);
    await snap('seller-profile-visitor');
  }
  await ctx.close();
}

(async () => {
  const productId = process.env.PRODUCT_ID;
  const browser = await chromium.launch();
  for (const [name, size] of Object.entries(DEVICES)) {
    await shoot(browser, name, size, productId);
    console.log(`captured ${name}`);
  }
  await browser.close();
})();
