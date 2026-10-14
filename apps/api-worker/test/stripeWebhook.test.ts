import { beforeEach, describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { createTestApp, type TestApp } from './helpers/app';
import { STRIPE_ENV, WEBHOOK_SECRET, fakeStripe, postWebhook, stripeEvent, stripeSession, stripeSub } from './billingFake';

let t: TestApp;
let stripe: ReturnType<typeof fakeStripe>;

async function setup(env: Record<string, string | undefined> = STRIPE_ENV) {
  stripe = fakeStripe();
  t = await createTestApp({ env, fetch: stripe.fetch });
}
beforeEach(() => setup(), 60000);

const meta = () => ({ organizationId: t.ids.orgA, plan: 'growth' });
const subRows = () => t.rows(`select * from subscriptions order by created_at`);
const orgRow = async (id = t.ids.orgA) => (await t.rows(`select plan, stripe_customer_id from organizations where id = $1`, [id]))[0];
const events = () => t.rows(`select id, type from stripe_events order by received_at, id`);
const sec = (offset = 0) => Math.floor(Date.now() / 1000) + offset;

describe('POST /api/webhooks/stripe: signature', () => {
  const event = () => stripeEvent('customer.subscription.created', stripeSub({ plan: 'growth', metadata: meta() }));

  it('accepts a correctly signed event', async () => {
    const r = await postWebhook(t, event());
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ success: true, data: { received: true, duplicate: false } });
  });

  it('rejects a missing signature with 400, and changes nothing', async () => {
    expect((await postWebhook(t, event(), { header: null })).status).toBe(400);
    expect(await subRows()).toEqual([]);
    expect(await events()).toEqual([]);
  });

  it('rejects a bad signature, a wrong secret, a malformed header and a tampered body with 400', async () => {
    const e = event();
    expect((await postWebhook(t, e, { header: 't=1,v1=deadbeef' })).status).toBe(400);
    expect((await postWebhook(t, e, { secret: 'whsec_someone_else' })).status).toBe(400);
    expect((await postWebhook(t, e, { header: 'garbage' })).status).toBe(400);
    const payload = JSON.stringify(e);
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    expect((await postWebhook(t, e, { header, raw: payload.replace('"growth"', '"enterprise"') })).status).toBe(400);
    // An old timestamp is a replay attack
    const old = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET, timestamp: sec(-3600) });
    expect((await postWebhook(t, e, { header: old, raw: payload })).status).toBe(400);
    expect(await subRows()).toEqual([]);
  });

  it('answers 503 when the signing secret is not configured', async () => {
    await setup({ ...STRIPE_ENV, STRIPE_WEBHOOK_SECRET: undefined });
    expect((await postWebhook(t, event())).status).toBe(503);
  });

  it('needs no sign-in (Stripe is not a user)', async () => {
    expect((await postWebhook(t, event())).status).toBe(200);
  });
});

describe('subscription events', () => {
  it('creates the subscription and moves the organization to the plan', async () => {
    await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ plan: 'growth', metadata: meta() })));
    const [row] = await subRows();
    expect(row).toMatchObject({ organization_id: t.ids.orgA, plan: 'growth', status: 'active', stripe_subscription_id: 'sub_test_1', stripe_price_id: 'price_growth' });
    expect(await orgRow()).toEqual({ plan: 'growth', stripe_customer_id: 'cus_test_1' });
    expect((await t.rows(`select * from activities where action = 'billing.subscription.sync'`))).toHaveLength(1);
  });

  it('finds the organization by Stripe customer when there is no tag', async () => {
    await t.admin((pg) => pg.query(`update organizations set stripe_customer_id = 'cus_test_1' where id = $1`, [t.ids.orgB]));
    await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ plan: 'starter' })));
    expect((await subRows())[0].organization_id).toBe(t.ids.orgB);
    expect((await orgRow(t.ids.orgA)).plan).toBe('free');
    expect((await orgRow(t.ids.orgB)).plan).toBe('starter');
  });

  it('follows updates: plan change, cancel at period end, past due', async () => {
    await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ plan: 'starter', metadata: meta() }), { created: sec(-30) }));
    await postWebhook(t, stripeEvent('customer.subscription.updated', stripeSub({ plan: 'enterprise', metadata: meta(), cancel_at_period_end: true }), { created: sec(-20) }));
    expect((await subRows())[0]).toMatchObject({ plan: 'enterprise', cancel_at_period_end: true });
    expect((await orgRow()).plan).toBe('enterprise');

    await postWebhook(t, stripeEvent('customer.subscription.updated', stripeSub({ plan: 'enterprise', metadata: meta(), status: 'past_due' }), { created: sec(-10) }));
    expect((await subRows())[0].status).toBe('past_due');
    expect((await orgRow()).plan).toBe('enterprise');
  });

  it('maps trialing to active and keeps an incomplete subscription from granting the plan', async () => {
    await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ plan: 'growth', metadata: meta(), status: 'incomplete' })));
    expect((await subRows())[0].status).toBe('incomplete');
    expect((await orgRow()).plan).toBe('free');
    await postWebhook(t, stripeEvent('customer.subscription.updated', stripeSub({ plan: 'growth', metadata: meta(), status: 'trialing', trial_end: sec(86400) })));
    expect((await subRows())[0].status).toBe('active');
    expect((await orgRow()).plan).toBe('growth');
  });

  it('drops the organization to free when the subscription is deleted', async () => {
    await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ plan: 'growth', metadata: meta() }), { created: sec(-20) }));
    await postWebhook(t, stripeEvent('customer.subscription.deleted', stripeSub({ plan: 'growth', metadata: meta(), status: 'canceled', canceled_at: sec() }), { created: sec(-10) }));
    expect((await subRows())[0].status).toBe('canceled');
    expect((await orgRow()).plan).toBe('free');
  });

  it('ignores an old event that arrives after a newer one', async () => {
    await postWebhook(t, stripeEvent('customer.subscription.updated', stripeSub({ plan: 'enterprise', metadata: meta() }), { created: sec(-10) }));
    const late = await postWebhook(t, stripeEvent('customer.subscription.updated', stripeSub({ plan: 'starter', metadata: meta() }), { created: sec(-100) }));
    expect(late.status).toBe(200);
    expect((await subRows())[0].plan).toBe('enterprise');
    expect((await orgRow()).plan).toBe('enterprise');
  });

  it('does not let the cancellation of a replaced subscription cancel the new one', async () => {
    await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ id: 'sub_old', plan: 'starter', metadata: meta() }), { created: sec(-50) }));
    await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ id: 'sub_new', plan: 'growth', metadata: meta() }), { created: sec(-40) }));
    await postWebhook(t, stripeEvent('customer.subscription.deleted', stripeSub({ id: 'sub_old', plan: 'starter', metadata: meta(), status: 'canceled' }), { created: sec(-30) }));
    const rows = await subRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ stripe_subscription_id: 'sub_new', status: 'active', plan: 'growth' });
    expect((await orgRow()).plan).toBe('growth');
  });

  it('ignores subscriptions it cannot attribute, or whose customer belongs to someone else', async () => {
    expect((await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ customer: 'cus_unknown' })))).status).toBe(200);
    expect(await subRows()).toEqual([]);

    await t.admin((pg) => pg.query(`update organizations set stripe_customer_id = 'cus_a' where id = $1`, [t.ids.orgA]));
    // Tagged with org A but carrying someone else's customer: refused
    expect((await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ customer: 'cus_evil', plan: 'enterprise', metadata: meta() })))).status).toBe(200);
    expect(await subRows()).toEqual([]);
    expect((await orgRow()).plan).toBe('free');
  });

  it('ignores a tag for an organization that does not exist', async () => {
    const r = await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ metadata: { organizationId: '00000000-0000-0000-0000-00000000ffff', plan: 'growth' } })));
    expect(r.status).toBe(200);
    expect(await subRows()).toEqual([]);
  });

  it('does not let one organization claim another one subscription id', async () => {
    await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ plan: 'growth', metadata: meta() }), { created: sec(-20) }));
    await postWebhook(t, stripeEvent('customer.subscription.updated', stripeSub({ plan: 'enterprise', customer: 'cus_b', metadata: { organizationId: t.ids.orgB, plan: 'enterprise' } }), { created: sec(-10) }));
    const rows = await subRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ organization_id: t.ids.orgA, plan: 'growth' });
    expect((await orgRow(t.ids.orgB)).plan).toBe('free');
  });
});

describe('checkout.session.completed', () => {
  it('fetches the subscription from Stripe and activates it', async () => {
    stripe.state.subs.set('sub_test_1', stripeSub({ plan: 'growth' }));
    const session = stripeSession({ metadata: meta(), subscription: 'sub_test_1' });
    expect((await postWebhook(t, stripeEvent('checkout.session.completed', session))).status).toBe(200);
    expect((await subRows())[0]).toMatchObject({ organization_id: t.ids.orgA, plan: 'growth', status: 'active' });
    expect(await orgRow()).toEqual({ plan: 'growth', stripe_customer_id: 'cus_test_1' });
  });

  it('ignores sessions that are not subscriptions or are not ours', async () => {
    await postWebhook(t, stripeEvent('checkout.session.completed', stripeSession({ mode: 'payment', metadata: meta() })));
    await postWebhook(t, stripeEvent('checkout.session.completed', stripeSession({ metadata: {}, subscription: 'sub_test_1' })));
    expect(await subRows()).toEqual([]);
  });

  it('can be retried after a Stripe outage: nothing is recorded until it is applied', async () => {
    stripe.state.subs.set('sub_test_1', stripeSub({ plan: 'growth' }));
    const event = stripeEvent('checkout.session.completed', stripeSession({ metadata: meta(), subscription: 'sub_test_1' }));
    stripe.state.failOn.add('GET /v1/subscriptions');
    expect((await postWebhook(t, event)).status).toBe(502);
    expect(await events()).toEqual([]);
    stripe.state.failOn.clear();
    expect((await postWebhook(t, event)).status).toBe(200);
    expect(await events()).toHaveLength(1);
    expect(await subRows()).toHaveLength(1);
  });

  it('needs the Stripe key to fetch the subscription (503, so Stripe retries)', async () => {
    await setup({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });
    const event = stripeEvent('checkout.session.completed', stripeSession({ metadata: meta(), subscription: 'sub_test_1' }));
    expect((await postWebhook(t, event)).status).toBe(503);
    expect(await events()).toEqual([]);
  });
});

describe('invoice.payment_failed', () => {
  beforeEach(async () => {
    await postWebhook(t, stripeEvent('customer.subscription.created', stripeSub({ plan: 'growth', metadata: meta() }), { created: sec(-20) }));
  });

  it('marks the subscription past due, keeps the plan and logs it', async () => {
    const r = await postWebhook(t, stripeEvent('invoice.payment_failed', { id: 'in_1', object: 'invoice', subscription: 'sub_test_1' }));
    expect(r.status).toBe(200);
    expect((await subRows())[0].status).toBe('past_due');
    expect((await orgRow()).plan).toBe('growth');
    expect(await t.rows(`select details from activities where action = 'billing.payment_failed' and organization_id = $1`, [t.ids.orgA])).toHaveLength(1);
  });

  it('reads the subscription from the newer invoice layout too', async () => {
    await postWebhook(t, stripeEvent('invoice.payment_failed', { id: 'in_2', object: 'invoice', parent: { subscription_details: { subscription: 'sub_test_1' } } }));
    expect((await subRows())[0].status).toBe('past_due');
  });

  it('does not revive or touch a canceled subscription, or an unknown one', async () => {
    await postWebhook(t, stripeEvent('customer.subscription.deleted', stripeSub({ plan: 'growth', metadata: meta(), status: 'canceled' }), { created: sec(-5) }));
    await postWebhook(t, stripeEvent('invoice.payment_failed', { id: 'in_3', object: 'invoice', subscription: 'sub_test_1' }));
    await postWebhook(t, stripeEvent('invoice.payment_failed', { id: 'in_4', object: 'invoice', subscription: 'sub_nope' }));
    expect((await subRows())[0].status).toBe('canceled');
  });
});

describe('idempotency', () => {
  it('does nothing when the same event is delivered again', async () => {
    const event = stripeEvent('customer.subscription.created', stripeSub({ plan: 'growth', metadata: meta() }));
    expect((await postWebhook(t, event)).json.data.duplicate).toBe(false);

    // Change our state, then replay: the replay must not undo it
    await t.admin((pg) => pg.query(`update subscriptions set plan = 'starter', status = 'past_due'`));
    await t.admin((pg) => pg.query(`update organizations set plan = 'starter' where id = $1`, [t.ids.orgA]));
    const replay = await postWebhook(t, event);
    expect(replay.status).toBe(200);
    expect(replay.json.data.duplicate).toBe(true);
    expect((await subRows())[0]).toMatchObject({ plan: 'starter', status: 'past_due' });
    expect((await orgRow()).plan).toBe('starter');
    expect(await events()).toEqual([{ id: event.id, type: 'customer.subscription.created' }]);
    expect(await t.rows(`select 1 from activities where action = 'billing.subscription.sync'`)).toHaveLength(1);
  });

  it('survives simultaneous deliveries of one event', async () => {
    const event = stripeEvent('customer.subscription.created', stripeSub({ plan: 'growth', metadata: meta() }));
    const results = await Promise.all([postWebhook(t, event), postWebhook(t, event), postWebhook(t, event)]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await events()).toHaveLength(1);
    expect(await subRows()).toHaveLength(1);
  });

  it('acknowledges event types it does not handle without recording them', async () => {
    const r = await postWebhook(t, stripeEvent('charge.succeeded', { id: 'ch_1', object: 'charge' }));
    expect(r.status).toBe(200);
    expect(r.json.data.ignored).toBe(true);
    expect(await events()).toEqual([]);
  });
});
