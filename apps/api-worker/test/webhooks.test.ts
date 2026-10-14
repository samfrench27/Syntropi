import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/app';

const SECRET = 'whsec_test_secret_value';
let t: TestApp;

const event = (id: string | undefined, providerPaymentId: string, status: string, extra: Record<string, unknown> = {}) => ({
  ...(id ? { id } : {}),
  type: 'payment.status_changed',
  data: { object: { id: providerPaymentId, status, ...extra } },
});
const post = (payload: unknown, headers: Record<string, string> = { 'x-webhook-secret': SECRET }) =>
  t.app.request('/api/webhooks/token', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) });
const status = async (id = 'pay_a1') => (await t.rows(`select status, error_message from payments where payment_id = $1`, [id]))[0];
const history = async (id = 'pay_a1') =>
  (await t.rows(`select h.status from payment_status_history h join payments p on p.id = h.payment_id where p.payment_id = $1 order by h.id`, [id])).map((h) => h.status);
const usage = async () => (await t.rows(`select successful_payments, failed_payments from billing_usage where organization_id = $1`, [t.ids.orgA]))[0];

async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))), (b) => b.toString(16).padStart(2, '0')).join('');
}

beforeEach(async () => {
  t = await createTestApp({ env: { TOKEN_WEBHOOK_SECRET: SECRET } as any }) // not in Bindings yet;
  await t.admin((pg) => pg.query(`update payments set provider_code = 'token', provider_payment_id = 'tok_a1', status = 'AUTHORIZING' where payment_id = 'pay_a1'`));
}, 60000);

describe('webhook health', () => {
  it('answers without authentication', async () => {
    const res = await t.request('GET', '/api/webhooks/health');
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ success: true, message: 'Webhook endpoint is active' });
  });
});

describe('webhook authentication', () => {
  it('rejects a missing or wrong secret with 401 and changes nothing', async () => {
    expect((await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'), {})).status).toBe(401);
    expect((await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'), { 'x-webhook-secret': 'wrong' })).status).toBe(401);
    expect((await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'), { 'x-webhook-secret': SECRET + 'x' })).status).toBe(401);
    expect((await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'), { 'x-webhook-signature': 'deadbeef' })).status).toBe(401);
    expect((await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'), { Authorization: `Bearer ${SECRET}` })).status).toBe(401);
    expect((await status()).status).toBe('AUTHORIZING');
    expect(await t.rows(`select 1 from webhook_events`)).toEqual([]);
  });

  it('rejects everything when no secret is configured, even an empty one', async () => {
    t = await createTestApp({ env: {} });
    expect((await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'), { 'x-webhook-secret': '' })).status).toBe(401);
    expect((await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'), { 'x-webhook-secret': 'undefined' })).status).toBe(401);
    expect((await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'))).status).toBe(401);
  });

  it('accepts a valid HMAC signature of the body', async () => {
    const body = JSON.stringify(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'));
    const sig = await hmac(SECRET, body);
    expect((await post(body, { 'x-webhook-signature': `sha256=${sig}` })).status).toBe(200);
    expect((await status()).status).toBe('COMPLETED');
    // A signature for a different body does not work
    const other = JSON.stringify(event('e2', 'tok_a1', 'INITIATION_FAILED'));
    expect((await post(other, { 'x-webhook-signature': sig })).status).toBe(401);
  });
});

describe('webhook processing', () => {
  it('applies the status from the provider and writes history', async () => {
    const res = await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'Webhook received' });
    expect((await status()).status).toBe('COMPLETED');
    expect(await history()).toEqual(['PENDING', 'COMPLETED']);
    expect(await usage()).toMatchObject({ successful_payments: 1, failed_payments: 0 });
  });

  it('records a failure with its reason and counts it', async () => {
    await post(event('e1', 'tok_a1', 'INITIATION_REJECTED_INSUFFICIENT_FUNDS', { statusReasonInformation: 'Insufficient funds' }));
    expect(await status()).toEqual({ status: 'FAILED', error_message: 'Insufficient funds' });
    expect(await usage()).toMatchObject({ successful_payments: 0, failed_payments: 1 });
  });

  it.each([
    ['INITIATION_PENDING_REDIRECT_AUTH', 'AUTHORIZING'],
    ['INITIATION_PENDING_REDEMPTION', 'AUTHORIZED'],
    ['INITIATION_PROCESSING', 'SUBMITTED'],
    ['INITIATION_COMPLETED', 'ACCEPTED'],
    ['SETTLEMENT_IN_PROGRESS', 'ACCEPTED'],
    ['SETTLEMENT_COMPLETED', 'COMPLETED'],
    ['INITIATION_FAILED', 'FAILED'],
    ['SETTLEMENT_INCOMPLETE', 'FAILED'],
    ['INITIATION_DECLINED', 'CANCELLED'],
    ['INITIATION_EXPIRED', 'EXPIRED'],
  ])('maps %s to %s', async (providerStatus, expected) => {
    await t.admin((pg) => pg.query(`update payments set status = 'PENDING' where payment_id = 'pay_a1'`));
    await post(event('e-' + providerStatus, 'tok_a1', providerStatus));
    expect((await status()).status).toBe(expected);
  });

  it('is idempotent: a retried event does nothing the second time', async () => {
    const e = event('evt_same', 'tok_a1', 'SETTLEMENT_COMPLETED');
    expect((await post(e)).status).toBe(200);
    expect((await post(e)).status).toBe(200);
    expect((await post(e)).status).toBe(200);
    expect(await history()).toEqual(['PENDING', 'COMPLETED']);
    expect(await usage()).toMatchObject({ successful_payments: 1 });
    expect(await t.rows(`select 1 from webhook_events where event_id = 'evt_same'`)).toHaveLength(1);
  });

  it('de-duplicates events that carry no id by their content', async () => {
    const e = event(undefined, 'tok_a1', 'INITIATION_FAILED');
    await post(e);
    await post(e);
    expect(await history()).toEqual(['PENDING', 'FAILED']);
    expect(await usage()).toMatchObject({ failed_payments: 1 });
  });

  it('never moves a finished payment, nor backwards', async () => {
    await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'));
    await post(event('e2', 'tok_a1', 'INITIATION_FAILED'));
    await post(event('e3', 'tok_a1', 'INITIATION_PENDING_REDIRECT_AUTH'));
    expect((await status()).status).toBe('COMPLETED');
    expect(await usage()).toMatchObject({ successful_payments: 1, failed_payments: 0 });

    await t.admin((pg) => pg.query(`update payments set status = 'SUBMITTED' where payment_id = 'pay_a1'`));
    await post(event('e4', 'tok_a1', 'INITIATION_PENDING_REDIRECT_AUTH')); // late and out of order
    await post(event('e5', 'tok_a1', 'MYSTERY_STATUS'));
    expect((await status()).status).toBe('SUBMITTED');
  });

  it('answers 200 the same way for an unknown payment, and records nothing', async () => {
    const known = await (await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'))).json();
    const unknown = await post(event('e2', 'tok_nobody', 'SETTLEMENT_COMPLETED'));
    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual(known);
    expect(await t.rows(`select 1 from webhook_events where event_id = 'e2'`)).toEqual([]);
  });

  it('looks payments up by provider and provider id, so another provider or organization is untouched', async () => {
    await t.admin((pg) => pg.query(`update payments set provider_payment_id = 'tok_a1' where payment_id = 'pay_b1'`)); // a mock payment with the same id
    await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'));
    expect((await status('pay_a1')).status).toBe('COMPLETED');
    expect((await status('pay_b1')).status).toBe('PENDING');
  });

  it('trusts the body only for identification and status', async () => {
    await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED', { amount: 999999, currency: 'USD', reference: 'hacked', initiation: { refId: 'pay_b1' } }));
    expect((await status('pay_b1')).status).toBe('PENDING');
    const [p] = await t.rows(`select amount_value::text as amount, currency, reference from payments where payment_id = 'pay_a1'`);
    expect(p).toEqual({ amount: '10.5000', currency: 'GBP', reference: null });
  });

  it('rejects malformed payloads with 400', async () => {
    expect((await post('not json')).status).toBe(400);
    expect((await post({ data: {} })).status).toBe(400);
    expect((await post({ data: { object: { id: 'tok_a1' } } })).status).toBe(400);
  });

  it('rolls the event back if applying it fails, so a retry still works', async () => {
    let fail = true;
    // Break payment_set_status once; the whole transaction (including the recorded event) must roll back
    const spy = t.deps.db as any;
    const originalTx = spy.tx.bind(spy);
    spy.tx = (fn: any) =>
      originalTx((tx: any) =>
        fn({
          ...tx,
          query: (text: string, params?: unknown[]) => {
            if (fail && text.includes('payment_set_status')) throw new Error('boom');
            return tx.query(text, params);
          },
        }),
      );
    const failed = await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'));
    expect(failed.status).toBe(500);
    expect(await t.rows(`select 1 from webhook_events`)).toEqual([]);
    fail = false;
    expect((await post(event('e1', 'tok_a1', 'SETTLEMENT_COMPLETED'))).status).toBe(200);
    expect((await status()).status).toBe('COMPLETED');
  });
});
