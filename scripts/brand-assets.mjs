#!/usr/bin/env node
// Generates Jëfëli app icons / splash / favicon from the Atlantic Sand palette (made by us).
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'mobile', 'assets', 'images');
const INK = '#10252C', MINT = '#A3E4D7', CANVAS = '#F6F5F1', DEEP = '#2E8C73';

// A geometric "J" monogram with the brand's square dot, drawn as paths (no font dependency).
const mark = (fg, dot, scale = 1) => `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <path d="M590 250 h120 v390 c0 120 -80 190 -210 190 c-95 0 -165 -40 -205 -105 l90 -70 c25 40 62 62 110 62 c62 0 95 -32 95 -100 z" fill="${fg}"/>
    <rect x="740" y="700" width="96" height="96" rx="22" fill="${dot}"/>
  </g>`;

const svg = (bg, fg, dot, scale, rounded = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  ${bg ? `<rect width="1024" height="1024" ${rounded ? 'rx="220"' : ''} fill="${bg}"/>` : ''}
  ${mark(fg, dot, scale)}
</svg>`;

const write = (name, s, size = 1024) => sharp(Buffer.from(s)).resize(size, size).png().toFile(path.join(out, name));

await write('icon.png', svg(INK, CANVAS, MINT, 1));
await write('android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${INK}"/></svg>`);
await write('android-icon-foreground.png', svg(null, CANVAS, MINT, 0.62));
await write('android-icon-monochrome.png', svg(null, '#FFFFFF', '#FFFFFF', 0.62));
await write('splash-icon.png', svg(null, INK, DEEP, 1), 512);
await write('favicon.png', svg(INK, CANVAS, MINT, 1, true), 96);
console.log('brand assets written to', out);
