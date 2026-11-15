#!/usr/bin/env node
/**
 * Runs after `expo export -p web` (see apps/mobile/vercel.json). Fills %APP_ORIGIN% in the social
 * preview tags of dist/index.html with the absolute address of this deployment, because WhatsApp,
 * Facebook and TikTok need absolute image URLs.
 *
 * Origin, first found: EXPO_PUBLIC_APP_URL (set it once a domain is chosen), then Vercel's own
 * production or deployment host. Without any (local export) the tags fall back to relative URLs.
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '..', 'dist');
const file = path.join(dist, 'index.html');
const host = process.env.VERCEL_ENV === 'production' ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL;
const origin = (process.env.EXPO_PUBLIC_APP_URL || (host ? `https://${host}` : '')).replace(/\/+$/, '');

let html = fs.readFileSync(file, 'utf8');
html = html.replaceAll('%APP_ORIGIN%', origin);
if (html.includes('%APP_ORIGIN%')) throw new Error('index.html still contains %APP_ORIGIN%');
fs.writeFileSync(file, html);
console.log(`web-finalize: social previews point at ${origin || '(relative URLs)'}`);

/**
 * Pilot cut (d) — Android App Links: when the Jëfëli Android app is installed, links to this host
 * (/p/…, /offer/…, /u/…, /post/…; app.json › android.intentFilters) open the app instead of the
 * browser. Android checks /.well-known/assetlinks.json, which must list the SHA-256 of the app's
 * signing certificate. That value only exists once EAS (or Play App Signing) has signed a build,
 * so the file is written only when ANDROID_CERT_SHA256 is set (comma-separated, AA:BB:… form);
 * never with a placeholder. Without it, links simply open the web app.
 */
const fingerprints = (process.env.ANDROID_CERT_SHA256 || '')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
if (fingerprints.length) {
  const bad = fingerprints.filter((f) => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  if (bad.length) throw new Error(`ANDROID_CERT_SHA256: not a SHA-256 fingerprint: ${bad.join(', ')}`);
  const wellKnown = path.join(dist, '.well-known');
  fs.mkdirSync(wellKnown, { recursive: true });
  const statement = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: 'sn.jefeli.app', sha256_cert_fingerprints: fingerprints },
    },
  ];
  fs.writeFileSync(path.join(wellKnown, 'assetlinks.json'), `${JSON.stringify(statement, null, 2)}\n`);
  console.log(`web-finalize: assetlinks.json for sn.jefeli.app (${fingerprints.length} fingerprint(s))`);
} else {
  console.log('web-finalize: ANDROID_CERT_SHA256 not set — no assetlinks.json (App Links stay off until the first signed build)');
}
