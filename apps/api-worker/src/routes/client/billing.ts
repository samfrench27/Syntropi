import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { camel } from '../../db';
import { ApiError, ok, validate, valid } from '../../http';
import { authenticate, authorizeAdmin } from '../../middleware/auth';
import { logActivity } from '../../lib/activity';
import type { AppDeps, AppEnv } from '../../types';
import {
  PLAN_KEYS,
  PLAN_LIMITS,
  emptyUsage,
  isPlanKey,
  isUuid,
  monthKey,
  monthsBack,
  planConfigs,
  syncSubscription,
  type OrgPlan,
  type PlanKey,
} from '../../services/billing';
import { callStripe, ensureCustomer, priceIdFor, stripeClient } from '../../services/stripe';

export const billingRoutes = new Hono<AppEnv>();

// Everyone signed in may read usage; managing the subscription is for organization admins
billingRoutes.use('*', authenticate);

const planBody = z.object({ plan: z.enum(PLAN_KEYS) });

type Ctx = Context<AppEnv>;

async function loadOrg(c: Ctx) {
  const { db } = c.get('deps');
  const { organizationId } = c.get('user');
  const [org] = await db.query<{
    id: string;
    name: string;
    contact_email: string;
    billing_email: string | null;
    stripe_customer_id: string | null;
    plan: OrgPlan;
  }>(`select id, name, contact_email, billing_email, stripe_customer_id, plan from organizations where id = $1`, [organizationId]);
  if (!org) throw new ApiError('Organization not found', 404);
  return org;
}

const loadSubscription = async (c: Ctx, organizationId: string) =>
  (await c.get('deps').db.query<Record<string, any>>(`select * from subscriptions where organization_id = $1`, [organizationId]))[0];

/** The plan catalogue as the dashboard sees it. */
const plansView = (deps: Pick<AppDeps, 'env'>) => {
  const configs = planConfigs(deps);
  return Object.fromEntries(PLAN_KEYS.map((k) => [k, configs[k]]));
};

const subscriptionView = (row: Record<string, any>) => {
  const s: Record<string, any> = camel(row);
  delete s.lastEventAt;
  return s;
};

// Current subscription. Served from our own table, which the webhook keeps in step with Stripe.
// The subscription fields are at the top level (what the billing page reads) and also under
// `subscription` (what Express returned).
billingRoutes.get('/subscription', authorizeAdmin, async (c) => {
  const deps = c.get('deps');
  const row = await loadSubscription(c, c.get('user').organizationId);
  const subscription = row ? subscriptionView(row) : null;
  return ok(c, { ...(subscription ?? {}), subscription, stripeSubscription: null, plans: plansView(deps) });
});

// Start a subscription: returns a Stripe Checkout URL
billingRoutes.post('/subscription', authorizeAdmin, validate('json', planBody), async (c) => {
  const deps = c.get('deps');
  const user = c.get('user');
  const { plan } = valid<{ plan: PlanKey }>(c, 'json');

  const priceId = priceIdFor(deps, plan);
  stripeClient(deps);
  const existing = await loadSubscription(c, user.organizationId);
  if (existing && ['active', 'past_due', 'unpaid'].includes(existing.status)) {
    throw new ApiError('This organization already has a subscription. Change its plan instead.', 409);
  }

  const org = await loadOrg(c);
  const customer = await ensureCustomer(deps, org);
  const stripe = stripeClient(deps);
  const base = deps.config.dashboardUrl;
  const session = await callStripe(() =>
    stripe.checkout.sessions.create({
      customer,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${base}/org-admin/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/org-admin/billing?canceled=true`,
      metadata: { organizationId: org.id, plan },
      // The subscription carries the same tags, so later webhook events can find the organization
      subscription_data: { metadata: { organizationId: org.id, plan } },
    }),
  );

  await logActivity(c, { userId: user.userId, organizationId: org.id, action: 'client.billing.subscribe', details: { plan, sessionId: session.id } });
  return ok(c, { checkoutUrl: session.url, sessionId: session.id });
});

// Change plan on the existing subscription
billingRoutes.put('/subscription', authorizeAdmin, validate('json', planBody), async (c) => {
  const deps = c.get('deps');
  const user = c.get('user');
  const { plan } = valid<{ plan: PlanKey }>(c, 'json');

  const priceId = priceIdFor(deps, plan);
  const stripe = stripeClient(deps);
  const existing = await loadSubscription(c, user.organizationId);
  if (!existing || existing.status === 'canceled') throw new ApiError('No existing subscription found', 404);

  const current = await callStripe(() => stripe.subscriptions.retrieve(existing.stripe_subscription_id));
  const itemId = current.items.data[0]?.id;
  if (!itemId) throw new ApiError('Subscription has no items to change', 409);
  const updated = await callStripe(() =>
    stripe.subscriptions.update(existing.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
      metadata: { organizationId: user.organizationId, plan },
    }),
  );

  const result = await syncSubscription(deps.db, deps, { organizationId: user.organizationId, sub: updated as any, plan });
  if (!result.applied) throw new ApiError('Subscription could not be updated', 409);

  await logActivity(c, {
    userId: user.userId,
    organizationId: user.organizationId,
    action: 'client.billing.update',
    details: { from: existing.plan, to: plan },
  });
  return ok(c, subscriptionView(result.subscription!));
});

const cancelBody = z.object({ cancelAtPeriodEnd: z.boolean().default(true) });

// Cancel: at the end of the period by default, or straight away with cancelAtPeriodEnd=false
billingRoutes.delete('/subscription', authorizeAdmin, validate('json', cancelBody), async (c) => {
  const deps = c.get('deps');
  const user = c.get('user');
  const { cancelAtPeriodEnd } = valid<z.infer<typeof cancelBody>>(c, 'json');

  const stripe = stripeClient(deps);
  const existing = await loadSubscription(c, user.organizationId);
  if (!existing || existing.status === 'canceled') throw new ApiError('No existing subscription found', 404);

  const sub = await callStripe(() =>
    cancelAtPeriodEnd
      ? stripe.subscriptions.update(existing.stripe_subscription_id, { cancel_at_period_end: true })
      : stripe.subscriptions.cancel(existing.stripe_subscription_id),
  );

  const result = await syncSubscription(deps.db, deps, { organizationId: user.organizationId, sub: sub as any, plan: existing.plan });
  await logActivity(c, {
    userId: user.userId,
    organizationId: user.organizationId,
    action: 'client.billing.cancel',
    details: { cancelAtPeriodEnd },
  });
  return ok(c, subscriptionView(result.subscription ?? existing));
});

// Monthly usage for the last N months, oldest first
const usageQuery = z.object({ months: z.coerce.number().int().min(1).max(24).default(6) });

billingRoutes.get('/usage', validate('query', usageQuery), async (c) => {
  const deps = c.get('deps');
  const { organizationId } = c.get('user');
  const { months } = valid<z.infer<typeof usageQuery>>(c, 'query');

  const org = await loadOrg(c);
  const limits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS.free;
  const now = deps.now();
  const first = monthsBack(now, months - 1);
  const last = monthKey(now);

  const rows = await deps.db.query<any>(`select * from billing_usage where organization_id = $1 and month >= $2 and month <= $3`, [
    organizationId,
    first,
    last,
  ]);
  const byMonth = new Map(rows.map((r) => [r.month, r]));

  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = monthsBack(now, i);
    const r = byMonth.get(month);
    out.push({
      month,
      year: Number(month.slice(0, 4)),
      usage: r
        ? { payments: r.payments, apiCalls: r.api_calls, successfulPayments: r.successful_payments, failedPayments: r.failed_payments }
        : emptyUsage(),
      costs: {
        paymentFees: Number(r?.payment_fees ?? 0),
        apiCallFees: Number(r?.api_call_fees ?? 0),
        subscriptionFee: Number(r?.subscription_fee ?? 0),
        totalFees: Number(r?.total_fees ?? 0),
      },
      // The organization's current plan decides the limits, not whatever the row was created with
      limits: { paymentsLimit: limits.payments, apiCallsLimit: limits.apiCalls, usersLimit: limits.users },
    });
  }
  return ok(c, out);
});

const portalBody = z.object({ returnUrl: z.string().url().max(2000).optional() });

// Stripe's billing portal. The return address must be one of our own front ends.
billingRoutes.post('/portal', authorizeAdmin, validate('json', portalBody), async (c) => {
  const deps = c.get('deps');
  const { returnUrl } = valid<z.infer<typeof portalBody>>(c, 'json');

  const allowed = new Set([deps.config.dashboardUrl, ...deps.config.corsOrigins].map((u) => new URL(u).origin));
  const target = returnUrl ?? `${deps.config.dashboardUrl}/org-admin/billing`;
  if (!allowed.has(new URL(target).origin)) throw new ApiError('Return URL is not allowed', 400);

  const stripe = stripeClient(deps);
  const org = await loadOrg(c);
  const customer = await ensureCustomer(deps, org);
  const session = await callStripe(() => stripe.billingPortal.sessions.create({ customer, return_url: target }));
  return ok(c, { url: session.url });
});

const successBody = z.object({ sessionId: z.string().trim().regex(/^cs_[A-Za-z0-9_]{1,250}$/, 'Not a checkout session id') });

/**
 * The post-checkout redirect. The session is checked with Stripe, never trusted from the browser,
 * and must belong to the caller's organization. The webhook does the same work, so whichever
 * arrives first wins and the other finds nothing left to do.
 */
billingRoutes.post('/checkout/success', authorizeAdmin, validate('json', successBody), async (c) => {
  const deps = c.get('deps');
  const user = c.get('user');
  const { sessionId } = valid<z.infer<typeof successBody>>(c, 'json');

  const stripe = stripeClient(deps);
  const session = await callStripe(() => stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] }));

  const sessionOrg = session.metadata?.organizationId;
  if (!isUuid(sessionOrg) || sessionOrg !== user.organizationId) throw new ApiError('Checkout session does not belong to your organization', 403);
  if (session.mode !== 'subscription' || session.status !== 'complete') throw new ApiError('Checkout is not complete', 409);

  const sub = session.subscription;
  if (!sub || typeof sub === 'string') throw new ApiError('Checkout has no subscription yet', 409);
  const plan = isPlanKey(session.metadata?.plan) ? (session.metadata!.plan as PlanKey) : undefined;

  const result = await syncSubscription(deps.db, deps, { organizationId: user.organizationId, sub: sub as any, plan });
  if (!result.applied && result.reason !== 'stale') throw new ApiError('Subscription could not be activated', 409);

  await logActivity(c, {
    userId: user.userId,
    organizationId: user.organizationId,
    action: 'client.billing.checkout',
    details: { sessionId, subscriptionId: sub.id, applied: result.applied },
  });

  const row = await loadSubscription(c, user.organizationId);
  return c.json({ success: true, message: 'Subscription activated successfully', data: row ? subscriptionView(row) : null });
});
