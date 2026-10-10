import { beforeEach, describe, expect, it } from 'vitest';
import { generateApiKey } from '../src/lib/crypto';
import { signPaymentToken } from '../src/lib/paymentToken';
import { createTestApp, type TestApp } from './helpers/app';

const SECRET = 'test-hosted-pages-secret-0123456789';
let t: TestApp;
let key: string;

const token = (paymentId: string, org = t.ids.orgA, purpose: 'hosted-pages-access' | 'mock-bank-access' = 'mock-bank-access', expiresIn = '30m') =>
  signPaymentToken(SECRET, { paymentId, organizationId: org, clientId: 'c', purpose }, expiresIn);
const get = (id: string, tok?: string) => t.request('GET', `/api/mock-bank/payments/${id}`, { token: tok });
const decide = (id: string, tok: string | undefined, decision: unknown) => t.request('POST', `/api/mock-bank/payments/${id}/decision`, { token: tok, body: { decision } });

async function create(over: Record<string, unknown> = {}) {
  const res = await t.request('POST', '/api/payments', {
    headers: { 'x-api-key': key },
    body: { toAccount: { accountName: 'Acme', sortCode: '040004', accountNumber: '12345678' }, amount: { value: '10.50', currency: 'GBP' }, reference: 'Order 7', redirectUrl: 'https://shop.test/return?cart=9', ...over },
  });
  expect(res.status).toBe(201);
  const url = new URL(res.json.data.redirectUrl);
  return { id: res.json.data.paymentId as string, tok: url.searchParams.get('token')! };
}
const usage = async () => (await t.rows(`select payments, successful_payments, failed_payments from billing_usage where organization_id = $1`, [t.ids.orgA]))[0];

beforeEach(async () => {
  t = await createTestApp();
  const k = await generateApiKey();
  key = k.key;
  await t.admin((pg) => pg.query(`insert into api_keys (organization_id, name, key_hash, key_prefix, permissions, created_by) values ($1, 'k', $2, $3, '{read,write}', $4)`, [t.ids.orgA, k.hash, k.prefix, t.ids.userA]));
}, 60000);

describe('Mock bank', () => {
  it('shows the bank page just what it needs', async () => {
    const { id, tok } = await create();
    const res = await get(id, tok);
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual({
      paymentId: id,
      merchant: { name: 'Acme Coffee' },
      organizationName: 'Acme Coffee',
      amount: { value: '10.50', currency: 'GBP' },
      currency: 'GBP',
      reference: 'Order 7',
      status: 'AUTHORIZING',
      expiresAt: expect.any(String),
    });
  });

  it('approves: COMPLETED, counted, history written, and the customer is sent back with the result', async () => {
    const { id, tok } = await create();
    const res = await decide(id, tok, 'approve');
    expect(res.status).toBe(200);
    expect(res.json.data.status).toBe('COMPLETED');
    const back = new URL(res.json.data.redirectUrl);
    expect(back.origin + back.pathname).toBe('https://shop.test/return');
    expect(Object.fromEntries(back.searchParams)).toEqual({ cart: '9', paymentId: id, status: 'COMPLETED' });

    const [p] = await t.rows(`select status, completed_at from payments where payment_id = $1`, [id]);
    expect(p.status).toBe('COMPLETED');
    expect(p.completed_at).toBeTruthy();
    const hist = await t.rows(`select h.status from payment_status_history h join payments p on p.id = h.payment_id where p.payment_id = $1 order by h.id`, [id]);
    expect(hist.map((h) => h.status)).toEqual(['PENDING', 'AUTHORIZING', 'COMPLETED']);
    expect(await usage()).toMatchObject({ payments: 1, successful_payments: 1, failed_payments: 0 });
    // The merchant sees it through the API
    expect((await t.request('GET', `/api/payments/${id}`, { headers: { 'x-api-key': key } })).json.data.status).toBe('COMPLETED');
  });

  it('rejects: FAILED with USER_REJECTED, counted as failed', async () => {
    const { id, tok } = await create();
    const res = await decide(id, tok, 'reject');
    expect(res.json.data.status).toBe('FAILED');
    expect(new URL(res.json.data.redirectUrl).searchParams.get('status')).toBe('FAILED');
    expect((await t.rows(`select status, error_code from payments where payment_id = $1`, [id]))[0]).toEqual({ status: 'FAILED', error_code: 'USER_REJECTED' });
    expect(await usage()).toMatchObject({ successful_payments: 0, failed_payments: 1 });
    const api = await t.request('GET', `/api/payments/${id}`, { headers: { 'x-api-key': key } });
    expect(api.json.data.error.code).toBe('USER_REJECTED');
  });

  it('returns no redirect when the merchant gave none', async () => {
    const { id, tok } = await create({ redirectUrl: undefined });
    expect((await decide(id, tok, 'approve')).json.data).toEqual({ status: 'COMPLETED', redirectUrl: null });
  });

  it('decides only once: a second decision is 409 and changes nothing', async () => {
    const { id, tok } = await create();
    await decide(id, tok, 'approve');
    expect((await decide(id, tok, 'reject')).status).toBe(409);
    expect((await decide(id, tok, 'approve')).status).toBe(409);
    expect((await t.rows(`select status from payments where payment_id = $1`, [id]))[0].status).toBe('COMPLETED');
    expect(await usage()).toMatchObject({ successful_payments: 1, failed_payments: 0 });
    // The page can still look at the result
    expect((await get(id, tok)).json.data.status).toBe('COMPLETED');
  });

  it('will not decide a cancelled payment', async () => {
    const { id, tok } = await create();
    await t.request('POST', `/api/payments/${id}/cancel`, { headers: { 'x-api-key': key } });
    expect((await decide(id, tok, 'approve')).status).toBe(409);
  });

  it('refuses an invalid decision', async () => {
    const { id, tok } = await create();
    expect((await decide(id, tok, 'maybe')).status).toBe(400);
    expect((await decide(id, tok, undefined)).status).toBe(400);
    expect((await t.rows(`select status from payments where payment_id = $1`, [id]))[0].status).toBe('AUTHORIZING');
  });

  it('answers 410 and marks the payment EXPIRED once its time is up', async () => {
    const { id, tok } = await create();
    await t.admin((pg) => pg.query(`update payments set expires_at = now() - interval '1 minute' where payment_id = $1`, [id]));
    const res = await decide(id, tok, 'approve');
    expect(res.status).toBe(410);
    expect((await t.rows(`select status from payments where payment_id = $1`, [id]))[0].status).toBe('EXPIRED');
    expect((await get(id, tok)).status).toBe(410);
    expect((await decide(id, tok, 'approve')).status).toBe(410);
    expect(await usage()).toMatchObject({ successful_payments: 0 });
  });

  it('is authenticated only by a token with the right purpose, for the right payment', async () => {
    const { id, tok } = await create();
    const other = await create();

    expect((await get(id)).status).toBe(401);
    expect((await get(id, 'garbage')).status).toBe(401);
    expect((await get(id, await token(id, t.ids.orgA, 'hosted-pages-access'))).status).toBe(401); // wrong purpose
    expect((await get(id, await token(id, t.ids.orgA, 'mock-bank-access', '-1m'))).status).toBe(401); // expired token
    expect((await get(id, other.tok)).status).toBe(403); // another payment's token
    expect((await decide(id, other.tok, 'approve')).status).toBe(403);
    expect((await decide(id, await token(id, t.ids.orgA, 'hosted-pages-access'), 'approve')).status).toBe(401);
    expect((await decide(id, undefined, 'approve')).status).toBe(401);
    // A signed-in user's access token is not a bank token either
    expect((await t.request('GET', `/api/mock-bank/payments/${id}`, { user: t.ids.userA })).status).toBe(401);
    expect((await t.request('GET', `/api/mock-bank/payments/${id}`, { headers: { 'x-api-key': key } })).status).toBe(401);

    expect((await t.rows(`select status from payments where payment_id = $1`, [id]))[0].status).toBe('AUTHORIZING');
    expect((await get(id, tok)).status).toBe(200);
  });

  it('does not reach another organization, even with a token naming the right payment id', async () => {
    const { id } = await create();
    expect((await get(id, await token(id, t.ids.orgB))).status).toBe(404);
    expect((await decide(id, await token(id, t.ids.orgB), 'approve')).status).toBe(404);
  });

  it('only works for Mock bank payments', async () => {
    await t.admin((pg) => pg.query(`update payments set provider_code = 'token', status = 'AUTHORIZING' where payment_id = 'pay_a1'`));
    expect((await get('pay_a1', await token('pay_a1'))).status).toBe(404);
    expect((await decide('pay_a1', await token('pay_a1'), 'approve')).status).toBe(404);
    expect((await t.rows(`select status from payments where payment_id = 'pay_a1'`))[0].status).toBe('AUTHORIZING');
  });

  it('does not offer a decision for a payment that was never sent to the bank', async () => {
    const { id, tok } = await create();
    await t.admin((pg) => pg.query(`update payments set status = 'PENDING' where payment_id = $1`, [id]));
    expect((await decide(id, tok, 'approve')).status).toBe(409);
  });
});
