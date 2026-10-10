// Serves the static export in out/ the way Cloudflare Pages does, including the /pay/* rewrite in public/_redirects.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../out/', import.meta.url));
const port = Number(process.env.PORT || 3002);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain', '.ico': 'image/x-icon', '.png': 'image/png' };

async function pick(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  for (const candidate of [clean, join(clean, 'index.html'), `${clean}.html`]) {
    const file = join(root, candidate);
    if (!file.startsWith(root)) continue;
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {}
  }
  if (/^\/pay\/[^/]+\/?$/.test(pathname)) return join(root, 'pay/index.html');
  return null;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url || '/', 'http://localhost');
  const file = await pick(pathname);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'referrer-policy': 'no-referrer' });
  res.end(await readFile(file));
}).listen(port, () => console.log(`Mock bank (static export) on http://localhost:${port}`));
