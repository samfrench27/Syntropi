import type { Db } from '../db';
import type { AppDeps } from '../types';

export const PLAN_KEYS = ['starter', 'growth', 'enterprise'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export type OrgPlan = 'free' | PlanKey;

/** -1 means unlimited, as in Express. */
export interface PlanLimits {
  payments: number;
  apiCalls: number;
  users: number;
}

/** Limits per plan, ported from Express. Free is what an organization with no plan gets. */
export const PLAN_LIMITS: Record<OrgPlan, PlanLimits> = {
  free: { payments: 100, apiCalls: 1000, users: 5 },
  starter: { payments: 100, apiCalls: 1000, users: 5 },
  growth: { payments: 1000, apiCalls: 10000, users: 25 },
  enterprise: { payments: -1, apiCalls: -1, users: -1 },
};

const PLAN_NAMES: Record<PlanKey, string> = {
  starter: 'Syntropi Starter plan',
  growth: 'Syntropi Growth plan',
  enterprise: 'Syntropi Enterprise plan',
};

export interface PlanConfig {
  name: string;
  priceId?: string;
  productId?: string;
  limits: PlanLimits;
}

/** Price and product ids come from the environment (not yet in Bindings, hence the cast). */
export function planConfigs(deps: Pick<AppDeps, 'env'>): Record<PlanKey, PlanConfig> {
  const env = deps.env as Record<string, string | undefined>;
  const out = {} as Record<PlanKey, PlanConfig>;
  for (const key of PLAN_KEYS) {
    const prefix = `STRIPE_${key.toUpperCase()}`;
    out[key] = {
      name: PLAN_NAMES[key],
      priceId: env[`${prefix}_PRICE_ID`] || undefined,
      productId: env[`${prefix}_PRODUCT_ID`] || undefined,
      limits: PLAN_LIMITS[key],
    };
  }
  return out;
}

export function planForPrice(deps: Pick<AppDeps, 'env'>, priceId: string | undefined | null): PlanKey | undefined {
  if (!priceId) return undefined;
  const configs = planConfigs(deps);
  return PLAN_KEYS.find((k) => configs[k].priceId === priceId);
}

export const isPlanKey = (v: unknown): v is PlanKey => typeof v === 'string' && (PLAN_KEYS as readonly string[]).includes(v);

export type SubscriptionStatus = 'active' | 'inactive' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete';

/** Stripe has more statuses than our enum. */
export function mapStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'unpaid':
      return 'unpaid';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    case 'incomplete':
      return 'incomplete';
    default:
      return 'inactive'; // paused and anything new
  }
}

const unixToDate = (s: unknown): Date | null => (typeof s === 'number' && s > 0 ? new Date(s * 1000) : null);

/** The slice of a Stripe subscription this service reads. */
export interface StripeSubscriptionLike {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  canceled_at?: number | null;
  trial_start?: number | null;
  trial_end?: number | null;
  metadata?: Record<string, string> | null;
  current_period_start?: number;
  current_period_end?: number;
  items?: { data: Array<{ id: string; price?: { id: string; product?: string | { id: string } } | null; current_period_start?: number; current_period_end?: number }> };
}

export const customerId = (sub: { customer: string | { id: string } }) => (typeof sub.customer === 'string' ? sub.customer : sub.customer.id);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export type SyncResult = { applied: boolean; reason?: string; subscription?: Record<string, any> };

/**
 * Write a Stripe subscription into our tables: the subscriptions row and organizations.plan /
 * stripe_customer_id. The webhook and /checkout/success both come through here, so the result is
 * the same whichever arrives first, and applying the same state twice changes nothing.
 *
 * eventAt is the Stripe time of the webhook event. An event older than the newest one already
 * applied for the same subscription is skipped. Callers that read fresh state from Stripe pass
 * nothing and simply write it.
 */
export async function syncSubscription(
  db: Db,
  deps: Pick<AppDeps, 'env' | 'now'>,
  input: { organizationId: string; sub: StripeSubscriptionLike; plan?: PlanKey; eventAt?: Date },
): Promise<SyncResult> {
  const { organizationId, sub, eventAt } = input;
  const customer = customerId(sub);
  const item = sub.items?.data?.[0];

  const [org] = await db.query<{ id: string; stripe_customer_id: string | null }>(
    `select id, stripe_customer_id from organizations where id = $1`,
    [organizationId],
  );
  if (!org) return { applied: false, reason: 'organization not found' };
  // Never attach a Stripe customer that belongs to someone else
  if (org.stripe_customer_id && org.stripe_customer_id !== customer) return { applied: false, reason: 'customer mismatch' };

  // A subscription id can only ever belong to one organization
  const [owner] = await db.query<{ organization_id: string }>(
    `select organization_id from subscriptions where stripe_subscription_id = $1`,
    [sub.id],
  );
  if (owner && owner.organization_id !== organizationId) return { applied: false, reason: 'subscription belongs to another organization' };

  const [existing] = await db.query<{ plan: PlanKey }>(`select plan from subscriptions where organization_id = $1 and stripe_subscription_id = $2`, [
    organizationId,
    sub.id,
  ]);
  const configs = planConfigs(deps);
  const plan = input.plan ?? planForPrice(deps, item?.price?.id) ?? (isPlanKey(sub.metadata?.plan) ? sub.metadata!.plan as PlanKey : undefined) ?? existing?.plan;
  if (!plan) return { applied: false, reason: 'unknown plan' };

  const status = mapStatus(sub.status);
  const priceId = item?.price?.id ?? configs[plan].priceId ?? '';
  const rawProduct = item?.price?.product;
  const productId = (typeof rawProduct === 'string' ? rawProduct : rawProduct?.id) ?? configs[plan].productId ?? '';
  const periodStart = unixToDate(item?.current_period_start ?? sub.current_period_start) ?? deps.now();
  const periodEnd = unixToDate(item?.current_period_end ?? sub.current_period_end) ?? new Date(periodStart.getTime() + 30 * 24 * 3600 * 1000);

  const [row] = await db.query(
    `insert into subscriptions as s
       (organization_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_product_id, plan, status,
        current_period_start, current_period_end, cancel_at_period_end, canceled_at, trial_start, trial_end, metadata, last_event_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
     on conflict (organization_id) do update set
       stripe_customer_id = excluded.stripe_customer_id,
       stripe_subscription_id = excluded.stripe_subscription_id,
       stripe_price_id = excluded.stripe_price_id,
       stripe_product_id = excluded.stripe_product_id,
       plan = excluded.plan,
       status = excluded.status,
       current_period_start = excluded.current_period_start,
       current_period_end = excluded.current_period_end,
       cancel_at_period_end = excluded.cancel_at_period_end,
       canceled_at = excluded.canceled_at,
       trial_start = excluded.trial_start,
       trial_end = excluded.trial_end,
       metadata = excluded.metadata,
       last_event_at = case when s.stripe_subscription_id = excluded.stripe_subscription_id
                            then coalesce(excluded.last_event_at, s.last_event_at) else excluded.last_event_at end
     where (s.stripe_subscription_id = excluded.stripe_subscription_id
              and (s.last_event_at is null or excluded.last_event_at is null or s.last_event_at <= excluded.last_event_at))
        or (s.stripe_subscription_id <> excluded.stripe_subscription_id and excluded.status <> 'canceled')
     returning *`,
    [
      organizationId,
      customer,
      sub.id,
      priceId,
      productId,
      plan,
      status,
      periodStart,
      periodEnd,
      !!sub.cancel_at_period_end,
      unixToDate(sub.canceled_at),
      unixToDate(sub.trial_start),
      unixToDate(sub.trial_end),
      JSON.stringify(sub.metadata ?? {}),
      eventAt ?? null,
    ],
  );

  // Nothing written: a stale event, or a cancellation of a subscription that has been replaced
  if (!row) return { applied: false, reason: 'stale' };

  // The organization follows the subscription. Active and past-due keep the plan, an ended
  // subscription drops back to free, and an incomplete one changes nothing yet.
  const orgPlan: OrgPlan | undefined = status === 'active' || status === 'past_due' ? plan : status === 'canceled' ? 'free' : undefined;
  await db.query(
    `update organizations
        set stripe_customer_id = coalesce(stripe_customer_id, $2), plan = coalesce($3::org_plan, plan)
      where id = $1`,
    [organizationId, customer, orgPlan ?? null],
  );

  return { applied: true, subscription: row };
}

/** UTC month key, YYYY-MM. */
export const monthKey = (d: Date) => d.toISOString().slice(0, 7);

/** The month n months before d (n = 0 is d's own month), in UTC. */
export function monthsBack(d: Date, n: number): string {
  return monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1)));
}

export interface UsageNumbers {
  payments: number;
  apiCalls: number;
  successfulPayments: number;
  failedPayments: number;
}

export const emptyUsage = (): UsageNumbers => ({ payments: 0, apiCalls: 0, successfulPayments: 0, failedPayments: 0 });

/** Percentage used of a limit, or null when the limit is unlimited. */
export const percentUsed = (used: number, limit: number): number | null => (limit < 0 ? null : limit === 0 ? 100 : Math.round((used / limit) * 10000) / 100);

export const successRate = (successful: number, failed: number): number => {
  const done = successful + failed;
  return done === 0 ? 0 : Math.round((successful / done) * 10000) / 100;
};
