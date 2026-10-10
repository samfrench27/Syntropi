import Stripe from 'stripe';
import type { TestApp } from './helpers/app';

export const WEBHOOK_SECRET = 'whsec_test_secret_0123456789';

export const STRIPE_ENV = {
  STRIPE_SECRET_KEY: 'sk_test_fake_key',
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_STARTER_PRICE_ID: 'price_starter',
  STRIPE_GROWTH_PRICE_ID: 'price_growth',
  STRIPE_ENTERPRISE_PRICE_ID: 'price_enterprise',
  STRIPE_STARTER_PRODUCT_ID: 'prod_starter',
  STRIPE_GROWTH_PRODUCT_ID: 'prod_growth',
  STRIPE_ENTERPRISE_PRODUCT_ID: 'prod_enterprise',
};

export const PERIOD_START = 1_790_000_000;
export const PERIOD_END = PERIOD_START + 30 * 86400;

const PRICE_BY_PLAN: Record<string, string> = { starter: 'price_starter', growth: 'price_growth', enterprise: 'price_enterprise' };
const PLAN_BY_PRICE = Object.fromEntries(Object.entries(PRICE_BY_PLAN).map(([k, v]) => [v, k]));

export function stripeSub(over: Record<string, any> = {}) {
  const plan = over.plan ?? 'starter';
  const { plan: _plan, price, ...rest } = over;
  const priceId = price ?? PRICE_BY_PLAN[plan];
  return {
    id: 'sub_test_1',
    object: 'subscription',
    customer: 'cus_test_1',
    status: 'active',
    cancel_at_period_end: false,
    canceled_at: null,
    trial_start: null,
    trial_end: null,
    metadata: {},
    items: {
      object: 'list',
      has_more: false,
      data: [{ id: 'si_1', object: 'subscription_item', price: { id: priceId, product: `prod_${PLAN_BY_PRICE[priceId] ?? 'x'}` }, current_period_start: PERIOD_START, current_period_end: PERIOD_END }],
    },
    ...rest,
  };
}

export function stripeSession(over: Record<string, any> = {}) {
  return { id: 'cs_test_1', object: 'checkout.session', mode: 'subscription', status: 'complete', customer: 'cus_test_1', metadata: {}, subscription: null, url: null, ...over };
}

/** A fake Stripe: answers the few endpoints billing uses, from in-memory state, and records every call. */
export function fakeStripe() {
  const state = {
    subs: new Map<string, any>(),
    sessions: new Map<string, any>(),
    charges: [] as any[],
    calls: [] as { method: string; path: string; body: Record<string, string> }[],
    failOn: new Set<string>(), // "METHOD /path" prefixes that answer 500
    customers: 0,
  };

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_fake' } });
  const notFound = () => json({ error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such object' } }, 404);

  const fetchFn: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = Object.fromEntries(new URLSearchParams(typeof init?.body === 'string' ? init.body : ''));
    const path = url.pathname;
    state.calls.push({ method, path, body: { ...body, ...Object.fromEntries(url.searchParams) } });
    if ([...state.failOn].some((p) => `${method} ${path}`.startsWith(p))) return json({ error: { type: 'api_error', message: 'boom' } }, 500);

    if (method === 'POST' && path === '/v1/customers') {
      state.customers++;
      return json({ id: `cus_new_${state.customers}`, object: 'customer' });
    }
    if (method === 'POST' && path === '/v1/checkout/sessions') return json({ id: 'cs_test_created', object: 'checkout.session', url: 'https://checkout.stripe.test/cs_test_created' });
    const sess = path.match(/^\/v1\/checkout\/sessions\/([^/]+)$/);
    if (method === 'GET' && sess) {
      const s = state.sessions.get(sess[1]);
      if (!s) return notFound();
      const expand = [...url.searchParams].filter(([k]) => k.startsWith('expand')).map(([, v]) => v);
      return json({ ...s, subscription: expand.includes('subscription') ? state.subs.get(s.subscription) ?? s.subscription : s.subscription });
    }
    if (method === 'POST' && path === '/v1/billing_portal/sessions') return json({ id: 'bps_1', object: 'billing_portal.session', url: 'https://portal.stripe.test/s/1', return_url: body.return_url });
    const sub = path.match(/^\/v1\/subscriptions\/([^/]+)$/);
    if (sub) {
      const current = state.subs.get(sub[1]);
      if (!current) return notFound();
      if (method === 'GET') return json(current);
      if (method === 'DELETE') {
        const ended = { ...current, status: 'canceled', canceled_at: PERIOD_START + 100 };
        state.subs.set(sub[1], ended);
        return json(ended);
      }
      if (method === 'POST') {
        const next = { ...current };
        if (body.cancel_at_period_end !== undefined) next.cancel_at_period_end = body.cancel_at_period_end === 'true';
        const price = body['items[0][price]'];
        if (price) next.items = { ...current.items, data: [{ ...current.items.data[0], price: { id: price, product: `prod_${PLAN_BY_PRICE[price]}` } }] };
        state.subs.set(sub[1], next);
        return json(next);
      }
    }
    if (method === 'GET' && path === '/v1/charges') return json({ object: 'list', url: '/v1/charges', has_more: false, data: state.charges });
    return json({ error: { type: 'invalid_request_error', message: `fake stripe: unhandled ${method} ${path}` } }, 404);
  };

  return { state, fetch: fetchFn };
}

/** Post a Stripe event to the webhook with a valid signature (or a custom header). */
export async function postWebhook(t: TestApp, event: Record<string, any>, opts: { header?: string | null; secret?: string; raw?: string } = {}) {
  const payload = opts.raw ?? JSON.stringify(event);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.header !== null) headers['stripe-signature'] = opts.header ?? Stripe.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? WEBHOOK_SECRET });
  const res = await t.app.request('/api/webhooks/stripe', { method: 'POST', headers, body: payload });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : undefined };
}

let n = 0;
export const stripeEvent = (type: string, object: any, over: Record<string, any> = {}) => ({
  id: `evt_test_${++n}`,
  object: 'event',
  api_version: '2026-09-30.endive',
  created: Math.floor(Date.now() / 1000),
  type,
  data: { object },
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
  ...over,
});

export const EXTRA = {
  plainA: '00000000-0000-0000-0000-0000000000a3',
  superadmin: '00000000-0000-0000-0000-0000000000a9',
};

/** A plain user in org A and a superadmin (also filed under org A). */
export async function seedExtraUsers(t: TestApp) {
  await t.admin((pg) =>
    pg.exec(`
      insert into auth.users (id, email) values ('${EXTRA.plainA}', 'plain@acme.test'), ('${EXTRA.superadmin}', 'root@syntropi.test');
      insert into profiles (id, email, first_name, last_name, role, organization_id) values
        ('${EXTRA.plainA}', 'plain@acme.test', 'Pat', 'Plain', 'user', '${t.ids.orgA}'),
        ('${EXTRA.superadmin}', 'root@syntropi.test', 'Sam', 'Super', 'superadmin', '${t.ids.orgA}');
    `),
  );
}
