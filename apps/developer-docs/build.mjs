// Build the developer site: guides (Markdown) and the API reference (Redoc over openapi.yaml) into dist/.
//   node build.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const REDOC = 'https://cdn.redocly.com/redoc/v2.4.0/bundles/redoc.standalone.js';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Pages from content/*.md. Front matter: title, slug, order, section. */
export function loadGuides(dir = join(root, 'content')) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(join(dir, file), 'utf8');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!m) throw new Error(`${file}: missing front matter`);
      const meta = Object.fromEntries(m[1].split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
      for (const k of ['title', 'slug', 'order']) if (!meta[k]) throw new Error(`${file}: front matter needs ${k}`);
      return { file, title: meta.title, slug: meta.slug, order: Number(meta.order), body: m[2] };
    })
    .sort((a, b) => a.order - b.order);
}

/** Welcome is the home page. Every other guide lives under /guides/<slug>/. */
export const pathOf = (g) => (g.slug === 'welcome' ? '/' : `/guides/${g.slug}/`);

export function render(markdown) {
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = slugify(text);
        return `<h${depth} id="${id}">${text}${depth > 1 ? `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` : ''}</h${depth}>\n`;
      },
      code({ text, lang }) {
        return `<div class="code"><button class="copy" type="button" aria-label="Copy code">Copy</button><pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(text)}</code></pre></div>\n`;
      },
      table(token) {
        const head = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join('');
        const rows = token.rows.map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`).join('');
        return `<div class="table"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });
  return marked.parse(markdown);
}

const CSS = `
:root{
  --bg:#fbfbfd; --panel:#ffffff; --ink:#171733; --ink2:#575a78; --line:#e1e3f0; --accent:#4f45d6; --accent-soft:#edecff;
  --code-bg:#f3f4fa; --code-ink:#26264a;
  --font:'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',sans-serif; --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#0e0e24; --panel:#15152f; --ink:#eceeff; --ink2:#a4a7ca; --line:#2a2c55; --accent:#a39dff; --accent-soft:#25235a;
  --code-bg:#1a1a3a; --code-ink:#dfe1ff; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#0e0e24; --panel:#15152f; --ink:#eceeff; --ink2:#a4a7ca; --line:#2a2c55; --accent:#a39dff; --accent-soft:#25235a;
  --code-bg:#1a1a3a; --code-ink:#dfe1ff; color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:var(--font);font-size:16px;line-height:1.65;margin:0}
a{color:var(--accent)}
.layout{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh}
nav.side{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;padding:24px 20px;border-right:1px solid var(--line);background:var(--panel)}
.brand{display:block;font-weight:600;font-size:1.15rem;letter-spacing:-.01em;color:var(--ink);text-decoration:none;margin-bottom:4px}
.brand small{display:block;font-weight:400;font-size:.8rem;color:var(--ink2)}
nav.side h2{font-size:.78rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2);margin:24px 0 6px}
nav.side ul{list-style:none;margin:0;padding:0}
nav.side a{display:block;padding:6px 10px;border-radius:8px;color:var(--ink);text-decoration:none;font-size:.95rem}
nav.side a:hover{background:var(--accent-soft)}
nav.side a[aria-current="page"]{background:var(--accent-soft);color:var(--accent);font-weight:600}
main{padding:40px clamp(16px,5vw,64px) 96px;max-width:860px;min-width:0}
h1{font-size:clamp(1.8rem,4vw,2.4rem);line-height:1.15;letter-spacing:-.02em;margin:0 0 20px;text-wrap:balance}
h2{font-size:1.4rem;letter-spacing:-.01em;margin:44px 0 12px;text-wrap:balance}
h3{font-size:1.1rem;margin:30px 0 8px}
h1,h2,h3{scroll-margin-top:16px}
.anchor{margin-left:.4em;text-decoration:none;opacity:0;font-weight:400}
h2:hover .anchor,h3:hover .anchor,.anchor:focus{opacity:.6}
p,li{max-width:70ch}
ul,ol{padding-left:1.3em}
li{margin:.25em 0}
code{font-family:var(--mono);font-size:.88em;background:var(--code-bg);color:var(--code-ink);padding:.12em .35em;border-radius:5px}
.code{position:relative;margin:16px 0}
.code pre{margin:0;padding:16px;background:var(--code-bg);border-radius:10px;overflow-x:auto;border:1px solid var(--line)}
.code pre code{background:none;padding:0;font-size:.85rem;line-height:1.55}
.copy{position:absolute;top:8px;right:8px;font:inherit;font-size:.78rem;padding:3px 9px;border-radius:6px;border:1px solid var(--line);background:var(--panel);color:var(--ink2);cursor:pointer}
.copy:hover{color:var(--ink)}
.table{overflow-x:auto;margin:16px 0}
table{border-collapse:collapse;min-width:100%;font-size:.93rem}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;color:var(--ink2);font-size:.85rem}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.menu{display:none}
.pager{display:flex;justify-content:space-between;gap:16px;margin-top:56px;padding-top:20px;border-top:1px solid var(--line);flex-wrap:wrap}
.pager a{text-decoration:none;font-weight:600}
@media (max-width:860px){
  .layout{display:block}
  nav.side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}
  nav.side:not(.open) .links{display:none}
  .menu{display:inline-block;margin-top:10px;font:inherit;padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer}
  main{padding-top:28px}
}
`;

const SCRIPT = `
document.querySelectorAll('.copy').forEach(function(b){
  b.addEventListener('click',function(){
    var t=b.parentElement.querySelector('code').innerText;
    var done=function(){b.textContent='Copied';setTimeout(function(){b.textContent='Copy'},1500)};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,function(){})}
  });
});
var menu=document.querySelector('.menu');
if(menu){menu.addEventListener('click',function(){var n=document.querySelector('nav.side');var o=n.classList.toggle('open');menu.setAttribute('aria-expanded',o)})}
`;

const HEAD = (title, description) => `<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${escapeHtml(description)}">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%234f45d6'/%3E%3Ctext x='16' y='22' font-family='sans-serif' font-size='18' font-weight='700' text-anchor='middle' fill='white'%3ES%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">`;

function sidebar(guides, current) {
  const link = (href, label, isCurrent) => `<li><a href="${href}"${isCurrent ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a></li>`;
  return `<nav class="side" aria-label="Documentation">
  <a class="brand" href="/">Syntropi<small>Developer docs</small></a>
  <button class="menu" type="button" aria-expanded="false">Menu</button>
  <div class="links">
    <h2>Developer docs</h2>
    <ul>${guides.map((g) => link(pathOf(g), g.title, g === current)).join('')}</ul>
    <h2>API Reference</h2>
    <ul>${link('/reference/', 'Endpoints and schemas', current === 'reference')}${link('/openapi.yaml', 'OpenAPI file', false)}</ul>
  </div>
</nav>`;
}

function guidePage(guides, g, i) {
  const prev = guides[i - 1];
  const next = guides[i + 1];
  const html = render(g.body);
  const description = (g.body.match(/\n\n([^#\n][^\n]{20,200})/)?.[1] ?? g.title).replace(/[`*[\]]/g, '').replace(/\(([^)]*)\)/g, '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">${HEAD(`${g.title} | Syntropi developer docs`, description)}<style>${CSS}</style></head>
<body><div class="layout">${sidebar(guides, g)}<main>${html}
<div class="pager">${prev ? `<a href="${pathOf(prev)}">Previous: ${escapeHtml(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${pathOf(next)}">Next: ${escapeHtml(next.title)}</a>` : `<a href="/reference/">API Reference</a>`}</div>
</main></div><script>${SCRIPT}</script></body></html>`;
}

function referencePage(guides) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">${HEAD('API Reference | Syntropi developer docs', 'Every Syntropi API endpoint, field and example.')}
<style>body{margin:0}.bar{display:flex;gap:20px;align-items:center;padding:12px 20px;border-bottom:1px solid #e1e3f0;font-family:'IBM Plex Sans',system-ui,sans-serif;background:#fff}.bar a{color:#171733;text-decoration:none;font-weight:600}.bar a:hover{color:#4f45d6}.bar span{color:#575a78}</style></head>
<body>
<div class="bar"><a href="/">Syntropi</a><span>/</span><a href="/">Developer docs</a><a href="/reference/" aria-current="page">API Reference</a></div>
<div id="redoc"></div>
<script src="${REDOC}"></script>
<script>
Redoc.init('/openapi.yaml', {
  hideDownloadButton: false,
  expandResponses: '200,201',
  pathInMiddlePanel: true,
  theme: {
    colors: { primary: { main: '#4f45d6' } },
    typography: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif", code: { fontFamily: "'IBM Plex Mono', ui-monospace, monospace" } }
  }
}, document.getElementById('redoc'));
</script>
</body></html>`;
}

const notFound = (guides) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">${HEAD('Page not found | Syntropi developer docs', 'Page not found')}<style>${CSS}</style></head>
<body><div class="layout">${sidebar(guides, null)}<main><h1>Page not found</h1><p>That page does not exist. Pick a page from the menu, or go to the <a href="/">welcome page</a>.</p></main></div><script>${SCRIPT}</script></body></html>`;

const VERCEL = {
  cleanUrls: false,
  trailingSlash: true,
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
};

export function build() {
  const guides = loadGuides();
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  guides.forEach((g, i) => {
    const out = g.slug === 'welcome' ? join(dist, 'index.html') : join(dist, 'guides', g.slug, 'index.html');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, guidePage(guides, g, i));
  });
  mkdirSync(join(dist, 'reference'), { recursive: true });
  writeFileSync(join(dist, 'reference', 'index.html'), referencePage(guides));
  writeFileSync(join(dist, '404.html'), notFound(guides));
  cpSync(join(root, 'openapi.yaml'), join(dist, 'openapi.yaml'));
  const postman = join(root, '../../docs/syntropi-payments.postman_collection.json');
  if (existsSync(postman)) cpSync(postman, join(dist, 'syntropi-payments.postman_collection.json'));
  writeFileSync(join(dist, 'vercel.json'), JSON.stringify(VERCEL, null, 2) + '\n');
  return { guides: guides.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { guides } = build();
  console.log(`Built ${guides} guides, the API reference and 404 into dist/`);
}
