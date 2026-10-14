import { beforeEach, describe, expect, it } from 'vitest';
import { generateApiKey } from '../src/lib/crypto';
import { signPaymentToken, verifyPaymentToken } from '../src/lib/paymentToken';
import { createTestApp, type TestApp } from './helpers/app';

const SECRET = 'test-hosted-pages-secret-0123456789';
const TOKEN_ENV = { TOKEN_API_KEY: 'test-token-key', TOKEN_API_BASE_URL: 'https://token.test' };

let t: TestApp;
let keyA: string;
let keyB: string;
let calls: { url: string; method: string; body: any; headers: Record<string, string> }[];
let respond: (url: string, method: string) => { status?: number; body?: any } | Promise<any>;

const body = (over: Record<string, unknown> = {}) => ({
  toAccount: { accountName: 'Acme Coffee Ltd', sortCode: '040004', accountNumber: '12345678' },
  amount: { value: '10.50', currency: 'GBP' },
  reference: { reference: 'Order 1001' },
  ...over,
});

async function makeKey(orgId: string, userId: string, permissions = ['read', 'write']) {
  const k = await generateApiKey();
  await t.admin((pg) =>
    pg.query(`insert into api_keys (organization_id, name, key_hash, key_prefix, permissions, created_by) values ($1, 'test', $2, $3, $4, $5)`, [orgId, k.hash, k.prefix, permissions, userId]),
  );
  return k.key;
}

const grant = (org: string, provider: string, status = 'approved') =>
  t.admin((pg) => pg.query(`insert into provider_access (organization_id, provider_code, status) values ($1, $2, $3) on conflict (organization_id, provider_code) do update set status = $3`, [org, provider, status]));

const api = (method: string, path: string, key: string | undefined, payload?: unknown, headers: Record<string, string> = {}) =>
  t.request(method, path, { body: payload, headers: { ...(key ? { 'x-api-key': key } : {}), ...headers } });

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const hostedToken = (paymentId: string, org: string, purpose: 'hosted-pages-access' | 'mock-bank-access' = 'hosted-pages-access', expiresIn = '1h') =>
  signPaymentToken(SECRET, { paymentId, organizationId: org, clientId: 'c', purpose }, expiresIn);

const usage = async (org: string) => (await t.rows(`select payments, successful_payments, failed_payments from billing_usage where organization_id = $1`, [org]))[0];

async function addUser(role: string, org: string, email: string) {
  const [u] = await t.admin((pg) => pg.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]).then((r) => r.rows));
  await t.admin((pg) => pg.query(`insert into profiles (id, email, first_name, last_name, role, organization_id) values ($1, $2, 'Test', 'Person', $3, $4)`, [u.id, email, role, org]));
  return u.id as string;
}

beforeEach(async () => {
  calls = [];
  respond = (url, method) => {
    if (method === 'POST' && url.endsWith('/v2/payments')) {
      return { body: { payment: { id: 'tok_123', status: 'INITIATION_PENDING_REDIRECT_AUTH', authentication: { redirectUrl: 'https://bank.test/auth/abc' }, secretInternal: 'SHOULD-NOT-LEAK' } } };
    }
    if (method === 'GET') return { body: { payment: { id: 'tok_123', status: 'SETTLEMENT_COMPLETED' } } };
    return { status: 200, body: {} };
  };
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: init?.headers as any });
    const r = await respond(url, method);
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  };
  t = await createTestApp({ env: TOKEN_ENV, fetch });
  keyA = await makeKey(t.ids.orgA, t.ids.userA);
  keyB = await makeKey(t.ids.orgB, t.ids.userB);
}, 60000);

describe('creating payments', () => {
  it('creates a Mock bank payment with no credentials and sends the customer to the bank page', async () => {
    t = await createTestApp({ fetch: t.deps.fetch }); // no provider credentials at all
    keyA = await makeKey(t.ids.orgA, t.ids.userA);
    const res = await api('POST', '/api/payments', keyA, body());
    expect(res.status).toBe(201);
    const d = res.json.data;
    expect(d).toMatchObject({ status: 'AUTHORIZING', provider: 'mock', amount: { value: '10.50', currency: 'GBP' } });
    expect(d).not.toHaveProperty('hostedPageUrl');
    expect(d.paymentId).toMatch(/^pay_[0-9a-f]{28}$/);

    const url = new URL(d.redirectUrl);
    expect(url.origin + url.pathname).toBe(`http://localhost:3002/pay/${d.paymentId}`);
    const claims = await verifyPaymentToken(SECRET, url.searchParams.get('token')!, 'mock-bank-access');
    expect(claims).toMatchObject({ paymentId: d.paymentId, organizationId: t.ids.orgA });
    expect(calls).toEqual([]);

    const history = await t.rows(`select h.status from payment_status_history h join payments p on p.id = h.payment_id where p.payment_id = $1 order by h.id`, [d.paymentId]);
    expect(history.map((h) => h.status)).toEqual(['PENDING', 'AUTHORIZING']);
    expect(await usage(t.ids.orgA)).toMatchObject({ payments: 1 });
  });

  it('returns 503 for the Mock bank when it has no URL, and stores nothing', async () => {
    t = await createTestApp({ config: { ...t.deps.config, mockBankUrl: undefined } });
    keyA = await makeKey(t.ids.orgA, t.ids.userA);
    const res = await api('POST', '/api/payments', keyA, body());
    expect(res.status).toBe(503);
    expect(await t.rows(`select 1 from payments where organization_id = $1 and payment_id <> 'pay_a1'`, [t.ids.orgA])).toEqual([]);
  });

  it('defaults the provider to mock', async () => {
    const res = await api('POST', '/api/payments', keyA, body());
    expect(res.json.data.provider).toBe('mock');
  });

  it.each([
    ['10.50', '10.50'],
    ['0.10', '0.10'],
    ['10.5', '10.50'],
    ['1234.5678', '1234.5678'],
    ['0.0001', '0.0001'],
    [10.5, '10.50'],
    ['9007199254740993.10', '9007199254740993.10'], // beyond what a JS float can hold
  ])('keeps the amount %s exact (%s)', async (input, expected) => {
    const res = await api('POST', '/api/payments', keyA, body({ amount: { value: input, currency: 'gbp' } }));
    expect(res.status).toBe(201);
    expect(res.json.data.amount).toEqual({ value: expected, currency: 'GBP' });
    const got = await api('GET', `/api/payments/${res.json.data.paymentId}`, keyA);
    expect(got.json.data.amount).toEqual({ value: expected, currency: 'GBP' });
  });

  it.each([
    ['no toAccount', { toAccount: undefined }],
    ['no account number or iban', { toAccount: { accountName: 'Acme' } }],
    ['no account name', { toAccount: { sortCode: '040004', accountNumber: '12345678' } }],
    ['no amount', { amount: undefined }],
    ['zero', { amount: { value: '0', currency: 'GBP' } }],
    ['0.00', { amount: { value: '0.00', currency: 'GBP' } }],
    ['negative', { amount: { value: '-5', currency: 'GBP' } }],
    ['text', { amount: { value: '10abc', currency: 'GBP' } }],
    ['too many decimals', { amount: { value: '1.00001', currency: 'GBP' } }],
    ['exponent', { amount: { value: '1e3', currency: 'GBP' } }],
    ['bad currency', { amount: { value: '1', currency: 'POUNDS' } }],
    ['script redirect', { redirectUrl: 'javascript:alert(1)' }],
    ['bad flow', { flowType: 'SIDEWAYS' }],
    ['embedded without bank', { flowType: 'EMBEDDED_HOSTED_PAGES' }],
    ['bad provider code', { provider: 'Token; drop table' }],
  ])('rejects %s with 400 and stores nothing', async (_name, over) => {
    const res = await api('POST', '/api/payments', keyA, body(over));
    expect(res.status).toBe(400);
    expect(res.json.success).toBe(false);
    expect(await t.rows(`select 1 from payments where organization_id = $1 and payment_id <> 'pay_a1'`, [t.ids.orgA])).toEqual([]);
  });

  it('requires an API key with write permission', async () => {
    expect((await api('POST', '/api/payments', undefined, body())).status).toBe(401);
    expect((await api('POST', '/api/payments', 'sk_nope', body())).status).toBe(401);
    const readOnly = await makeKey(t.ids.orgA, t.ids.userA, ['read']);
    expect((await api('POST', '/api/payments', readOnly, body())).status).toBe(403);
    expect((await api('GET', '/api/payments', readOnly)).status).toBe(200);
  });

  it('does not accept a user sign-in token in place of an API key', async () => {
    const res = await t.request('POST', '/api/payments', { user: t.ids.userA, body: body() });
    expect(res.status).toBe(401);
  });
});

describe('provider approval is enforced', () => {
  it('refuses an unapproved provider with 403 PROVIDER_NOT_APPROVED before calling it or storing anything', async () => {
    const res = await api('POST', '/api/payments', keyA, body({ provider: 'token' }));
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe('PROVIDER_NOT_APPROVED');
    expect(calls).toEqual([]);
    expect(await t.rows(`select 1 from payments where organization_id = $1 and payment_id <> 'pay_a1'`, [t.ids.orgA])).toEqual([]);
  });

  it('refuses pending, rejected and revoked, allows approved, and only for the approved organization', async () => {
    for (const status of ['pending', 'rejected', 'revoked']) {
      await grant(t.ids.orgA, 'token', status);
      expect((await api('POST', '/api/payments', keyA, body({ provider: 'token' }))).status).toBe(403);
    }
    await grant(t.ids.orgA, 'token', 'approved');
    const ok = await api('POST', '/api/payments', keyA, body({ provider: 'token' }));
    expect(ok.status).toBe(201);
    expect(calls).toHaveLength(1);

    const other = await api('POST', '/api/payments', keyB, body({ provider: 'token' }));
    expect(other.status).toBe(403);

    await grant(t.ids.orgA, 'token', 'revoked');
    expect((await api('POST', '/api/payments', keyA, body({ provider: 'token' }))).status).toBe(403);
  });

  it('does not let a client name a provider that is unknown, or approved but without a payment adapter', async () => {
    expect((await api('POST', '/api/payments', keyA, body({ provider: 'nonesuch' }))).status).toBe(403);
    await grant(t.ids.orgA, 'yapily', 'approved');
    const res = await api('POST', '/api/payments', keyA, body({ provider: 'yapily' }));
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('PROVIDER_NOT_SUPPORTED');
  });

  it('lists the providers the key may use', async () => {
    expect((await api('GET', '/api/payments/providers', keyA)).json.data.providers.map((p: any) => p.id)).toEqual(['mock']);
    await grant(t.ids.orgA, 'token');
    await grant(t.ids.orgA, 'yapily');
    expect((await api('GET', '/api/payments/providers', keyA)).json.data.providers.map((p: any) => p.id)).toEqual(['mock', 'token']);
  });
});

describe('real provider (Token.io)', () => {
  beforeEach(() => grant(t.ids.orgA, 'token'));

  it('creates the payment at the provider with credentials from the environment only', async () => {
    const res = await api('POST', '/api/payments', keyA, body({ provider: 'token', redirectUrl: 'https://shop.test/return', bankId: 'gb-demo' }));
    expect(res.status).toBe(201);
    expect(res.json.data).toMatchObject({ status: 'AUTHORIZING', redirectUrl: 'https://bank.test/auth/abc', provider: 'token' });

    const [call] = calls;
    expect(call.url).toBe('https://token.test/v2/payments');
    expect(call.headers.Authorization).toBe('Basic test-token-key');
    expect(call.body.initiation).toMatchObject({
      amount: { value: '10.50', currency: 'GBP' },
      localInstrument: 'FASTER_PAYMENTS',
      bankId: 'gb-demo',
      callbackUrl: 'https://shop.test/return',
    });

    // The provider's own fields never reach the caller
    expect(JSON.stringify(res.json)).not.toContain('SHOULD-NOT-LEAK');
    const [row] = await t.rows(`select provider_payment_id, provider_redirect_url, provider_data from payments where payment_id = $1`, [res.json.data.paymentId]);
    expect(row.provider_payment_id).toBe('tok_123');
    expect(row.provider_redirect_url).toBe('https://bank.test/auth/abc');
  });

  it('answers 503 Provider is not configured, never crashing, when credentials are missing', async () => {
    t = await createTestApp({ env: {} });
    keyA = await makeKey(t.ids.orgA, t.ids.userA);
    await grant(t.ids.orgA, 'token');
    const res = await api('POST', '/api/payments', keyA, body({ provider: 'token' }));
    expect(res.status).toBe(503);
    expect(res.json.error.message).toBe('Provider is not configured');
    expect(await t.rows(`select 1 from payments where payment_id <> 'pay_a1' and organization_id = $1`, [t.ids.orgA])).toEqual([]);
  });

  it('marks the payment FAILED and answers 502, without provider detail, when the provider errors', async () => {
    respond = () => ({ status: 500, body: { error: 'internal secret detail' } });
    const res = await api('POST', '/api/payments', keyA, body({ provider: 'token' }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.json)).not.toContain('internal secret detail');
    const [p] = await t.rows(`select status, error_code from payments where organization_id = $1 and payment_id <> 'pay_a1'`, [t.ids.orgA]);
    expect(p).toMatchObject({ status: 'FAILED', error_code: 'PROVIDER_ERROR' });
    expect(await usage(t.ids.orgA)).toMatchObject({ payments: 1, failed_payments: 1 });
  });

  it('times out slow providers with 504', async () => {
    t.deps.fetch = async () => {
      throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    };
    const res = await api('POST', '/api/payments', keyA, body({ provider: 'token' }));
    expect(res.status).toBe(504);
  });

  it('passes an AbortSignal timeout to every provider call', async () => {
    let signal: AbortSignal | undefined;
    t.deps.fetch = async (_i, init) => {
      signal = init?.signal ?? undefined;
      return new Response(JSON.stringify({ payment: { id: 'tok_9', status: 'INITIATION_PENDING' } }));
    };
    await api('POST', '/api/payments', keyA, body({ provider: 'token' }));
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('syncs the status from the provider, completes the payment and counts it once', async () => {
    const created = await api('POST', '/api/payments', keyA, body({ provider: 'token' }));
    const id = created.json.data.paymentId;

    const synced = await api('POST', `/api/payments/${id}/sync`, keyA);
    expect(synced.status).toBe(200);
    expect(synced.json.data.status).toBe('COMPLETED');
    expect(synced.json.data.completedAt).toBeTruthy();
    expect(synced.json.data.statusHistory.map((h: any) => h.status)).toEqual(['PENDING', 'AUTHORIZING', 'COMPLETED']);

    await api('POST', `/api/payments/${id}/sync`, keyA);
    expect(await usage(t.ids.orgA)).toMatchObject({ payments: 1, successful_payments: 1, failed_payments: 0 });
  });

  it('refuses to sync or cancel once the provider is revoked, without calling it', async () => {
    const created = await api('POST', '/api/payments', keyA, body({ provider: 'token' }));
    const id = created.json.data.paymentId;
    await grant(t.ids.orgA, 'token', 'revoked');
    calls.length = 0;

    for (const path of [`/api/payments/${id}/sync`, `/api/payments/${id}/cancel`]) {
      const res = await api('POST', path, keyA);
      expect(res.status).toBe(403);
      expect(res.json.error.code).toBe('PROVIDER_NOT_APPROVED');
    }
    expect(calls).toEqual([]);
    // Reading the payment still works, from local data, and still makes no provider call
    const got = await api('GET', `/api/payments/${id}`, keyA);
    expect(got.status).toBe(200);
    expect(calls).toEqual([]);
  });

  it('tells the provider about a cancellation', async () => {
    const created = await api('POST', '/api/payments', keyA, body({ provider: 'token' }));
    const res = await api('POST', `/api/payments/${created.json.data.paymentId}/cancel`, keyA);
    expect(res.json.data.status).toBe('CANCELLED');
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE', url: 'https://token.test/v2/payments/tok_123' });
  });
});

describe('reading, listing and cancelling', () => {
  it('gets a payment with its history', async () => {
    const res = await api('GET', '/api/payments/pay_a1', keyA);
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({ paymentId: 'pay_a1', status: 'PENDING', provider: 'mock', amount: { value: '10.50', currency: 'GBP' } });
    expect(res.json.data.statusHistory).toHaveLength(1);
    expect(res.json.data).not.toHaveProperty('providerData');
    expect(res.json.data).not.toHaveProperty('organizationId');
  });

  it('answers 404 for a payment that does not exist', async () => {
    expect((await api('GET', '/api/payments/pay_missing', keyA)).status).toBe(404);
    expect((await api('POST', '/api/payments/pay_missing/cancel', keyA)).status).toBe(404);
  });

  it('lists newest first, filters and paginates', async () => {
    for (const v of ['1.00', '2.00', '3.00']) await api('POST', '/api/payments', keyA, body({ amount: { value: v, currency: 'GBP' } }));
    const all = await api('GET', '/api/payments', keyA);
    expect(all.json.data).toMatchObject({ total: 4, limit: 20, offset: 0 });
    expect(all.json.data.payments[0].amount.value).toBe('3.00');

    const page = await api('GET', '/api/payments?limit=2&offset=2', keyA);
    expect(page.json.data.payments).toHaveLength(2);
    expect(page.json.data).toMatchObject({ total: 4, limit: 2, offset: 2 });

    expect((await api('GET', '/api/payments?status=AUTHORIZING', keyA)).json.data.total).toBe(3);
    expect((await api('GET', '/api/payments?provider=token', keyA)).json.data.total).toBe(0);
    expect((await api('GET', '/api/payments?status=BOGUS', keyA)).status).toBe(400);
    expect((await api('GET', '/api/payments?limit=1000', keyA)).status).toBe(400);
  });

  it('cancels, records it, and refuses a second cancel with 409', async () => {
    const res = await api('POST', '/api/payments/pay_a1/cancel', keyA);
    expect(res.status).toBe(200);
    expect(res.json.data.status).toBe('CANCELLED');
    expect(res.json.data.statusHistory.map((h: any) => h.status)).toEqual(['PENDING', 'CANCELLED']);

    const again = await api('POST', '/api/payments/pay_a1/cancel', keyA);
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe('PAYMENT_NOT_CANCELLABLE');
  });

  it.each(['COMPLETED', 'FAILED', 'EXPIRED'])('refuses to cancel a %s payment with 409', async (status) => {
    await t.admin((pg) => pg.query(`update payments set status = $1 where payment_id = 'pay_a1'`, [status]));
    expect((await api('POST', '/api/payments/pay_a1/cancel', keyA)).status).toBe(409);
  });

  it('expires a payment nobody finished, the next time it is read', async () => {
    await t.admin((pg) => pg.query(`update payments set expires_at = now() - interval '1 minute' where payment_id = 'pay_a1'`));
    const res = await api('GET', '/api/payments/pay_a1', keyA);
    expect(res.json.data.status).toBe('EXPIRED');
    expect((await api('POST', '/api/payments/pay_a1/cancel', keyA)).status).toBe(409);
  });

  it('sees every payment of the organization, whichever of its keys created it', async () => {
    const second = await makeKey(t.ids.orgA, t.ids.userA);
    const created = await api('POST', '/api/payments', keyA, body());
    expect((await api('GET', `/api/payments/${created.json.data.paymentId}`, second)).status).toBe(200);
  });
});

describe('tenant isolation', () => {
  it('keeps each organization out of the other one, in both directions', async () => {
    // A cannot see B's payment
    expect((await api('GET', '/api/payments/pay_b1', keyA)).status).toBe(404);
    expect((await api('POST', '/api/payments/pay_b1/cancel', keyA)).status).toBe(404);
    expect((await api('POST', '/api/payments/pay_b1/sync', keyA)).status).toBe(404);
    expect((await api('GET', '/api/payments', keyA)).json.data.payments.map((p: any) => p.paymentId)).toEqual(['pay_a1']);

    // B cannot see A's payment
    expect((await api('GET', '/api/payments/pay_a1', keyB)).status).toBe(404);
    expect((await api('POST', '/api/payments/pay_a1/cancel', keyB)).status).toBe(404);
    expect((await api('GET', '/api/payments', keyB)).json.data.payments.map((p: any) => p.paymentId)).toEqual(['pay_b1']);

    // Neither cancel changed anything
    const rows = await t.rows(`select payment_id, status from payments order by payment_id`);
    expect(rows.every((r) => r.status === 'PENDING')).toBe(true);
  });

  it('keeps a payment token from reaching another organization or payment', async () => {
    const forgedOrg = await hostedToken('pay_b1', t.ids.orgA); // right payment id, wrong organization
    const res = await t.request('GET', '/api/payments/pay_b1/hosted', { token: forgedOrg });
    expect(res.status).toBe(404);
  });
});

describe('hosted payment pages', () => {
  const create = async (over: Record<string, unknown> = {}) => (await api('POST', '/api/payments', keyA, body({ flowType: 'HOSTED_PAGES', redirectUrl: 'https://shop.test/return', ...over }))).json.data;

  it('returns the hosted page as the one redirectUrl and does not start the bank flow yet', async () => {
    const d = await create();
    expect(d.redirectUrl).toContain('/sessions/');
    expect(d).not.toHaveProperty('hostedPageUrl');
    expect(d.status).toBe('PENDING');
  });

  it('returns a hosted page URL whose token opens exactly that payment', async () => {
    const d = await create();
    const url = new URL(d.redirectUrl);
    expect(url.origin + url.pathname).toBe(`http://localhost:3001/sessions/${d.paymentId}`);
    expect(url.searchParams.get('redirect_uri')).toBe('https://shop.test/return');

    const token = url.searchParams.get('token')!;
    const res = await t.request('GET', `/api/payments/${d.paymentId}/hosted`, { token });
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({
      paymentId: d.paymentId,
      amount: { value: '10.50', currency: 'GBP' },
      toAccount: { accountName: 'Acme Coffee Ltd' },
      merchant: { name: 'Acme Coffee', redirectUri: 'https://shop.test/return' },
    });
    expect(res.json.data).not.toHaveProperty('organizationId');
  });

  it('requires a valid payment token for this payment and purpose', async () => {
    const d = await create();
    const get = (token?: string) => t.request('GET', `/api/payments/${d.paymentId}/hosted`, { token });

    expect((await get()).status).toBe(401);
    expect((await get('garbage')).status).toBe(401);
    expect((await get(await hostedToken(d.paymentId, t.ids.orgA, 'mock-bank-access'))).status).toBe(401);
    expect((await get(await hostedToken(d.paymentId, t.ids.orgA, 'hosted-pages-access', '-1m'))).status).toBe(401);
    expect((await get(await hostedToken('pay_other', t.ids.orgA))).status).toBe(403);
    expect((await get(await hostedToken(d.paymentId, t.ids.orgA))).status).toBe(200);
    // An API key is not a payment token
    expect((await api('GET', `/api/payments/${d.paymentId}/hosted`, keyA)).status).toBe(401);
  });

  it('shows the status through the status endpoint', async () => {
    const d = await create();
    const token = await hostedToken(d.paymentId, t.ids.orgA);
    const res = await t.request('GET', `/api/payments/${d.paymentId}/status`, { token });
    expect(res.status).toBe(200);
    expect(res.json.data.status).toBe('PENDING');
    expect((await t.request('GET', `/api/payments/pay_a1/status`, { token })).status).toBe(403);
    expect((await t.request('GET', `/api/payments/${d.paymentId}/status`)).status).toBe(401);
  });

  it('reports a payment as expired once its time is up', async () => {
    const d = await create();
    await t.admin((pg) => pg.query(`update payments set expires_at = now() - interval '1 second' where payment_id = $1`, [d.paymentId]));
    const res = await t.request('GET', `/api/payments/${d.paymentId}/hosted`, { token: await hostedToken(d.paymentId, t.ids.orgA) });
    expect(res.json.data.status).toBe('EXPIRED');
  });

  it('initiates a Mock bank payment by returning the bank page link', async () => {
    const d = await create();
    const token = await hostedToken(d.paymentId, t.ids.orgA);
    const res = await t.request('POST', '/api/payments/initiate', { token, body: { paymentId: d.paymentId, bankId: 'any', flowType: 'API_ONLY' } });
    expect(res.status).toBe(200);
    expect(res.json.data.status).toBe('AUTHORIZING');
    expect(new URL(res.json.data.redirectUrl).pathname).toBe(`/pay/${d.paymentId}`);
  });

  it('starts a real provider payment only when the customer has chosen a bank, and only once', async () => {
    await grant(t.ids.orgA, 'token');
    const d = await create({ provider: 'token' });
    expect(d.status).toBe('PENDING');
    expect(d.redirectUrl).toContain('/sessions/');
    expect(calls).toEqual([]);

    const token = await hostedToken(d.paymentId, t.ids.orgA);
    const res = await t.request('POST', '/api/payments/initiate', { token, body: { paymentId: d.paymentId, bankId: 'gb-demo', redirectUri: 'https://evil.test' } });
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({ status: 'AUTHORIZING', redirectUrl: 'https://bank.test/auth/abc' });
    expect(calls).toHaveLength(1);
    expect(calls[0].body.initiation.bankId).toBe('gb-demo');
    // The redirect the customer returns to was fixed at creation; the page's value is not used
    expect(calls[0].body.initiation.callbackUrl).toBe('https://shop.test/return');

    const again = await t.request('POST', '/api/payments/initiate', { token, body: { paymentId: d.paymentId, bankId: 'gb-demo' } });
    expect(again.json.data.redirectUrl).toBe('https://bank.test/auth/abc');
    expect(calls).toHaveLength(1);
  });

  it('refuses to initiate with a token for another payment, a bad body, or a revoked provider', async () => {
    await grant(t.ids.orgA, 'token');
    const d = await create({ provider: 'token' });
    const token = await hostedToken(d.paymentId, t.ids.orgA);

    expect((await t.request('POST', '/api/payments/initiate', { body: { paymentId: d.paymentId, bankId: 'x' } })).status).toBe(401);
    expect((await t.request('POST', '/api/payments/initiate', { token, body: { paymentId: 'pay_a1', bankId: 'x' } })).status).toBe(403);
    expect((await t.request('POST', '/api/payments/initiate', { token, body: { paymentId: d.paymentId } })).status).toBe(400);

    await grant(t.ids.orgA, 'token', 'revoked');
    const res = await t.request('POST', '/api/payments/initiate', { token, body: { paymentId: d.paymentId, bankId: 'x' } });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe('PROVIDER_NOT_APPROVED');
    expect(calls).toEqual([]);
  });

  it('lets the customer cancel with the payment token, but only their own payment', async () => {
    const d = await create();
    const token = await hostedToken(d.paymentId, t.ids.orgA);
    expect((await t.request('POST', `/api/payments/${d.paymentId}/cancel`, { token: await hostedToken('pay_a1', t.ids.orgA) })).status).toBe(403);
    expect((await t.request('POST', `/api/payments/${d.paymentId}/cancel`)).status).toBe(401);

    const res = await t.request('POST', `/api/payments/${d.paymentId}/cancel`, { token });
    expect(res.status).toBe(200);
    expect(res.json.data.status).toBe('CANCELLED');
  });

  it('returns 503 for hosted flows when the hosted pages URL is not configured', async () => {
    t = await createTestApp({ config: { ...t.deps.config, hostedPagesUrl: undefined } });
    keyA = await makeKey(t.ids.orgA, t.ids.userA);
    expect((await api('POST', '/api/payments', keyA, body({ flowType: 'HOSTED_PAGES' }))).status).toBe(503);
  });
});

describe('admin payments', () => {
  let superId: string;
  let userId: string;
  beforeEach(async () => {
    superId = await addUser('superadmin', t.ids.orgA, 'root@syntropi.test');
    userId = await addUser('user', t.ids.orgA, 'plain@acme.test');
  });

  it('lets an org admin list only their own payments, with the organization and audit trail', async () => {
    const res = await t.request('GET', '/api/admin/payments', { user: t.ids.userA });
    expect(res.status).toBe(200);
    expect(res.json.data.payments.map((p: any) => p.paymentId)).toEqual(['pay_a1']);
    expect(res.json.data.pagination).toMatchObject({ total: 1, page: 1, limit: 20, pages: 1 });
    expect(res.json.data.payments[0]).toMatchObject({ organizationName: 'Acme Coffee', amount: { value: '10.50', currency: 'GBP' } });
    expect(res.json.data.payments[0].audit.statusChanges).toBe(1);
  });

  it('lets a superadmin see everything, and filter by organization', async () => {
    const all = await t.request('GET', '/api/admin/payments', { user: superId });
    expect(all.json.data.payments.map((p: any) => p.paymentId).sort()).toEqual(['pay_a1', 'pay_b1']);
    const b = await t.request('GET', `/api/admin/payments?organizationId=${t.ids.orgB}`, { user: superId });
    expect(b.json.data.payments.map((p: any) => p.paymentId)).toEqual(['pay_b1']);
  });

  it('refuses an org admin who asks for another organization, and plain users and anonymous callers', async () => {
    expect((await t.request('GET', `/api/admin/payments?organizationId=${t.ids.orgB}`, { user: t.ids.userA })).status).toBe(403);
    expect((await t.request('GET', '/api/admin/payments', { user: userId })).status).toBe(403);
    expect((await t.request('GET', '/api/admin/payments')).status).toBe(401);
    expect((await t.request('GET', '/api/admin/payments/pay_a1', { user: userId })).status).toBe(403);
  });

  it('returns a payment as data.payment with history, hiding other organizations as 404', async () => {
    const own = await t.request('GET', '/api/admin/payments/pay_a1', { user: t.ids.userA });
    expect(own.json.data.payment).toMatchObject({ paymentId: 'pay_a1', status: 'PENDING' });
    expect(own.json.data.payment.statusHistory).toHaveLength(1);
    expect((await t.request('GET', '/api/admin/payments/pay_b1', { user: t.ids.userA })).status).toBe(404);
    expect((await t.request('GET', '/api/admin/payments/pay_b1', { user: superId })).status).toBe(200);
    expect((await t.request('GET', '/api/admin/payments/nope', { user: superId })).status).toBe(404);
  });

  it('validates filters', async () => {
    expect((await t.request('GET', '/api/admin/payments?status=NOPE', { user: superId })).status).toBe(400);
    expect((await t.request('GET', '/api/admin/payments?startDate=yesterday-ish', { user: superId })).status).toBe(400);
    expect((await t.request('GET', '/api/admin/payments?organizationId=not-an-id', { user: superId })).status).toBe(400);
  });

  it('computes analytics in SQL, exactly', async () => {
    await t.admin((pg) =>
      pg.query(`insert into payments (payment_id, organization_id, client_id, to_account, amount_value, currency, provider_code, status) values
        ('pay_x1', $1, 'c', '{"accountName":"A"}', 0.10, 'GBP', 'mock', 'COMPLETED'),
        ('pay_x2', $1, 'c', '{"accountName":"A"}', 0.20, 'GBP', 'mock', 'COMPLETED'),
        ('pay_x3', $1, 'c', '{"accountName":"A"}', 5.00, 'EUR', 'token', 'FAILED')`, [t.ids.orgA]),
    );
    const res = await t.request('GET', '/api/admin/payments/analytics', { user: t.ids.userA });
    expect(res.status).toBe(200);
    const a = res.json.data.analytics;
    // 0.10 + 0.20 is exactly 0.30 here, not 0.30000000000000004
    expect(a.summary).toEqual({ totalPayments: 4, totalVolume: '15.80', averageAmount: '3.95' });
    expect(a.breakdown.byStatus).toEqual([
      { status: 'COMPLETED', count: 2, volume: '0.30' },
      { status: 'FAILED', count: 1, volume: '5.00' },
      { status: 'PENDING', count: 1, volume: '10.50' },
    ]);
    expect(a.breakdown.byProvider).toEqual([
      { provider: 'mock', count: 3, volume: '10.80' },
      { provider: 'token', count: 1, volume: '5.00' },
    ]);
    expect(a.breakdown.byCurrency.map((c: any) => [c.currency, c.volume])).toEqual([['GBP', '10.80'], ['EUR', '5.00']]);
    expect(res.json.data.period.startDate < res.json.data.period.endDate).toBe(true);

    const filtered = await t.request('GET', '/api/admin/payments/analytics?status=FAILED', { user: t.ids.userA });
    expect(filtered.json.data.analytics.summary.totalPayments).toBe(1);

    const platform = await t.request('GET', '/api/admin/payments/analytics', { user: superId });
    expect(platform.json.data.analytics.summary.totalPayments).toBe(5);
    expect((await t.request('GET', `/api/admin/payments/analytics?organizationId=${t.ids.orgB}`, { user: t.ids.userA })).status).toBe(403);
  });
});
