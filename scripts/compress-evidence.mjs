#!/usr/bin/env node
// Re-encodes evidence screenshots as palette PNGs (much smaller, fine for review).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const roots = process.argv.slice(2);
let before = 0, after = 0;
function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.png') && files.push(p); } }
const files = [];
roots.forEach(walk);
for (const f of files) {
  const buf = fs.readFileSync(f);
  before += buf.length;
  const out = await sharp(buf).png({ palette: true, quality: 85, effort: 8 }).toBuffer();
  const best = out.length < buf.length ? out : buf;
  fs.writeFileSync(f, best);
  after += best.length;
}
console.log(`${files.length} files: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
