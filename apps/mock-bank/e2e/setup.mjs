// Shared fixture for the browser scripts: a throwaway organization, admin and sandbox API key on the local Worker,
// so a REAL Mock bank payment can be created. Secrets are read from apps/api-worker/.dev.vars and never printed.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const API = (process.env.API_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
export const BANK = (process.env.BANK_URL || 'http://localhost:3002').replace(/\/+$/, '');
export const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function devVars() {
  const file = fileURLToPath(new URL('../../api-worker/.dev.vars', import.meta.url));
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function json(url, init) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

export async function createFixture() {
  const vars = devVars();
  const sb = vars.SUPABASE_URL;
  const anon = vars.SUPABASE_ANON_KEY;
  const signIn = async (email, password) => {
    const r = await json(`${sb}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (r.status !== 200) throw new Error(`Sign-in failed for ${email} (${r.status})`);
    return r.body.access_token;
  };
  const authed = (token) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });

  const suffix = `${Date.now().toString(36)}${randomUUID().slice(0, 4)}`;
  const adminEmail = `mockbank-e2e-${suffix}@example.test`;
  const adminPassword = `Pw-${randomUUID()}`;

  const superToken = await signIn('superadmin@syntropi.test', 'DesignReview1!');
  const org = await json(`${API}/api/admin/organizations`, {
    method: 'POST',
    headers: authed(superToken),
    body: JSON.stringify({ name: `Mock bank e2e ${suffix}`, contactEmail: adminEmail, plan: 'free' }),
  });
  if (org.status !== 201) throw new Error(`Create organization failed (${org.status})`);
  const orgId = org.body.data.organization.id;
  const orgName = org.body.data.organization.name;

  const user = await json(`${API}/api/admin/users`, {
    method: 'POST',
    headers: authed(superToken),
    body: JSON.stringify({ email: adminEmail, password: adminPassword, firstName: 'Test', lastName: `Admin ${suffix}`, role: 'admin', organizationId: orgId }),
  });
  if (user.status !== 201) throw new Error(`Create user failed (${user.status})`);
  const userId = user.body.data.user.id;

  const adminToken = await signIn(adminEmail, adminPassword);
  const key = await json(`${API}/api/client/api-keys`, {
    method: 'POST',
    headers: authed(adminToken),
    body: JSON.stringify({ name: `e2e ${suffix}`, permissions: ['read', 'write'], environment: 'sandbox' }),
  });
  if (key.status !== 201 && key.status !== 200) throw new Error(`Create API key failed (${key.status})`);
  const apiKey = key.body.data.key;

  /** A real Mock bank payment. Returns the link the customer is sent to. */
  async function createPayment(over = {}) {
    const r = await json(`${API}/api/payments`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'mock',
        toAccount: { accountName: 'Acme Coffee', sortCode: '000000', accountNumber: '00000000' },
        amount: { value: '10.50', currency: 'GBP' },
        reference: { reference: 'ORDER-1' },
        redirectUrl: `${BANK}/done-demo`,
        ...over,
      }),
    });
    if (r.status !== 201) throw new Error(`Create payment failed (${r.status}): ${JSON.stringify(r.body?.error ?? {}).slice(0, 200)}`);
    const link = new URL(r.body.data.redirectUrl);
    return { id: r.body.data.paymentId, link: link.toString(), token: link.searchParams.get('token') };
  }

  const paymentStatus = async (id) => {
    const r = await json(`${API}/api/payments/${id}`, { headers: { 'x-api-key': apiKey } });
    return r.body?.data?.status;
  };

  async function cleanup() {
    const notes = [];
    try {
      const t = await signIn('superadmin@syntropi.test', 'DesignReview1!');
      const u = await fetch(`${API}/api/admin/users/${userId}`, { method: 'DELETE', headers: authed(t) });
      notes.push(`user delete ${u.status}`);
      const o = await fetch(`${API}/api/admin/organizations/${orgId}`, { method: 'DELETE', headers: authed(t) });
      // An organization that has payments cannot be deleted (foreign key): that is expected.
      notes.push(`organization delete ${o.status}`);
    } catch (e) {
      notes.push(`cleanup error: ${e.message}`);
    }
    return notes.join(', ');
  }

  return { createPayment, paymentStatus, cleanup, orgName, orgId };
}
