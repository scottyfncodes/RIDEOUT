// Serves dist/ under /RIDEOUT/ exactly like GitHub Pages does, so e2e tests can
// prove every asset path works under the real base path. Test-only.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const BASE = '/RIDEOUT/';
const PORT = Number(process.env.PORT || 4174);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404).end('Not found (GitHub Pages serves this app under /RIDEOUT/)');
    return;
  }
  let rel = normalize(url.pathname.slice(BASE.length) || '.').replace(/^(\.\.[/\\])+/, '');
  if (rel === '.') rel = 'index.html';
  else if (rel.endsWith('/')) rel += 'index.html';
  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`serving dist at http://localhost:${PORT}${BASE}`));
