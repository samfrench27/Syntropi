import { Hono } from 'hono';
import { z } from 'zod';
import { camel } from '../../db';
import { ApiError, ok, validate, valid } from '../../http';
import { authenticate, authorizeSuperAdmin } from '../../middleware/auth';
import { logActivity } from '../../lib/activity';
import type { AppEnv } from '../../types';
import { PLAN_KEYS, isUuid, monthKey, successRate, syncSubscription, type PlanKey } from '../../services/billing';
import { callStripe, priceIdFor, stripeClient } from '../../services/stripe';

export const billingRoutes = new Hono<AppEnv>();

// Express asked for a 'platform-admin' role that does not exist, so in practice only the
// superadmin got in. That is now stated outright.
billingRoutes.use('*', authenticate, authorizeSuperAdmin);

const num = (v: unknown) => Number(v ?? 0);

const subscriptionsQuery = z.object({
  status: z.enum(['active', 'inactive', 'canceled', 'past_due', 'unpaid', 'incomplete']).optional(),
  plan: z.enum(PLAN_KEYS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

billingRoutes.get('/subscriptions', validate('query', subscriptionsQuery), async (c) => {
  const { db } = c.get('deps');
  const q = valid<z.infer<typeof subscriptionsQuery>>(c, 'query');
  const offset = q.offset ?? (q.page ? (q.page - 1) * q.limit : 0);

  const where = `($1::subscription_status is null or s.status = $1) and ($2::subscription_plan is null or s.plan = $2)`;
  const params = [q.status ?? null, q.plan ?? null];
  const [{ total }] = await db.query<{ total: number }>(`select count(*)::int as total from subscriptions s where ${where}`, params);
  const rows = await db.query(
    `select s.*, o.name as org_name, o.contact_email as org_contact_email, o.plan as org_plan, o.status as org_status
       from subscriptions s join organizations o on o.id = s.organization_id
      where ${where}
      order by s.created_at desc, s.id
      limit $3 offset $4`,
    [...params, q.limit, offset],
  );

  const subscriptions = rows.map((r: any) => {
    const { org_name, org_contact_email, org_plan, org_status, last_event_at, ...sub } = r;
    return {
      ...camel(sub),
      _id: r.id, // the dashboard still keys on the Mongo name
      // Same shape as Express's populate('organizationId')
      organizationId: { _id: r.organization_id, name: org_name, contactEmail: org_contact_email, plan: org_plan, status: org_status },
    };
  });

  return ok(c, {
    subscriptions,
    pagination: { total, limit: q.limit, offset, page: Math.floor(offset / q.limit) + 1, pages: Math.ceil(total / q.limit), hasMore: total > offset + q.limit },
  });
});

const dateParam = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Not a valid date')
  .transform((s) => new Date(s));
const revenueQuery = z.object({ startDate: dateParam.optional(), endDate: dateParam.optional() });

// Revenue comes from Stripe's charges (money actually collected); subscription counts from our table.
// Money is summed in integer minor units (pence) and only divided by 100 for display.
billingRoutes.get('/revenue', validate('query', revenueQuery), async (c) => {
  const deps = c.get('deps');
  const q = valid<z.infer<typeof revenueQuery>>(c, 'query');
  const end = q.endDate ?? deps.now();
  const start = q.startDate ?? new Date(end.getTime() - 30 * 24 * 3600 * 1000);
  if (start > end) throw new ApiError('startDate must not be after endDate', 400);

  const stripe = stripeClient(deps);
  const charges = await callStripe(() =>
    stripe.charges
      .list({ created: { gte: Math.floor(start.getTime() / 1000), lte: Math.floor(end.getTime() / 1000) }, limit: 100 })
      .autoPagingToArray({ limit: 1000 }),
  );

  let grossMinor = 0;
  let refundedMinor = 0;
  for (const ch of charges) {
    if (ch.currency !== 'gbp' || !ch.paid) continue;
    grossMinor += ch.amount;
    refundedMinor += ch.amount_refunded ?? 0;
  }
  const netMinor = grossMinor - refundedMinor;

  const [counts] = await deps.db.query<{ active: number; total: number }>(
    `select count(*) filter (where status = 'active')::int as active, count(*)::int as total from subscriptions`,
  );
  const distribution = await deps.db.query<{ _id: string; count: number }>(
    `select plan::text as _id, count(*)::int as count from subscriptions where status = 'active' group by plan order by plan`,
  );

  return ok(c, {
    revenue: {
      totalRevenue: grossMinor / 100,
      subscriptionRevenue: grossMinor / 100, // every charge is a subscription charge
      refunds: refundedMinor / 100,
      netRevenue: netMinor / 100,
      totalRevenueMinor: grossMinor,
      refundsMinor: refundedMinor,
      netRevenueMinor: netMinor,
      currency: 'GBP',
    },
    subscriptions: { active: counts.active, total: counts.total, planDistribution: distribution },
  });
});

// Counts from our own tables; no Stripe call
billingRoutes.get('/stripe-account', async (c) => {
  const { db } = c.get('deps');
  const [row] = await db.query<{ customers: number; active: number }>(
    `select (select count(*) from organizations where stripe_customer_id is not null)::int as customers,
            (select count(*) from subscriptions where status = 'active')::int as active`,
  );
  return ok(c, { totalCustomers: row.customers, activeSubscriptions: row.active });
});

const customersQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  page: z.coerce.number().int().min(1).default(1),
});

// Customers are the organizations that have a Stripe customer, with their plan and subscription
billingRoutes.get('/customers', validate('query', customersQuery), async (c) => {
  const { db } = c.get('deps');
  const q = valid<z.infer<typeof customersQuery>>(c, 'query');
  const rows = await db.query(
    `select o.id as organization_id, o.name, o.plan, o.stripe_customer_id, coalesce(o.billing_email, o.contact_email) as email,
            extract(epoch from o.created_at)::bigint as created,
            s.plan as sub_plan, s.status as sub_status
       from organizations o left join subscriptions s on s.organization_id = o.id
      where o.stripe_customer_id is not null
      order by o.created_at desc, o.id
      limit $1 offset $2`,
    [q.limit, (q.page - 1) * q.limit],
  );
  return ok(
    c,
    rows.map((r: any) => ({
      id: r.stripe_customer_id,
      email: r.email,
      name: r.name,
      created: num(r.created),
      organizationId: r.organization_id,
      organization: { name: r.name, plan: r.plan },
      subscription: r.sub_plan ? { plan: r.sub_plan, status: r.sub_status } : null,
    })),
  );
});

// Platform-wide numbers for the superadmin overview. All counts are for the current UTC month,
// except the organization and subscription totals.
billingRoutes.get('/metrics', async (c) => {
  const { db, now } = c.get('deps');
  const current = now();
  const month = monthKey(current);
  const monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));

  const orgRows = await db.query<{ plan: string; status: string; n: number }>(
    `select plan::text, status::text, count(*)::int as n from organizations group by plan, status`,
  );
  const byPlan: Record<string, number> = { free: 0, starter: 0, growth: 0, enterprise: 0 };
  let orgTotal = 0;
  let orgActive = 0;
  for (const r of orgRows) {
    byPlan[r.plan] = (byPlan[r.plan] ?? 0) + r.n;
    orgTotal += r.n;
    if (r.status === 'active') orgActive += r.n;
  }

  const subRows = await db.query<{ plan: string; status: string; n: number }>(
    `select plan::text, status::text, count(*)::int as n from subscriptions group by plan, status`,
  );
  const subs = { total: 0, active: 0, pastDue: 0, canceled: 0 };
  const dist: Record<string, number> = {};
  for (const r of subRows) {
    subs.total += r.n;
    if (r.status === 'active') {
      subs.active += r.n;
      dist[r.plan] = (dist[r.plan] ?? 0) + r.n;
    }
    if (r.status === 'past_due') subs.pastDue += r.n;
    if (r.status === 'canceled') subs.canceled += r.n;
  }

  const [usage] = await db.query<any>(
    `select coalesce(sum(payments), 0)::int as payments, coalesce(sum(api_calls), 0)::bigint as api_calls,
            coalesce(sum(successful_payments), 0)::int as successful, coalesce(sum(failed_payments), 0)::int as failed
       from billing_usage where month = $1`,
    [month],
  );

  const payRows = await db.query<{ currency: string; total: number; successful: number; failed: number; volume_minor: string }>(
    `select currency::text, count(*)::int as total,
            count(*) filter (where status = 'COMPLETED')::int as successful,
            count(*) filter (where status = 'FAILED')::int as failed,
            coalesce(sum(round(amount_value * 100)) filter (where status = 'COMPLETED'), 0)::text as volume_minor
       from payments where created_at >= $1 group by currency order by currency`,
    [monthStart],
  );
  const payments = { total: 0, successful: 0, failed: 0, successRate: 0, volumeByCurrency: [] as { currency: string; minor: number }[] };
  for (const r of payRows) {
    payments.total += r.total;
    payments.successful += r.successful;
    payments.failed += r.failed;
    payments.volumeByCurrency.push({ currency: r.currency, minor: num(r.volume_minor) });
  }
  payments.successRate = successRate(payments.successful, payments.failed);

  return ok(c, {
    month,
    organizations: { total: orgTotal, active: orgActive, byPlan },
    subscriptions: {
      ...subs,
      planDistribution: Object.entries(dist).map(([_id, count]) => ({ _id, count })),
    },
    usage: {
      payments: usage.payments,
      apiCalls: num(usage.api_calls),
      successfulPayments: usage.successful,
      failedPayments: usage.failed,
    },
    payments,
  });
});

// Any 8-4-4-4-12 hex id: zod 4's .uuid() also demands an RFC version nibble, which the seed ids lack
const orgParam = z.object({ id: z.string().refine(isUuid, 'Not a valid id') });
const planBody = z.object({ plan: z.enum(PLAN_KEYS) });

// Admin override of an organization's plan. When the organization has a live subscription the
// change is made in Stripe first, so the two cannot disagree.
billingRoutes.put('/organizations/:id/plan', validate('param', orgParam), validate('json', planBody), async (c) => {
  const deps = c.get('deps');
  const actor = c.get('user');
  const { id } = valid<z.infer<typeof orgParam>>(c, 'param');
  const { plan } = valid<{ plan: PlanKey }>(c, 'json');

  const [org] = await deps.db.query<any>(`select id, plan from organizations where id = $1`, [id]);
  if (!org) throw new ApiError('Organization not found', 404);

  const [existing] = await deps.db.query<any>(`select * from subscriptions where organization_id = $1`, [id]);
  const live = existing && existing.status !== 'canceled';

  if (live) {
    const priceId = priceIdFor(deps, plan);
    const stripe = stripeClient(deps);
    const current = await callStripe(() => stripe.subscriptions.retrieve(existing.stripe_subscription_id));
    const itemId = current.items.data[0]?.id;
    if (!itemId) throw new ApiError('Subscription has no items to change', 409);
    const updated = await callStripe(() =>
      stripe.subscriptions.update(existing.stripe_subscription_id, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: 'create_prorations',
        metadata: { organizationId: id, plan },
      }),
    );
    const result = await syncSubscription(deps.db, deps, { organizationId: id, sub: updated as any, plan });
    if (!result.applied) throw new ApiError('Subscription could not be updated', 409);
  }

  // Set the plan explicitly too: with no live subscription this is the whole change
  const [updated] = await deps.db.query(`update organizations set plan = $2 where id = $1 returning *`, [id, plan]);

  await logActivity(c, {
    userId: actor.userId,
    organizationId: id,
    action: 'admin.billing.updatePlan',
    details: { from: org.plan, to: plan, subscriptionUpdated: !!live },
  });
  return ok(c, camel(updated));
});
