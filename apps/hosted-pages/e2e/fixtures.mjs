// Test fixtures for the hosted pages end-to-end script. Talks to a real local Worker and the
// Supabase project it uses. Secrets are read from apps/api-worker/.dev.vars and never printed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const API = process.env.E2E_API_URL || 'http://127.0.0.1:8787';
export const SITE = process.env.E2E_SITE_URL || 'http://localhost:3001';
const ORG_NAME = 'Hosted pages e2e (fictional)';

function devVars() {
  const file = path.resolve(here, '../../api-worker/.dev.vars');
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function call(method, url, { headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json };
}

async function signIn(env, email, password) {
  const r = await call('POST', `${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: env.SUPABASE_ANON_KEY },
    body: { email, password },
  });
  if (!r.json.access_token) throw new Error(`Sign in failed for ${email} (${r.status})`);
  return r.json.access_token;
}

/**
 * Creates (or reuses) a test organization, a throwaway admin and an API key.
 * Returns helpers to make payments and a cleanup function.
 */
export async function setup() {
  const env = devVars();
  const stamp = Date.now().toString(36);
  const password = `E2e-${stamp}-Pass1!`;
  const email = `hp-e2e-${stamp}@syntropi.test`;
  const sa = await signIn(env, 'superadmin@syntropi.test', 'DesignReview1!');
  const saAuth = { authorization: `Bearer ${sa}` };

  const orgs = await call('GET', `${API}/api/admin/organizations?search=${encodeURIComponent('Hosted pages e2e')}`, { headers: saAuth });
  let org = (orgs.json.data?.organizations || []).find((o) => o.name === ORG_NAME);
  if (!org) {
    const created = await call('POST', `${API}/api/admin/organizations`, {
      headers: saAuth,
      body: { name: ORG_NAME, contactEmail: 'hp-e2e-org@syntropi.test', plan: 'free' },
    });
    org = created.json.data?.organization;
    if (!org) throw new Error(`Could not create test organization (${created.status})`);
  }

  const user = await call('POST', `${API}/api/admin/users`, {
    headers: saAuth,
    body: { email, password, firstName: 'Test', lastName: `Admin ${stamp}`, role: 'admin', organizationId: org.id },
  });
  const userId = user.json.data?.user?.id ?? user.json.data?.id;
  if (!userId) throw new Error(`Could not create test admin (${user.status})`);

  const admin = await signIn(env, email, password);
  const key = await call('POST', `${API}/api/client/api-keys`, {
    headers: { authorization: `Bearer ${admin}` },
    body: { name: `hosted-pages-e2e-${stamp}`, permissions: ['read', 'write'], environment: 'sandbox' },
  });
  const apiKey = key.json.data?.key;
  const keyId = key.json.data?.apiKey?.id ?? key.json.data?.id;
  if (!apiKey) throw new Error(`Could not create API key (${key.status})`);

  /** A real hosted payment. Returns { paymentId, token, hostedPageUrl, response }. */
  async function createPayment(overrides = {}) {
    const r = await call('POST', `${API}/api/payments`, {
      headers: { 'x-api-key': apiKey },
      body: {
        toAccount: { accountName: 'Example Coffee Roasters Ltd', sortCode: '04-00-04', accountNumber: '12345678' },
        amount: { value: '24.50', currency: 'GBP' },
        reference: `E2E ${stamp}`,
        flowType: 'HOSTED_PAGES',
        provider: 'mock',
        redirectUrl: 'https://merchant.example/return',
        ...overrides,
      },
    });
    const data = r.json.data;
    if (!data?.redirectUrl) throw new Error(`Could not create payment (${r.status}): ${JSON.stringify(r.json.error || r.json).slice(0, 200)}`);
    const url = new URL(data.redirectUrl);
    return { paymentId: data.paymentId, token: url.searchParams.get('token'), hostedPageUrl: data.redirectUrl, response: data };
  }

  /** Approve or reject on the Mock bank through the API (the Mock bank page does the same from its buttons). */
  async function decide(redirectUrl, decision) {
    const u = new URL(redirectUrl);
    const id = decodeURIComponent(u.pathname.split('/').pop());
    const r = await call('POST', `${API}/api/mock-bank/payments/${encodeURIComponent(id)}/decision`, {
      headers: { authorization: `Bearer ${u.searchParams.get('token')}` },
      body: { decision },
    });
    if (r.status !== 200) throw new Error(`Mock bank decision failed (${r.status})`);
  }

  /** Move one of OUR test payments' expiry into the past (Supabase REST, service role; one row, filtered by payment id). */
  async function expire(paymentId) {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/payments?payment_id=eq.${encodeURIComponent(paymentId)}`, {
      method: 'PATCH',
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json', prefer: 'return=representation' },
      body: JSON.stringify({ expires_at: new Date(Date.now() - 60_000).toISOString() }),
    });
    const rows = await r.json().catch(() => []);
    return r.ok && Array.isArray(rows) && rows.length === 1;
  }

  async function cleanup() {
    const log = [];
    if (keyId) log.push(['api key', (await call('DELETE', `${API}/api/client/api-keys/${keyId}`, { headers: { authorization: `Bearer ${admin}` } })).status]);
    log.push(['user', (await call('DELETE', `${API}/api/admin/users/${userId}`, { headers: saAuth })).status]);
    return log;
  }

  return { env, org, apiKey, createPayment, decide, expire, cleanup, call, API };
}
