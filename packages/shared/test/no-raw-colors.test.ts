/**
 * One visual system (P1 addendum, owner 14 Nov 2026): a colour value may only be written in
 * packages/shared/src/tokens.ts. Every other source file uses the tokens.
 *
 *   - Code and styles (ts, tsx, js, mjs, css under apps/ and packages/): no #hex and no rgb()/rgba().
 *   - Files that cannot import the tokens (app.json, index.html, SVG icons, the Node build scripts
 *     in apps/web/scripts): every
 *     #hex must be a value of `palette`, so they cannot drift from it.
 *
 * Fails with the file, line and value of each offender.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { palette } from '../src/tokens';

const ROOT = join(__dirname, '..', '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.expo', 'web-build', 'android', 'ios', '.turbo', 'coverage']);
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/;
const CONFIG = /\.(json|html|svg)$/;
const ALLOWED = new Set(['packages/shared/src/tokens.ts', 'packages/shared/src/database.types.ts']);
/** Plain Node scripts cannot import tokens.ts: palette values only, like the config files. */
const isScript = (rel: string) => rel.startsWith('apps/web/scripts/');
const HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const RGB = /\brgba?\(/g;
const PALETTE = new Set(Object.values(palette).map((v) => v.toUpperCase()));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = ['apps/mobile/src', 'apps/mobile/app.json', 'apps/mobile/public', 'apps/web/src', 'apps/web/scripts', 'packages/shared/src'].flatMap((d) => {
  const abs = join(ROOT, d);
  return statSync(abs).isDirectory() ? walk(abs) : [abs];
});

describe('colours live only in tokens.ts', () => {
  it('scans the app and web sources', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no #hex or rgb()/rgba() in code and styles outside tokens.ts', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const rel = relative(ROOT, f);
      if (!CODE.test(f) || ALLOWED.has(rel) || isScript(rel)) continue;
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(HEX)) offenders.push(`${rel}:${i + 1} ${m[0]}`);
          for (const m of line.matchAll(RGB)) offenders.push(`${rel}:${i + 1} ${m[0]}…`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('config, HTML and SVG files only use palette values', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const rel = relative(ROOT, f);
      if (!CONFIG.test(f) && !isScript(rel)) continue;
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(HEX)) if (!PALETTE.has(m[0].toUpperCase())) offenders.push(`${rel}:${i + 1} ${m[0]}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
