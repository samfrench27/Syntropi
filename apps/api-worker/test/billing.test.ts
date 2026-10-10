import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/app';
import { EXTRA, PERIOD_END, STRIPE_ENV, fakeStripe, postWebhook, seedExtraUsers, stripeEvent, stripeSession, stripeSub } from './billingFake';

let t: TestApp;
let stripe: ReturnType<typeof fakeStripe>;

async function setup(env: Record<string, string | undefined> = STRIPE_ENV) {
  stripe = fakeStripe();
  t = await createTestApp({ env, fetch: stripe.fetch });
  await seedExtraUsers(t);
}
beforeEach(() => setup(), 60000);

const setCustomer = (org: string, id: string) => t.admin((pg) => pg.query(`update organizations set stripe_customer_id = $1 where id = $2`, [id, org]));
const subRows = (org?: string) => t.rows(`select * from subscriptions ${org ? `where organization_id = '${org}'` : ''} order by created_at`);
const orgRow = async (id: string) => (await t.rows(`select plan, stripe_customer_id from organizations where id = $1`, [id]))[0];
const activities = async (action: string) => t.rows(`select * from activities where action = $1`, [action]);

describe('auth on client billing', () => {
  it('needs a sign-in', async () => {
    for (const [m, p] of [['GET', '/subscription'], ['POST', '/subscription'], ['PUT', '/subscription'], ['DELETE', '/subscription'], ['GET', '/usage'], ['POST', '/portal'], ['POST', '/checkout/success']]) {
      expect((await t.request(m, `/api/client/billing${p}`)).status, `${m} ${p}`).toBe(401);
    }
  });

  it('lets plain users read usage and nothing else', async () => {
    expect((await t.request('GET', '/api/client/billing/usage', { user: EXTRA.plainA })).status).toBe(200);
    for (const [m, p, body] of [
      ['GET', '/subscription'],
      ['POST', '/subscription', { plan: 'starter' }],
      ['PUT', '/subscription', { plan: 'growth' }],
      ['DELETE', '/subscription'],
      ['POST', '/portal', {}],
      ['POST', '/checkout/success', { sessionId: 'cs_test_1' }],
    ] as const) {
      expect((await t.request(m, `/api/client/billing${p}`, { user: EXTRA.plainA, body })).status, `${m} ${p}`).toBe(403);
    }
    expect(stripe.state.calls).toEqual([]);
  });
});

describe('GET /subscription', () => {
  it('says there is no subscription, and lists the plans', async () => {
    const { status, json } = await t.request('GET', '/api/client/billing/subscription', { user: t.ids.userA });
    expect(status).toBe(200);
    expect(json.data.subscription).toBeNull();
    expect(json.data.plans.growth).toMatchObject({ priceId: 'price_growth', limits: { payments: 1000, apiCalls: 10000, users: 25 } });
    expect(json.data.plans.enterprise.limits.payments).toBe(-1);
  });

  it('shows only the caller organization subscription', async () => {
    await setCustomer(t.ids.orgB, 'cus_b');
    await t.admin((pg) =>
      pg.query(
        `insert into subscriptions (organization_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_product_id, plan, status, current_period_start, current_period_end)
         values ($1, 'cus_b', 'sub_b', 'price_growth', 'prod_growth', 'growth', 'active', now(), now() + interval '30 days')`,
        [t.ids.orgB],
      ),
    );
    const a = await t.request('GET', '/api/client/billing/subscription', { user: t.ids.userA });
    expect(a.json.data.subscription).toBeNull();
    const b = await t.request('GET', '/api/client/billing/subscription', { user: t.ids.userB });
    expect(b.json.data).toMatchObject({ plan: 'growth', status: 'active', subscription: { stripeSubscriptionId: 'sub_b' } });
    expect(b.json.data.lastEventAt).toBeUndefined();
  });
});

describe('POST /subscription (checkout)', () => {
  it('creates a customer and a checkout session tagged with the organization', async () => {
    const { status, json } = await t.request('POST', '/api/client/billing/subscription', { user: t.ids.userA, body: { plan: 'growth' } });
    expect(status).toBe(200);
    expect(json.data).toEqual({ checkoutUrl: 'https://checkout.stripe.test/cs_test_created', sessionId: 'cs_test_created' });

    const create = stripe.state.calls.find((c) => c.path === '/v1/checkout/sessions')!;
    expect(create.body['line_items[0][price]']).toBe('price_growth');
    expect(create.body['metadata[organizationId]']).toBe(t.ids.orgA);
    expect(create.body['subscription_data[metadata][plan]']).toBe('growth');
    expect(create.body.success_url).toContain('http://localhost:3000/org-admin/billing?success=true');
    expect(create.body.customer).toBe('cus_new_1');
    expect((await orgRow(t.ids.orgA)).stripe_customer_id).toBe('cus_new_1');
    expect(await activities('client.billing.subscribe')).toHaveLength(1);
    // Nothing is active until Stripe says so
    expect(await subRows()).toEqual([]);
    expect((await orgRow(t.ids.orgA)).plan).toBe('free');
  });

  it('reuses the existing customer', async () => {
    await setCustomer(t.ids.orgA, 'cus_existing');
    await t.request('POST', '/api/client/billing/subscription', { user: t.ids.userA, body: { plan: 'starter' } });
    expect(stripe.state.calls.some((c) => c.path === '/v1/customers')).toBe(false);
    expect(stripe.state.calls.find((c) => c.path === '/v1/checkout/sessions')!.body.customer).toBe('cus_existing');
  });

  it('validates the plan', async () => {
    for (const body of [{}, { plan: 'platinum' }, { plan: 'free' }, { plan: 7 }]) {
      expect((await t.request('POST', '/api/client/billing/subscription', { user: t.ids.userA, body })).status).toBe(400);
    }
  });

  it('refuses to start a second subscription', async () => {
    await setCustomer(t.ids.orgA, 'cus_test_1');
    stripe.state.subs.set('sub_test_1', stripeSub());
    await t.request('POST', '/api/client/billing/checkout/success', { user: t.ids.userA, body: { sessionId: 'cs_test_1' } }); // no such session
    await t.admin((pg) =>
      pg.query(
        `insert into subscriptions (organization_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_product_id, plan, status, current_period_start, current_period_end)
         values ($1, 'cus_test_1', 'sub_test_1', 'price_starter', 'prod_starter', 'starter', 'active', now(), now() + interval '30 days')`,
        [t.ids.orgA],
      ),
    );
    const { status } = await t.request('POST', '/api/client/billing/subscription', { user: t.ids.userA, body: { plan: 'growth' } });
    expect(status).toBe(409);
  });

  it('answers 503 when Stripe is not configured, and when the plan has no price', async () => {
    await setup({});
    const r = await t.request('POST', '/api/client/billing/subscription', { user: t.ids.userA, body: { plan: 'starter' } });
    expect(r.status).toBe(503);
    expect(r.json.error.message).toBe('Billing is not configured');

    await setup({ STRIPE_SECRET_KEY: 'sk_test_x' });
    expect((await t.request('POST', '/api/client/billing/subscription', { user: t.ids.userA, body: { plan: 'starter' } })).status).toBe(503);
    expect(stripe.state.calls).toEqual([]);
  });

  it('never exposes Stripe error detail', async () => {
    stripe.state.failOn.add('POST /v1/customers');
    const r = await t.request('POST', '/api/client/billing/subscription', { user: t.ids.userA, body: { plan: 'starter' } });
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.json)).not.toContain('boom');
  });
});

describe('POST /checkout/success', () => {
  const session = (over: Record<string, any> = {}) => {
    const s = stripeSession({ metadata: { organizationId: t.ids.orgA, plan: 'growth' }, subscription: 'sub_test_1', ...over });
    stripe.state.sessions.set(s.id, s);
    stripe.state.subs.set('sub_test_1', stripeSub({ plan: 'growth' }));
    return s;
  };
  const call = (sessionId = 'cs_test_1', user = t.ids.userA) => t.request('POST', '/api/client/billing/checkout/success', { user, body: { sessionId } });

  it('verifies the session with Stripe and activates the plan', async () => {
    session();
    const { status, json } = await call();
    expect(status).toBe(200);
    expect(json).toMatchObject({ success: true, message: 'Subscription activated successfully', data: { plan: 'growth', status: 'active' } });

    const [row] = await subRows(t.ids.orgA);
    expect(row).toMatchObject({ plan: 'growth', status: 'active', stripe_price_id: 'price_growth', stripe_customer_id: 'cus_test_1' });
    expect(new Date(row.current_period_end).getTime()).toBe(PERIOD_END * 1000);
    expect(await orgRow(t.ids.orgA)).toEqual({ plan: 'growth', stripe_customer_id: 'cus_test_1' });
    expect(await activities('client.billing.checkout')).toHaveLength(1);
  });

  it('is idempotent', async () => {
    session();
    await call();
    const first = await subRows();
    expect((await call()).status).toBe(200);
    const second = await subRows();
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ id: first[0].id, plan: 'growth' });
  });

  it('rejects a session that belongs to another organization, and changes nothing', async () => {
    session({ metadata: { organizationId: t.ids.orgB, plan: 'enterprise' } });
    const { status } = await call('cs_test_1', t.ids.userA);
    expect(status).toBe(403);
    expect(await subRows()).toEqual([]);
    expect((await orgRow(t.ids.orgA)).plan).toBe('free');
    expect((await orgRow(t.ids.orgB)).plan).toBe('free');
  });

  it('rejects sessions without our tag, unfinished checkouts and unknown ids', async () => {
    session({ metadata: {} });
    expect((await call()).status).toBe(403);
    session({ status: 'open' });
    expect((await call()).status).toBe(409);
    expect((await call('cs_test_missing')).status).toBe(404);
    expect((await call('not-a-session')).status).toBe(400);
    expect(await subRows()).toEqual([]);
  });

  it('refuses a Stripe customer that differs from the organization one', async () => {
    await setCustomer(t.ids.orgA, 'cus_other');
    session();
    expect((await call()).status).toBe(409);
    expect(await subRows()).toEqual([]);
  });

  it('gives the same result whichever of the webhook and the redirect arrives first', async () => {
    const s = session();
    const event = stripeEvent('checkout.session.completed', s);
    const normalise = (r: any) => ({ plan: r.plan, status: r.status, price: r.stripe_price_id, sub: r.stripe_subscription_id, cust: r.stripe_customer_id, end: r.current_period_end });

    // webhook first
    expect((await postWebhook(t, event)).status).toBe(200);
    expect((await call()).status).toBe(200);
    const webhookFirst = { subs: (await subRows()).map(normalise), org: await orgRow(t.ids.orgA) };

    // redirect first, on a fresh database
    await setup();
    const s2 = session();
    expect((await call()).status).toBe(200);
    expect((await postWebhook(t, stripeEvent('checkout.session.completed', s2))).status).toBe(200);
    const redirectFirst = { subs: (await subRows()).map(normalise), org: await orgRow(t.ids.orgA) };

    expect(webhookFirst.subs).toHaveLength(1);
    expect(redirectFirst).toEqual(webhookFirst);
    expect(webhookFirst.org.plan).toBe('growth');
  });

  it('answers 503 without Stripe configured', async () => {
    await setup({});
    expect((await call()).status).toBe(503);
  });
});

describe('PUT /subscription', () => {
  beforeEach(async () => {
    stripe.state.subs.set('sub_test_1', stripeSub());
    stripe.state.sessions.set('cs_test_1', stripeSession({ metadata: { organizationId: t.ids.orgA, plan: 'starter' }, subscription: 'sub_test_1' }));
    await t.request('POST', '/api/client/billing/checkout/success', { user: t.ids.userA, body: { sessionId: 'cs_test_1' } });
    stripe.state.calls.length = 0;
  });

  it('changes the plan in Stripe and here', async () => {
    const { status, json } = await t.request('PUT', '/api/client/billing/subscription', { user: t.ids.userA, body: { plan: 'enterprise' } });
    expect(status).toBe(200);
    expect(json.data).toMatchObject({ plan: 'enterprise', stripePriceId: 'price_enterprise' });
    expect(stripe.state.calls.find((c) => c.method === 'POST' && c.path === '/v1/subscriptions/sub_test_1')!.body['items[0][price]']).toBe('price_enterprise');
    expect((await orgRow(t.ids.orgA)).plan).toBe('enterprise');
    expect(await activities('client.billing.update')).toHaveLength(1);
  });

  it('validates the plan and needs an existing subscription', async () => {
    expect((await t.request('PUT', '/api/client/billing/subscription', { user: t.ids.userA, body: { plan: 'nope' } })).status).toBe(400);
    expect((await t.request('PUT', '/api/client/billing/subscription', { user: t.ids.userB, body: { plan: 'growth' } })).status).toBe(404);
  });

  it('never touches another organization subscription', async () => {
    await t.request('PUT', '/api/client/billing/subscription', { user: t.ids.userB, body: { plan: 'growth' } });
    expect((await subRows(t.ids.orgA))[0].plan).toBe('starter');
  });
});

describe('DELETE /subscription', () => {
  beforeEach(async () => {
    stripe.state.subs.set('sub_test_1', stripeSub({ plan: 'growth' }));
    stripe.state.sessions.set('cs_test_1', stripeSession({ metadata: { organizationId: t.ids.orgA, plan: 'growth' }, subscription: 'sub_test_1' }));
    await t.request('POST', '/api/client/billing/checkout/success', { user: t.ids.userA, body: { sessionId: 'cs_test_1' } });
  });

  it('cancels at the end of the period by default and keeps the plan', async () => {
    const { status, json } = await t.request('DELETE', '/api/client/billing/subscription', { user: t.ids.userA });
    expect(status).toBe(200);
    expect(json.data).toMatchObject({ cancelAtPeriodEnd: true, status: 'active' });
    expect((await orgRow(t.ids.orgA)).plan).toBe('growth');
    expect(await activities('client.billing.cancel')).toHaveLength(1);
  });

  it('cancels immediately when asked, and drops the organization to free', async () => {
    const { status, json } = await t.request('DELETE', '/api/client/billing/subscription', { user: t.ids.userA, body: { cancelAtPeriodEnd: false } });
    expect(status).toBe(200);
    expect(json.data.status).toBe('canceled');
    expect((await orgRow(t.ids.orgA)).plan).toBe('free');
    expect((await t.request('DELETE', '/api/client/billing/subscription', { user: t.ids.userA })).status).toBe(404);
  });

  it('does not accept the old deleteSubscription flag to wipe the row', async () => {
    await t.request('DELETE', '/api/client/billing/subscription', { user: t.ids.userA, body: { deleteSubscription: true } });
    expect(await subRows(t.ids.orgA)).toHaveLength(1);
  });

  it('404s for an organization with no subscription', async () => {
    expect((await t.request('DELETE', '/api/client/billing/subscription', { user: t.ids.userB })).status).toBe(404);
  });
});

describe('POST /portal', () => {
  it('opens the portal for the organization customer, returning to the dashboard by default', async () => {
    await setCustomer(t.ids.orgA, 'cus_a');
    const { status, json } = await t.request('POST', '/api/client/billing/portal', { user: t.ids.userA });
    expect(status).toBe(200);
    expect(json.data.url).toBe('https://portal.stripe.test/s/1');
    const call = stripe.state.calls.find((c) => c.path === '/v1/billing_portal/sessions')!;
    expect(call.body).toMatchObject({ customer: 'cus_a', return_url: 'http://localhost:3000/org-admin/billing' });
  });

  it('only returns to our own front ends', async () => {
    expect((await t.request('POST', '/api/client/billing/portal', { user: t.ids.userA, body: { returnUrl: 'https://evil.example/steal' } })).status).toBe(400);
    expect((await t.request('POST', '/api/client/billing/portal', { user: t.ids.userA, body: { returnUrl: 'not a url' } })).status).toBe(400);
    expect((await t.request('POST', '/api/client/billing/portal', { user: t.ids.userA, body: { returnUrl: 'http://localhost:3000/x' } })).status).toBe(200);
  });

  it('answers 503 without Stripe configured', async () => {
    await setup({});
    expect((await t.request('POST', '/api/client/billing/portal', { user: t.ids.userA })).status).toBe(503);
  });
});

describe('GET /usage', () => {
  const NOW = new Date('2026-10-15T12:00:00Z');
  beforeEach(async () => {
    t = await createTestApp({ env: STRIPE_ENV, fetch: stripe.fetch, now: () => NOW });
    await seedExtraUsers(t);
    await t.admin(async (pg) => {
      await pg.query(`select billing_increment($1, '2026-10', 7, 40, 5, 2)`, [t.ids.orgA]);
      await pg.query(`select billing_increment($1, '2026-08', 3, 9, 3, 0)`, [t.ids.orgA]);
      await pg.query(`select billing_increment($1, '2026-10', 99, 999, 90, 9)`, [t.ids.orgB]);
      await pg.query(`update organizations set plan = 'growth' where id = $1`, [t.ids.orgA]);
    });
  });

  it('returns the last N months oldest first, zero-filled, with plan limits', async () => {
    const { status, json } = await t.request('GET', '/api/client/billing/usage?months=4', { user: t.ids.userA });
    expect(status).toBe(200);
    expect(json.data.map((m: any) => m.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(json.data[1].usage).toEqual({ payments: 3, apiCalls: 9, successfulPayments: 3, failedPayments: 0 });
    expect(json.data[2].usage).toEqual({ payments: 0, apiCalls: 0, successfulPayments: 0, failedPayments: 0 });
    expect(json.data[3]).toMatchObject({ year: 2026, usage: { payments: 7, apiCalls: 40, successfulPayments: 5, failedPayments: 2 }, limits: { paymentsLimit: 1000, apiCallsLimit: 10000, usersLimit: 25 } });
  });

  it('defaults to six months, validates months, and is open to plain users', async () => {
    expect((await t.request('GET', '/api/client/billing/usage', { user: EXTRA.plainA })).json.data).toHaveLength(6);
    expect((await t.request('GET', '/api/client/billing/usage?months=0', { user: t.ids.userA })).status).toBe(400);
    expect((await t.request('GET', '/api/client/billing/usage?months=99', { user: t.ids.userA })).status).toBe(400);
  });

  it('never shows another organization usage', async () => {
    const b = await t.request('GET', '/api/client/billing/usage?months=1', { user: t.ids.userB });
    expect(b.json.data[0].usage.payments).toBe(99);
    const a = await t.request('GET', '/api/client/billing/usage?months=1', { user: t.ids.userA });
    expect(a.json.data[0].usage.payments).toBe(7);
  });
});
