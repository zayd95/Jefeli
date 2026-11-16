/**
 * P2 evidence: a short GIF of the tab bar hiding on scroll down and coming back on scroll up
 * (390 × 844, Accueil, DÉMO member). Needs the local stack. Output: docs/evidence/p2/after/tabbar.gif
 *   NODE_PATH=tests/e2e/node_modules node tests/e2e/scripts/p2-tabbar-gif.cjs
 */
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.resolve(__dirname, '..', '..', '..', 'docs', 'evidence', 'p2', 'after');
const TMP = fs.mkdtempSync('/tmp/p2gif-');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: TMP, size: { width: 390, height: 844 } },
    locale: 'fr-FR',
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8081/sign-in');
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('fatou@demo.jefeli.test');
  await page.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill('Demo-jefeli-2026!');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.getByRole('button', { name: 'Notifications', exact: true }).waitFor();
  await page.waitForTimeout(1200);
  await page.mouse.move(200, 420);
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 70);
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(900);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -50);
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(1100);
  const video = await page.video().path();
  await ctx.close();
  await browser.close();
  const mp4 = path.join(TMP, 'tabbar.webm');
  fs.renameSync(video, mp4);
  execFileSync('ffmpeg', ['-y', '-ss', '2.2', '-i', mp4, '-vf', 'fps=12,scale=260:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer', '-loop', '0', path.join(OUT, 'tabbar.gif')], { stdio: 'inherit' });
  console.log('written', path.join(OUT, 'tabbar.gif'));
})();
