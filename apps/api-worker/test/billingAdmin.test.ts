import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/app';
import { EXTRA, STRIPE_ENV, fakeStripe, seedExtraUsers, stripeSub } from './billingFake';

let t: TestApp;
let stripe: ReturnType<typeof fakeStripe>;
const NOW = new Date('2026-10-15T12:00:00Z');

async function setup(env: Record<string, string | undefined> = STRIPE_ENV) {
  stripe = fakeStripe();
  t = await createTestApp({ env, fetch: stripe.fetch, now: () => NOW });
  await seedExtraUsers(t);
}
beforeEach(() => setup(), 60000);

const addSub = (org: string, over: Record<string, string> = {}) =>
  t.admin((pg) =>
    pg.query(
      `insert into subscriptions (organization_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_product_id, plan, status, current_period_start, current_period_end)
       values ($1, $2, $3, 'price_x', 'prod_x', $4, $5, now(), now() + interval '30 days')`,
      [org, over.customer ?? `cus_${org.slice(-2)}`, over.sub ?? `sub_${org.slice(-2)}`, over.plan ?? 'growth', over.status ?? 'active'],
    ),
  );

const ROUTES: [string, string, unknown?][] = [
  ['GET', '/subscriptions'],
  ['GET', '/revenue'],
  ['GET', '/stripe-account'],
  ['GET', '/customers'],
  ['GET', '/metrics'],
  ['PUT', '/organizations/00000000-0000-0000-0000-0000000000a1/plan', { plan: 'growth' }],
];

describe('admin billing auth', () => {
  it('needs a sign-in', async () => {
    for (const [m, p, body] of ROUTES) expect((await t.request(m, `/api/admin/billing${p}`, { body })).status, p).toBe(401);
  });

  it('is for the superadmin only: org admins and users are refused', async () => {
    for (const user of [t.ids.userA, EXTRA.plainA]) {
      for (const [m, p, body] of ROUTES) expect((await t.request(m, `/api/admin/billing${p}`, { user, body })).status, `${user} ${p}`).toBe(403);
    }
    expect((await t.request('GET', '/api/admin/billing/metrics', { user: EXTRA.superadmin })).status).toBe(200);
    expect(stripe.state.calls).toEqual([]);
  });
});

describe('GET /subscriptions', () => {
  beforeEach(async () => {
    await addSub(t.ids.orgA, { plan: 'starter' });
    await addSub(t.ids.orgB, { plan: 'growth', status: 'past_due' });
  });

  it('lists subscriptions with the organization attached, Express style', async () => {
    const { status, json } = await t.request('GET', '/api/admin/billing/subscriptions', { user: EXTRA.superadmin });
    expect(status).toBe(200);
    expect(json.data.pagination).toMatchObject({ total: 2, limit: 50, offset: 0, hasMore: false });
    const sub = json.data.subscriptions.find((s: any) => s.plan === 'growth');
    expect(sub).toMatchObject({
      _id: sub.id,
      status: 'past_due',
      organizationId: { name: 'Borealis Retail', contactEmail: 'b@borealis.test' },
    });
    expect(sub.lastEventAt).toBeUndefined();
  });

  it('filters, paginates and validates', async () => {
    const f = await t.request('GET', '/api/admin/billing/subscriptions?plan=starter', { user: EXTRA.superadmin });
    expect(f.json.data.subscriptions.map((s: any) => s.plan)).toEqual(['starter']);
    const s = await t.request('GET', '/api/admin/billing/subscriptions?status=past_due', { user: EXTRA.superadmin });
    expect(s.json.data.pagination.total).toBe(1);
    const p = await t.request('GET', '/api/admin/billing/subscriptions?limit=1&page=2', { user: EXTRA.superadmin });
    expect(p.json.data.subscriptions).toHaveLength(1);
    expect(p.json.data.pagination).toMatchObject({ total: 2, limit: 1, offset: 1, hasMore: false, pages: 2 });
    expect((await t.request('GET', '/api/admin/billing/subscriptions?status=bogus', { user: EXTRA.superadmin })).status).toBe(400);
    expect((await t.request('GET', '/api/admin/billing/subscriptions?limit=1000', { user: EXTRA.superadmin })).status).toBe(400);
  });
});

describe('GET /revenue', () => {
  const charge = (amount: number, over: Record<string, any> = {}) => ({ id: `ch_${amount}`, object: 'charge', amount, amount_refunded: 0, currency: 'gbp', paid: true, refunded: false, ...over });

  beforeEach(async () => {
    await addSub(t.ids.orgA, { plan: 'starter' });
    await addSub(t.ids.orgB, { plan: 'growth' });
  });

  it('sums charges in integer pence and counts subscriptions from the database', async () => {
    stripe.state.charges = [charge(1000), charge(5000, { amount_refunded: 1500 }), charge(15000, { refunded: true, amount_refunded: 15000 }), charge(999, { paid: false }), charge(4000, { currency: 'usd' })];
    const { status, json } = await t.request('GET', '/api/admin/billing/revenue?startDate=2026-09-01&endDate=2026-10-01', { user: EXTRA.superadmin });
    expect(status).toBe(200);
    expect(json.data.revenue).toMatchObject({
      totalRevenueMinor: 21000,
      refundsMinor: 16500,
      netRevenueMinor: 4500,
      totalRevenue: 210,
      refunds: 165,
      netRevenue: 45,
      currency: 'GBP',
    });
    expect(json.data.subscriptions).toEqual({
      active: 2,
      total: 2,
      planDistribution: [
        { _id: 'starter', count: 1 },
        { _id: 'growth', count: 1 },
      ],
    });
    const call = stripe.state.calls.find((c) => c.path === '/v1/charges')!;
    expect(call.body['created[gte]']).toBe(String(Math.floor(Date.parse('2026-09-01') / 1000)));
  });

  it('defaults to the last 30 days, validates dates, answers 503 without Stripe', async () => {
    await t.request('GET', '/api/admin/billing/revenue', { user: EXTRA.superadmin });
    const call = stripe.state.calls.find((c) => c.path === '/v1/charges')!;
    expect(Number(call.body['created[lte]']) - Number(call.body['created[gte]'])).toBe(30 * 86400);
    expect((await t.request('GET', '/api/admin/billing/revenue?startDate=nonsense', { user: EXTRA.superadmin })).status).toBe(400);
    expect((await t.request('GET', '/api/admin/billing/revenue?startDate=2026-10-02&endDate=2026-10-01', { user: EXTRA.superadmin })).status).toBe(400);
    await setup({});
    const r = await t.request('GET', '/api/admin/billing/revenue', { user: EXTRA.superadmin });
    expect(r.status).toBe(503);
    expect(r.json.error.message).toBe('Billing is not configured');
  });
});

describe('GET /stripe-account and /customers (database only)', () => {
  it('count and list the organizations that have Stripe customers', async () => {
    await t.admin((pg) => pg.query(`update organizations set stripe_customer_id = 'cus_a', billing_email = 'billing@acme.test' where id = $1`, [t.ids.orgA]));
    await addSub(t.ids.orgA, { customer: 'cus_a', plan: 'starter' });

    const acct = await t.request('GET', '/api/admin/billing/stripe-account', { user: EXTRA.superadmin });
    expect(acct.json.data).toEqual({ totalCustomers: 1, activeSubscriptions: 1 });

    const { json } = await t.request('GET', '/api/admin/billing/customers', { user: EXTRA.superadmin });
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({
      id: 'cus_a',
      email: 'billing@acme.test',
      name: 'Acme Coffee',
      organization: { name: 'Acme Coffee', plan: 'free' },
      subscription: { plan: 'starter', status: 'active' },
    });
    expect(typeof json.data[0].created).toBe('number');
    expect(stripe.state.calls).toEqual([]);
  });

  it('works with Stripe unconfigured', async () => {
    await setup({});
    expect((await t.request('GET', '/api/admin/billing/stripe-account', { user: EXTRA.superadmin })).status).toBe(200);
    expect((await t.request('GET', '/api/admin/billing/customers', { user: EXTRA.superadmin })).status).toBe(200);
  });
});

describe('GET /metrics', () => {
  it('reports platform numbers for the current month', async () => {
    await t.admin(async (pg) => {
      await pg.query(`update organizations set plan = 'growth' where id = $1`, [t.ids.orgA]);
      await pg.query(`update organizations set plan = 'starter', status = 'inactive' where id = $1`, [t.ids.orgB]);
      await pg.query(`select billing_increment($1, '2026-10', 10, 100, 8, 2)`, [t.ids.orgA]);
      await pg.query(`select billing_increment($1, '2026-10', 5, 50, 5, 0)`, [t.ids.orgB]);
      await pg.query(`select billing_increment($1, '2026-09', 99, 99, 99, 0)`, [t.ids.orgB]);
      // pay_a1 and pay_b1 (seeded, PENDING) are made this month too; add outcomes
      await pg.query(`update payments set created_at = '2026-10-03T10:00:00Z'`);
      await pg.query(
        `insert into payments (payment_id, organization_id, client_id, to_account, amount_value, currency, provider_code, status, created_at) values
          ('p_ok1', $1, 'c', '{}', 12.34, 'GBP', 'mock', 'COMPLETED', '2026-10-05T10:00:00Z'),
          ('p_ok2', $2, 'c', '{}', 0.10, 'GBP', 'mock', 'COMPLETED', '2026-10-06T10:00:00Z'),
          ('p_ok3', $2, 'c', '{}', 7.00, 'EUR', 'mock', 'COMPLETED', '2026-10-07T10:00:00Z'),
          ('p_bad', $1, 'c', '{}', 50.00, 'GBP', 'mock', 'FAILED', '2026-10-08T10:00:00Z'),
          ('p_old', $1, 'c', '{}', 99.00, 'GBP', 'mock', 'COMPLETED', '2026-09-20T10:00:00Z')`,
        [t.ids.orgA, t.ids.orgB],
      );
    });
    await addSub(t.ids.orgA, { plan: 'growth' });
    await addSub(t.ids.orgB, { plan: 'starter', status: 'canceled' });

    const { status, json } = await t.request('GET', '/api/admin/billing/metrics', { user: EXTRA.superadmin });
    expect(status).toBe(200);
    expect(json.data).toEqual({
      month: '2026-10',
      organizations: { total: 2, active: 1, byPlan: { free: 0, starter: 1, growth: 1, enterprise: 0 } },
      subscriptions: { total: 2, active: 1, pastDue: 0, canceled: 1, planDistribution: [{ _id: 'growth', count: 1 }] },
      usage: { payments: 15, apiCalls: 150, successfulPayments: 13, failedPayments: 2 },
      payments: {
        total: 6,
        successful: 3,
        failed: 1,
        successRate: 75,
        volumeByCurrency: [
          { currency: 'EUR', minor: 700 },
          { currency: 'GBP', minor: 1244 },
        ],
      },
    });
  });

  it('is all zeros on an empty platform', async () => {
    await t.admin((pg) => pg.exec(`delete from payments`));
    const { json } = await t.request('GET', '/api/admin/billing/metrics', { user: EXTRA.superadmin });
    expect(json.data.usage).toEqual({ payments: 0, apiCalls: 0, successfulPayments: 0, failedPayments: 0 });
    expect(json.data.payments).toEqual({ total: 0, successful: 0, failed: 0, successRate: 0, volumeByCurrency: [] });
  });
});

describe('PUT /organizations/:id/plan', () => {
  const put = (id: string, body: unknown, user = EXTRA.superadmin) => t.request('PUT', `/api/admin/billing/organizations/${id}/plan`, { user, body });
  const plan = async (id: string) => (await t.rows(`select plan from organizations where id = $1`, [id]))[0].plan;

  it('sets the plan of an organization with no subscription, without calling Stripe', async () => {
    const { status, json } = await put(t.ids.orgB, { plan: 'enterprise' });
    expect(status).toBe(200);
    expect(json.data).toMatchObject({ id: t.ids.orgB, plan: 'enterprise' });
    expect(await plan(t.ids.orgB)).toBe('enterprise');
    expect(await plan(t.ids.orgA)).toBe('free');
    expect(stripe.state.calls).toEqual([]);
    const [act] = await t.rows(`select * from activities where action = 'admin.billing.updatePlan'`);
    expect(act).toMatchObject({ organization_id: t.ids.orgB, user_id: EXTRA.superadmin });
    expect(act.details).toMatchObject({ from: 'free', to: 'enterprise', subscriptionUpdated: false });
  });

  it('changes the live subscription in Stripe too', async () => {
    stripe.state.subs.set('sub_test_1', stripeSub({ plan: 'starter' }));
    await addSub(t.ids.orgB, { customer: 'cus_test_1', sub: 'sub_test_1', plan: 'starter' });
    const { status } = await put(t.ids.orgB, { plan: 'growth' });
    expect(status).toBe(200);
    expect(stripe.state.calls.find((c) => c.method === 'POST' && c.path === '/v1/subscriptions/sub_test_1')!.body['items[0][price]']).toBe('price_growth');
    expect((await t.rows(`select plan from subscriptions where organization_id = $1`, [t.ids.orgB]))[0].plan).toBe('growth');
    expect(await plan(t.ids.orgB)).toBe('growth');
  });

  it('changes nothing when the live subscription cannot be changed in Stripe', async () => {
    await setup({});
    await addSub(t.ids.orgB, { plan: 'starter' });
    expect((await put(t.ids.orgB, { plan: 'growth' })).status).toBe(503);
    expect(await plan(t.ids.orgB)).toBe('free');
  });

  it('validates the id and the plan, and 404s for an unknown organization', async () => {
    expect((await put('not-a-uuid', { plan: 'growth' })).status).toBe(400);
    expect((await put(t.ids.orgA, { plan: 'platinum' })).status).toBe(400);
    expect((await put(t.ids.orgA, {})).status).toBe(400);
    expect((await put('00000000-0000-0000-0000-00000000ffff', { plan: 'growth' })).status).toBe(404);
    expect(await plan(t.ids.orgA)).toBe('free');
  });
});
