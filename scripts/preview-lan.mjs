#!/usr/bin/env node
/**
 * Jëfëli — local interactive preview for a phone on the same Wi-Fi.
 * Nothing is deployed and nothing goes to the internet: the phone talks to this computer.
 *
 *   pnpm preview:lan                  # detects this computer's Wi-Fi address
 *   pnpm preview:lan --ip 192.168.1.20
 *   pnpm preview:lan --dev            # Metro dev server (live reload) instead of a production build
 *   pnpm preview:lan --reset-demo     # recreate the DÉMO accounts and content
 *
 * Starts: the local Supabase API (Studio, mailpit and postgres-meta stay off), the Edge Functions,
 * the DÉMO seed (only if absent), the Expo web app on :8081 and the Next.js share pages +
 * moderation console on :3000. Both front ends are built against http://<ip>:54321, so the phone
 * reaches the API instead of its own localhost. Ctrl+C stops the front ends; `pnpm db:stop`
 * stops Supabase.
 *
 * Use it on a private network only (home Wi-Fi or your phone's hotspot): the local Supabase stack
 * uses well-known development keys.
 */
import { createClient } from '@supabase/supabase-js';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const APP_PORT = 8081;
const WEB_PORT = 3000;
const API_PORT = 54321;
const DB_PORT = 54322; // supabase/config.toml [db] port
const children = [];
const shell = process.platform === 'win32'; // pnpm is a .cmd shim on Windows

function log(msg) {
  console.log(`\n▸ ${msg}`);
}

function fail(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

/** True when something already accepts connections on the port, or it cannot be bound. */
async function portInUse(port) {
  const connects = await new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.setTimeout(1000);
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('timeout', () => (s.destroy(), resolve(false)));
    s.once('error', () => resolve(false));
  });
  if (connects) return true;
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(true));
    srv.once('listening', () => srv.close(() => resolve(false)));
    srv.listen(port, '0.0.0.0');
  });
}

/**
 * Every Supabase CLI project uses the same default ports, so another local project (or an old
 * dev server) makes `supabase start` fail with a bare Docker error. Explain it before starting.
 */
async function preflight() {
  const ps = spawnSync('docker', ['ps', '--format', '{{.Names}}\t{{.Ports}}'], { encoding: 'utf8', shell });
  if (ps.status !== 0) fail('Docker ne répond pas. Lancez Docker Desktop, attendez qu’il soit prêt, puis relancez « pnpm preview:lan ».');
  const owners = {};
  for (const line of ps.stdout.split('\n')) {
    const [name, ports = ''] = line.split('\t');
    for (const m of ports.matchAll(/:(\d+)->/g)) owners[Number(m[1])] = name;
  }
  const otherProjects = new Set();
  const problems = [];
  for (const port of [API_PORT, DB_PORT]) {
    const owner = owners[port];
    if (owner?.endsWith('_jefeli')) continue; // our own stack from a previous run: `supabase start` reuses it
    if (owner) {
      problems.push(`port ${port} : utilisé par le conteneur Docker « ${owner} »`);
      if (owner.startsWith('supabase_')) otherProjects.add(owner.replace(/^supabase_[a-z]+_/, ''));
    } else if (await portInUse(port)) {
      problems.push(`port ${port} : utilisé par un autre programme`);
    }
  }
  for (const port of [APP_PORT, WEB_PORT]) {
    if (await portInUse(port)) problems.push(`port ${port} : utilisé par un autre programme (un serveur de développement ?)`);
  }
  if (!problems.length) return;
  const hints = [];
  if (otherProjects.size) {
    hints.push(
      `Un autre projet Supabase local tourne (${[...otherProjects].join(', ')}). Arrêtez-le, ses données sont conservées :`,
      '    pnpm exec supabase stop --all',
    );
  }
  if (problems.some((p) => p.includes('autre programme'))) {
    hints.push(`Pour voir quel programme occupe un port (macOS / Linux) :  lsof -nP -iTCP:<port> -sTCP:LISTEN`);
  }
  fail(`Ports déjà occupés :\n  - ${problems.join('\n  - ')}\n\n${hints.join('\n')}\nPuis relancez « pnpm preview:lan ».`);
}

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', shell, ...opts, env: { ...process.env, ...opts.env } });
  if (res.status !== 0) {
    console.error(`\n✖ ${cmd} ${cmdArgs.join(' ')} failed (exit ${res.status}).`);
    process.exit(1);
  }
  return res;
}

function background(name, cmd, cmdArgs, env = {}) {
  const child = spawn(cmd, cmdArgs, { cwd: ROOT, shell, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  const prefix = (chunk) => chunk.toString().split('\n').filter(Boolean).map((l) => `[${name}] ${l}`).join('\n');
  child.stdout.on('data', (c) => console.log(prefix(c)));
  child.stderr.on('data', (c) => console.error(prefix(c)));
  child.on('exit', (code) => code && console.error(`[${name}] stopped (exit ${code})`));
  children.push(child);
  return child;
}

/** First private IPv4 of a physical interface (Wi-Fi/Ethernet), skipping Docker/VPN bridges. */
function lanAddress() {
  const skip = /^(lo|docker|br-|veth|utun|bridge|vmnet|vboxnet|tailscale|tun|tap|awdl|llw|anpi|gif|stf|virbr|zt|wg)/i;
  const isPrivate = (a) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a);
  const found = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (skip.test(name)) continue;
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal && isPrivate(a.address)) found.push({ name, address: a.address });
    }
  }
  const preferred = found.find((f) => /^(en0|en1|wlan|wl|wi-?fi)/i.test(f.name)) ?? found[0];
  return preferred?.address;
}

async function waitFor(url, label, timeoutMs = 120_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} did not answer on ${url}`);
}

/** Static server with single-page-app fallback for the exported Expo web build. */
function serveStatic(dir, port) {
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
    '.json': 'application/json', '.map': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
    '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  };
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    let rel;
    try {
      rel = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    let file = path.resolve(root, `.${rel}`);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': types[ext] ?? 'application/octet-stream',
      'Cache-Control': rel.startsWith('/_expo/') || rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
  server.once('error', (e) => fail(`Le port ${port} n’est pas disponible (${e.code}).`));
  server.listen(port, '0.0.0.0');
  return server;
}

function stopAll() {
  for (const c of children) if (!c.killed) c.kill('SIGTERM');
}
process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});

async function main() {
  const ip = option('--ip') ?? process.env.PREVIEW_HOST ?? lanAddress();
  if (!ip) {
    console.error('✖ No Wi-Fi/Ethernet address found. Connect to Wi-Fi, or pass it: pnpm preview:lan --ip 192.168.1.20');
    process.exit(1);
  }
  const api = `http://${ip}:${API_PORT}`;

  await preflight();

  log('Local Supabase (API only)…');
  run('pnpm', ['exec', 'supabase', 'start', '-x', 'studio,postgres-meta,mailpit']);
  const status = spawnSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { cwd: ROOT, encoding: 'utf8', shell });
  const json = status.stdout.slice(status.stdout.indexOf('{'));
  const keys = JSON.parse(json);
  const anonKey = keys.ANON_KEY;
  const publishableKey = keys.PUBLISHABLE_KEY ?? anonKey;

  log('DÉMO data…');
  run('node', ['scripts/seed-demo.mjs', ...(flag('--reset-demo') ? ['--reset'] : [])]);

  // The local Realtime service starts its change feed on the first postgres_changes subscriber,
  // and events written during that start-up are lost: the first chat message after a fresh
  // `supabase start` never arrived live (reproduced: missed cold, delivered in ~250 ms warm).
  // Holding one anonymous subscription for the lifetime of the preview keeps the feed running.
  log('Realtime warm-up…');
  const warm = createClient(`http://127.0.0.1:${API_PORT}`, publishableKey, { auth: { persistSession: false } });
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('Realtime did not accept a subscription within 90 s')), 90_000);
    const subscribe = () =>
      warm
        .channel('preview-warmup')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {})
        .subscribe((state) => {
          if (state === 'SUBSCRIBED') {
            clearTimeout(deadline);
            setTimeout(resolve, 5000); // let the change feed finish starting
          } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
            warm.removeAllChannels().then(() => setTimeout(subscribe, 2000));
          }
        });
    subscribe();
  });

  log('Edge Functions…');
  const fnEnv = path.join(ROOT, 'supabase/functions/.env');
  background('functions', 'pnpm', ['exec', 'supabase', 'functions', 'serve', ...(fs.existsSync(fnEnv) ? ['--env-file', fnEnv] : [])]);

  log(`Share pages + moderation console (production build against ${api})…`);
  const webEnv = {
    NEXT_PUBLIC_SUPABASE_URL: api,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    NEXT_PUBLIC_SITE_URL: `http://${ip}:${WEB_PORT}`,
    NEXT_PUBLIC_ENV: 'local',
  };
  run('pnpm', ['--filter', '@jefeli/web', 'build'], { env: webEnv });
  background('web', 'pnpm', ['--filter', '@jefeli/web', 'exec', 'next', 'start', '--port', String(WEB_PORT), '--hostname', '0.0.0.0'], webEnv);

  const appEnv = {
    EXPO_PUBLIC_SUPABASE_URL: api,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    EXPO_PUBLIC_WEB_BASE_URL: `http://${ip}:${WEB_PORT}`,
    EXPO_PUBLIC_ENV: 'local',
  };
  if (flag('--dev')) {
    log('Jëfëli app (Metro dev server)…');
    background('app', 'pnpm', ['--filter', '@jefeli/mobile', 'exec', 'expo', 'start', '--web', '--port', String(APP_PORT), '--host', 'lan'], { ...appEnv, BROWSER: 'none', CI: '' });
  } else {
    log('Jëfëli app (production web build)…');
    const out = path.join(ROOT, 'apps/mobile/dist');
    run('pnpm', ['--filter', '@jefeli/mobile', 'exec', 'expo', 'export', '-p', 'web', '--output-dir', out], { env: appEnv });
    serveStatic(out, APP_PORT);
  }

  await waitFor(`http://127.0.0.1:${WEB_PORT}/`, 'Next.js');
  await waitFor(`http://127.0.0.1:${APP_PORT}/`, 'Jëfëli app', 300_000);

  console.log(`
┌───────────────────────────────────────────────────────────────
│  Jëfëli — aperçu local (environnement de test, contenus DÉMO)
│
│  Sur l’iPhone, connecté au même Wi-Fi, ouvrez dans Safari :
│    Application ........... http://${ip}:${APP_PORT}
│    Pages publiques ....... http://${ip}:${WEB_PORT}/baolmode
│    Console de modération . http://${ip}:${WEB_PORT}/admin
│
│  Comptes DÉMO (mot de passe : Demo-jefeli-2026!)
│    awa@demo.jefeli.test     vendeuse (couture)
│    baol@demo.jefeli.test    vendeur (baskets, troc en attente)
│    fatou@demo.jefeli.test   acheteuse (conversation + troc)
│    moussa@demo.jefeli.test  vendeur
│    admin@demo.jefeli.test   console de modération uniquement
│
│  Ctrl+C pour arrêter. Supabase reste lancé : pnpm db:stop
└───────────────────────────────────────────────────────────────`);
}

main().catch((e) => {
  console.error(`✖ ${e.message}`);
  stopAll();
  process.exit(1);
});
