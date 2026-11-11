#!/usr/bin/env node
/**
 * Schema compatibility check (W1.3).
 *
 * A preview once went live against a database missing columns the app asked for: every feed
 * request failed and members saw « Oups » on a dead homepage. This script makes that a failed
 * build instead.
 *
 *   node scripts/schema-contract.mjs generate        Write supabase/schema-contract.json from the
 *                                                     local database (all migrations applied).
 *   node scripts/schema-contract.mjs generate --verify
 *                                                     Fail if the committed contract is stale.
 *   node scripts/schema-contract.mjs check            Probe the target project (env below) and fail
 *                                                     if a table, column or function the code
 *                                                     expects is missing.
 *
 * The check needs only the public (publishable/anon) key and changes nothing:
 *   - tables and columns: GET /rest/v1/<table>?select=<every column>&limit=0 (no row is read; a
 *     missing column fails at planning, before any permission check);
 *   - functions: GET /rest/v1/rpc/<name>?<every argument>= (PostgREST runs GET in a READ ONLY
 *     transaction; « function not found » is the only answer that means missing).
 *
 * Target: SCHEMA_CHECK_URL / SCHEMA_CHECK_KEY, else EXPO_PUBLIC_SUPABASE_URL +
 * EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY), else NEXT_PUBLIC_SUPABASE_URL +
 * NEXT_PUBLIC_SUPABASE_ANON_KEY. There is no switch to skip it: an unreachable target fails too.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = path.join(ROOT, 'supabase', 'schema-contract.json');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function psql(sql) {
  return execFileSync('psql', [DB_URL, '-tA', '-F', '\t', '-c', sql], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'));
}

function migrationFiles() {
  return fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
}

function buildContract() {
  const tables = {};
  for (const [table, column] of psql(
    `select c.table_name, c.column_name from information_schema.columns c
     join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public' order by c.table_name, c.ordinal_position`,
  )) {
    (tables[table] ??= []).push(column);
  }
  const functions = {};
  for (const [name, args] of psql(
    `select p.proname, pg_get_function_identity_arguments(p.oid) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     order by 1, 2`,
  )) {
    const names = (args ?? '')
      .split(',')
      .map((a) => a.trim().split(/\s+/)[0])
      .filter(Boolean);
    // Overloads: keep every signature.
    (functions[name] ??= []).push(names);
  }
  return { generated_from: migrationFiles(), tables, functions };
}

function stable(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function generate(verify) {
  const next = stable(buildContract());
  if (verify) {
    const current = fs.existsSync(CONTRACT) ? fs.readFileSync(CONTRACT, 'utf8') : '';
    if (current !== next) {
      console.error('supabase/schema-contract.json is out of date with the migrations. Run: pnpm db:contract');
      process.exit(1);
    }
    console.log('Schema contract is up to date.');
    return;
  }
  fs.writeFileSync(CONTRACT, next);
  const c = JSON.parse(next);
  console.log(`Wrote supabase/schema-contract.json: ${Object.keys(c.tables).length} tables, ${Object.keys(c.functions).length} functions.`);
}

/** The first migration matching every pattern: a hint for the reader, not a proof. */
function introducedBy(...patterns) {
  for (const f of migrationFiles()) {
    const text = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8');
    if (patterns.every((p) => (p instanceof RegExp ? p.test(text) : text.includes(p)))) return `supabase/migrations/${f}`;
  }
  return 'a migration of this branch';
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Where a column comes from: its `add column`, else the table's `create table`. */
function columnIntroducedBy(table, col) {
  const added = introducedBy(`public.${table}`, new RegExp(`add column (if not exists )?${esc(col)}\\b`, 'i'));
  return added.startsWith('supabase/') ? added : introducedBy(new RegExp(`create table (if not exists )?public\\.${esc(table)}\\b`, 'i'));
}

/** One read-only request; a 5xx (e.g. PGRST002 while the schema cache loads) is retried with backoff. */
async function probe(url, key, pathAndQuery, attempts = 5) {
  for (let i = 0; ; i++) {
    const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    let body = {};
    try {
      body = await res.json();
    } catch {
      /* empty body */
    }
    if (res.status >= 500 && i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
      continue;
    }
    return { status: res.status, code: body?.code ?? null, message: body?.message ?? '' };
  }
}

async function check() {
  const url = (process.env.SCHEMA_CHECK_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key =
    process.env.SCHEMA_CHECK_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    '';
  if (!url || !key) {
    console.error('Schema check: no Supabase URL or public key in the environment (SCHEMA_CHECK_URL/KEY or the app’s EXPO_PUBLIC_/NEXT_PUBLIC_ variables).');
    process.exit(2);
  }
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  const missing = [];
  const unexpected = [];

  try {
    await probe(url, key, 'profiles?select=id&limit=0');
  } catch (e) {
    console.error(`Schema check: cannot reach ${url} (${e?.cause?.code ?? e?.message}). Deploying without checking is not allowed.`);
    process.exit(2);
  }

  const tables = Object.entries(contract.tables);
  await Promise.all(
    tables.map(async ([table, columns]) => {
      const r = await probe(url, key, `${encodeURIComponent(table)}?select=${columns.map(encodeURIComponent).join(',')}&limit=0`);
      if (r.status < 300 || r.code === '42501') return; // exists (maybe not readable with the public key)
      if (r.code === 'PGRST205' || r.code === '42P01') {
        missing.push({ what: `table ${table}`, hint: introducedBy(new RegExp(`create table (if not exists )?public\\.${esc(table)}\\b`, 'i')) });
        return;
      }
      if (r.code === '42703' || r.code === 'PGRST204') {
        // Find which columns: one probe per column.
        for (const col of columns) {
          const c = await probe(url, key, `${encodeURIComponent(table)}?select=${encodeURIComponent(col)}&limit=0`);
          if (c.code === '42703' || c.code === 'PGRST204') missing.push({ what: `column ${table}.${col}`, hint: columnIntroducedBy(table, col) });
        }
        return;
      }
      unexpected.push(`table ${table}: HTTP ${r.status} ${r.code ?? ''} ${r.message}`.trim());
    }),
  );

  const fns = Object.entries(contract.functions).flatMap(([name, sigs]) => sigs.map((args) => ({ name, args })));
  await Promise.all(
    fns.map(async ({ name, args }) => {
      const qs = args.map((a) => `${encodeURIComponent(a)}=`).join('&');
      const r = await probe(url, key, `rpc/${encodeURIComponent(name)}${qs ? `?${qs}` : ''}`);
      if (r.code === 'PGRST202') missing.push({ what: `function ${name}(${args.join(', ')})`, hint: introducedBy(`function public.${name}(`) });
    }),
  );

  if (unexpected.length) {
    console.error(`Schema check: unexpected answers from ${url}:\n  - ${unexpected.join('\n  - ')}`);
    process.exit(2);
  }
  if (missing.length) {
    const byHint = new Map();
    for (const m of missing) byHint.set(m.hint, [...(byHint.get(m.hint) ?? []), m.what]);
    console.error(`✗ The database at ${url} is behind this code. Missing:`);
    for (const [hint, whats] of [...byHint.entries()].sort()) console.error(`  ${hint}\n    - ${whats.sort().join('\n    - ')}`);
    console.error('Apply the pending migrations, in order, before deploying (docs/STAGING_MIGRATION_PLAN.md).');
    process.exit(1);
  }
  console.log(`✓ Schema compatible (${url}): ${tables.length} tables, ${fns.length} functions checked.`);
}

const [mode, flag] = process.argv.slice(2);
if (mode === 'generate') generate(flag === '--verify');
else if (mode === 'check') await check();
else {
  console.error('Usage: schema-contract.mjs generate [--verify] | check');
  process.exit(2);
}
