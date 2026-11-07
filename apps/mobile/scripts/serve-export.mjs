#!/usr/bin/env node
/**
 * Serves the web export (apps/mobile/dist) the way apps/mobile/vercel.json does: an existing file
 * wins, anything else gets index.html (single-page app). For testing the production build locally:
 *   pnpm --filter @jefeli/mobile web:export && pnpm --filter @jefeli/mobile web:serve   (port 8082)
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '..', 'dist'));
const port = Number(process.env.PORT ?? 8082);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

http
  .createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = path.join(root, url);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
