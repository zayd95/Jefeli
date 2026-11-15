#!/usr/bin/env node
/**
 * Local development only. The local auth server reads the Send SMS hook secret from
 * `supabase/.env` (gitignored) through `env(SEND_SMS_HOOK_SECRET)` in supabase/config.toml.
 * The Edge Function `send-sms` gets the same value from supabase/functions/.env.test.
 * This copies it so both sides agree. Hosted projects use their own generated secret
 * (docs/PHONE_AUTH.md); nothing here is used there.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'supabase/functions/.env.test');
const target = join(root, 'supabase/.env');

const secret = readFileSync(source, 'utf8').match(/^SEND_SMS_HOOK_SECRET=(.+)$/m)?.[1]?.trim();
if (!secret) {
  console.error('SEND_SMS_HOOK_SECRET missing from supabase/functions/.env.test');
  process.exit(1);
}

const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
const line = `SEND_SMS_HOOK_SECRET=${secret}`;
const next = /^SEND_SMS_HOOK_SECRET=.*$/m.test(current)
  ? current.replace(/^SEND_SMS_HOOK_SECRET=.*$/m, line)
  : `${current}${current && !current.endsWith('\n') ? '\n' : ''}${line}\n`;
if (next !== current) {
  writeFileSync(target, next, { mode: 0o600 });
  console.log('supabase/.env: local Send SMS hook secret set');
}
