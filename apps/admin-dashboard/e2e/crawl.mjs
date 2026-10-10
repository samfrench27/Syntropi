#!/usr/bin/env node
/**
 * Contract crawl: signs in as each role and visits every page that role can reach, recording
 *   - uncaught page errors
 *   - console errors
 *   - any response >= 400 from the API (a 401 during sign-out is ignored)
 *   - pages that render "undefined", "NaN", "[object Object]" or the Next.js error screen
 *
 * Read-only: it creates and deletes nothing.
 *
 * Usage (dashboard on BASE_URL, API on API_URL):
 *   CRAWL_PASSWORD=... NODE_PATH=/path/to/node_modules \
 *   node e2e/crawl.mjs [--json out.json] [--headed]
 *
 * Env (all optional except CRAWL_PASSWORD):
 *   BASE_URL            default http://localhost:3000
 *   API_URL             default http://127.0.0.1:8787/api
 *   CHROME_PATH         default the macOS Google Chrome binary
 *   CRAWL_ORG_NAME      default "Acme Coffee Roasters" (the org whose users, keys and payments supply ids)
 *   CRAWL_SUPERADMIN / CRAWL_ORGADMIN / CRAWL_USER   sign-in emails
 *   CRAWL_PASSWORD      shared password for the three accounts
 * The Supabase URL and public key are read from the environment or from .env.local.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require('playwright-core'); } catch { return require('playwright'); }
})();

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const API = (process.env.API_URL || 'http://127.0.0.1:8787/api').replace(/\/$/, '');
const API_ORIGIN = new URL(API).origin;
const PASSWORD = process.env.CRAWL_PASSWORD;
const ACCOUNTS = {
  superadmin: process.env.CRAWL_SUPERADMIN || 'superadmin@syntropi.test',
  admin: process.env.CRAWL_ORGADMIN || 'orgadmin@acme.test',
  user: process.env.CRAWL_USER || 'developer@acme.test',
};
const ORG_NAME = process.env.CRAWL_ORG_NAME || 'Acme Coffee Roasters';
const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const headed = args.includes('--headed');

if (!PASSWORD) {
  console.error('Set CRAWL_PASSWORD to the password of the test accounts.');
  process.exit(2);
}

// Supabase public settings, from the environment or the dashboard's .env.local
const env = { ...process.env };
try {
  for (const line of fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env.local */ }
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function token(email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Could not sign in ${email}`);
  return j.access_token;
}
const get = async (t, p) => (await (await fetch(API + p, { headers: { authorization: `Bearer ${t}` } })).json()).data;

// ---------------------------------------------------------------------------
// Ids for the detail pages
// ---------------------------------------------------------------------------
async function discover() {
  const t = await token(ACCOUNTS.superadmin);
  const orgs = (await get(t, '/admin/organizations?limit=100')).organizations;
  const org = orgs.find((o) => o.name === ORG_NAME) || orgs[0];
  const users = (await get(t, `/admin/users?limit=100&organizationId=${org.id}`)).users;
  const keys = (await get(t, `/admin/api-keys?limit=100&organizationId=${org.id}`)).apiKeys ?? [];
  const providers = (await get(t, '/admin/providers')).providers;
  const payments = (await get(t, `/admin/payments?limit=5&organizationId=${org.id}`)).payments;
  return {
    orgId: org.id,
    userId: users[0]?.id,
    keyId: keys[0]?.id,
    providerId: (providers.find((p) => p.code !== 'mock') || providers[0])?.id,
    paymentId: payments[0]?.paymentId,
  };
}

function pagesFor(role, ids) {
  const ok = (arr) => arr.filter((p) => !p.includes('undefined'));
  if (role === 'superadmin') {
    const P = '/platform-admin';
    return ok([
      `${P}/dashboard`, `${P}/provider-requests`,
      `${P}/organizations`, `${P}/organizations/create`, `${P}/organizations/${ids.orgId}`,
      `${P}/organizations/${ids.orgId}?tab=users`, `${P}/organizations/${ids.orgId}?tab=api-keys`, `${P}/organizations/${ids.orgId}?tab=activity`,
      `${P}/users`, `${P}/users/create`, `${P}/users/create?organizationId=${ids.orgId}`, `${P}/users/${ids.userId}`,
      `${P}/providers`, `${P}/providers/create`, `${P}/providers/${ids.providerId}`,
      `${P}/api-keys`, `${P}/api-keys/create`, `${P}/api-keys/create?organizationId=${ids.orgId}`, `${P}/api-keys/${ids.keyId}`,
      `${P}/analytics`, `${P}/analytics/payments/${ids.paymentId}`, `${P}/payments/${ids.paymentId}`,
      `${P}/billing`, `${P}/activities`,
    ]);
  }
  if (role === 'admin') {
    const P = '/org-admin';
    return ok([
      `${P}/dashboard`, `${P}/providers`, `${P}/analytics`, `${P}/analytics/payments/${ids.paymentId}`,
      `${P}/payments/${ids.paymentId}`, `${P}/organization`, `${P}/users`, `${P}/users/create`,
      `${P}/api-keys`, `${P}/api-keys/create`, `${P}/billing`, `${P}/activities`,
      // An organization admin can also open the developer screens
      '/client-dashboard/dashboard', '/client-dashboard/providers', '/client-dashboard/api-keys', '/client-dashboard/activities',
    ]);
  }
  const P = '/client-dashboard';
  return [`${P}/dashboard`, `${P}/providers`, `${P}/api-keys`, `${P}/api-keys/create`, `${P}/activities`];
}

// ---------------------------------------------------------------------------
// Crawl
// ---------------------------------------------------------------------------
const BAD_TEXT = /\b(undefined|NaN|Invalid Date)\b|\[object Object\]|Application error|Unhandled Runtime Error|This page could not be found/;

async function crawlRole(browser, role, ids) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const findings = [];
  let current = 'sign-in';
  let signingOut = false;
  const add = (kind, detail) => findings.push({ role, page: current, kind, detail });

  page.on('pageerror', (e) => add('page error', String(e.message || e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/^Failed to load resource/.test(text)) return; // already reported as a network response
    add('console error', text.slice(0, 300));
  });
  page.on('response', (r) => {
    const url = r.url();
    if (!url.startsWith(API_ORIGIN) || r.status() < 400) return;
    if (r.status() === 401 && signingOut) return;
    add(`http ${r.status()}`, `${r.request().method()} ${url.slice(API_ORIGIN.length)}`);
  });

  await page.goto(`${BASE}/login`);
  await page.fill('#email', ACCOUNTS[role]);
  await page.fill('#password', PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }), page.click('button[type=submit]')]);

  const visited = [];
  for (const p of pagesFor(role, ids)) {
    current = p;
    visited.push(p);
    try {
      await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(600);
      const landed = new URL(page.url());
      if (landed.pathname !== p.split('?')[0]) add('redirected', landed.pathname);
      const text = await page.locator('main').innerText().catch(() => '');
      const hit = text.match(BAD_TEXT);
      if (hit) add('bad text', hit[0]);
    } catch (e) {
      add('navigation', String(e.message).split('\n')[0]);
    }
  }
  current = 'sign-out';
  signingOut = true;
  await ctx.close();
  return { findings, visited };
}

const ids = await discover();
const browser = await chromium.launch({
  headless: !headed,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const all = [];
const visitedCount = {};
for (const role of ['superadmin', 'admin', 'user']) {
  const { findings, visited } = await crawlRole(browser, role, ids);
  all.push(...findings);
  visitedCount[role] = visited.length;
}
await browser.close();

// Known, understood responses. They are listed apart so they do not hide new problems.
const EXPECTED = [
  { match: (f) => f.kind === 'http 503' && /\/admin\/billing\/revenue/.test(f.detail), why: 'Revenue reads Stripe, which is not configured in local development' },
  { match: (f) => f.kind === 'console error' && /status of 503/.test(f.detail), why: 'Same 503 as above' },
];
const isExpected = (f) => EXPECTED.find((e) => e.match(f));

// Collapse repeats so one bad call on one page is one row
const seen = new Set();
const rows = all.filter((f) => {
  const k = `${f.role}|${f.page}|${f.kind}|${f.detail}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

const expected = rows.filter(isExpected);
const real = rows.filter((f) => !isExpected(f));
console.log(`Pages visited: ${Object.entries(visitedCount).map(([r, n]) => `${r} ${n}`).join(', ')}`);
if (!real.length) console.log('No problems found.');
else {
  console.log('\n| Role | Page | Problem | Detail |\n|---|---|---|---|');
  for (const f of real) console.log(`| ${f.role} | ${f.page} | ${f.kind} | ${f.detail.replace(/\|/g, '\\|')} |`);
}
if (expected.length) {
  console.log('\nExpected (not counted):');
  for (const f of expected) console.log(`- ${f.role} ${f.page}: ${f.kind} ${f.detail.slice(0, 90)} (${isExpected(f).why})`);
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ visitedCount, problems: real, expected }, null, 2));
process.exit(real.length ? 1 : 0);
