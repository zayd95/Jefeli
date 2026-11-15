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
