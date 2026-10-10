// `npm start`: serves the static export in out/ the way Cloudflare Pages will:
// /sessions/* -> /sessions/index.html (public/_redirects) and the headers in public/_headers.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../out');
const port = Number(process.env.PORT || 3001);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

async function globalHeaders() {
  const out = {};
  try {
    const text = await readFile(path.join(root, '_headers'), 'utf8');
    let inAll = false;
    for (const raw of text.split('\n')) {
      if (!raw.trim() || raw.trim().startsWith('#')) continue;
      if (!raw.startsWith(' ')) { inAll = raw.trim() === '/*'; continue; }
      const i = raw.indexOf(':');
      if (inAll && i > 0) out[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
    }
  } catch { /* no _headers */ }
  return out;
}

async function find(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const candidates = [clean, path.join(clean, 'index.html'), `${clean}.html`];
  if (clean.startsWith('/sessions/')) candidates.push('/sessions/index.html');
  for (const c of candidates) {
    const file = path.join(root, c);
    if (!file.startsWith(root)) continue;
    try { if ((await stat(file)).isFile()) return file; } catch { /* next */ }
  }
  return null;
}

const headers = await globalHeaders();
createServer(async (req, res) => {
  const file = await find(new URL(req.url, 'http://x').pathname);
  if (!file) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found'); return; }
  res.writeHead(200, { ...headers, 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(port, () => console.log(`Serving out/ on http://localhost:${port}`));
