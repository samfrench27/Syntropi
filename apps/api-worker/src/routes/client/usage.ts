import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, ok, validate, valid } from '../../http';
import { authenticate } from '../../middleware/auth';
import type { AppEnv } from '../../types';
import { PLAN_LIMITS, emptyUsage, monthKey, percentUsed, successRate, type OrgPlan } from '../../services/billing';

/**
 * Usage for the signed-in user's own organization (never another's). Any role may read it.
 * Mounted at /api/client/usage. The dashboard's clientUsageAPI calls these; Express never had them.
 */
export const usageRoutes = new Hono<AppEnv>();

usageRoutes.use('*', authenticate);

const DAY = 24 * 3600 * 1000;
const isoDate = z.string().refine((s) => /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(s) && !Number.isNaN(Date.parse(s)), 'Not a valid date');

/** Dates as the dashboard sends them: a bare YYYY-MM-DD covers that whole day, so the end is exclusive. */
function resolveRange(now: Date, startDate?: string, endDate?: string, defaultStart?: Date) {
  const start = startDate ? new Date(startDate) : (defaultStart ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  let endExclusive: Date;
  if (endDate) endExclusive = endDate.length === 10 ? new Date(Date.parse(endDate) + DAY) : new Date(endDate);
  else endExclusive = new Date(now.getTime() + 1);
  if (endExclusive <= start) throw new ApiError('startDate must be before endDate', 400);
  if (endExclusive.getTime() - start.getTime() > 366 * DAY) throw new ApiError('Date range is limited to one year', 400);
  return { start, endExclusive };
}

const period = (start: Date, endExclusive: Date) => ({ startDate: start.toISOString(), endDate: new Date(endExclusive.getTime() - 1).toISOString() });

const rangeQuery = z.object({ startDate: isoDate.optional(), endDate: isoDate.optional() });

async function orgPlan(c: any): Promise<OrgPlan> {
  const [org] = await c.get('deps').db.query(`select plan from organizations where id = $1`, [c.get('user').organizationId]);
  if (!org) throw new ApiError('Organization not found', 404);
  return org.plan;
}

type Volume = Record<string, number>;

// Where we stand against the plan, plus payment outcomes in the range (default: this month so far).
// `usage` is the metered counters in billing_usage (what limits are judged on, kept by
// billing_increment, so it is by whole calendar month); `payments` is counted from the payments table.
usageRoutes.get('/summary', validate('query', rangeQuery), async (c) => {
  const deps = c.get('deps');
  const { organizationId } = c.get('user');
  const q = valid<z.infer<typeof rangeQuery>>(c, 'query');
  const { start, endExclusive } = resolveRange(deps.now(), q.startDate, q.endDate);

  const plan = await orgPlan(c);
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const [metered] = await deps.db.query<any>(
    `select coalesce(sum(payments), 0)::int as payments, coalesce(sum(api_calls), 0)::int as api_calls,
            coalesce(sum(successful_payments), 0)::int as successful, coalesce(sum(failed_payments), 0)::int as failed
       from billing_usage where organization_id = $1 and month >= $2 and month <= $3`,
    [organizationId, monthKey(start), monthKey(new Date(endExclusive.getTime() - 1))],
  );
  const [{ users }] = await deps.db.query<{ users: number }>(`select count(*)::int as users from profiles where organization_id = $1 and status = 'active'`, [organizationId]);

  const payRows = await deps.db.query<{ currency: string; total: number; successful: number; failed: number; volume_minor: string }>(
    `select currency::text, count(*)::int as total,
            count(*) filter (where status = 'COMPLETED')::int as successful,
            count(*) filter (where status = 'FAILED')::int as failed,
            coalesce(sum(round(amount_value * 100)) filter (where status = 'COMPLETED'), 0)::text as volume_minor
       from payments where organization_id = $1 and created_at >= $2 and created_at < $3 group by currency order by currency`,
    [organizationId, start, endExclusive],
  );
  const payments = { total: 0, successful: 0, failed: 0, successRate: 0, volumeByCurrency: [] as { currency: string; minor: number }[] };
  for (const r of payRows) {
    payments.total += r.total;
    payments.successful += r.successful;
    payments.failed += r.failed;
    payments.volumeByCurrency.push({ currency: r.currency, minor: Number(r.volume_minor) });
  }
  payments.successRate = successRate(payments.successful, payments.failed);

  const usage = { ...emptyUsage(), payments: metered.payments, apiCalls: metered.api_calls, successfulPayments: metered.successful, failedPayments: metered.failed, users };
  return ok(c, {
    period: period(start, endExclusive),
    plan,
    limits, // -1 means unlimited
    usage,
    percentUsed: {
      payments: percentUsed(usage.payments, limits.payments),
      apiCalls: percentUsed(usage.apiCalls, limits.apiCalls),
      users: percentUsed(users, limits.users),
    },
    payments,
  });
});

const detailsQuery = z.object({ startDate: isoDate.optional(), endDate: isoDate.optional(), groupBy: z.enum(['day', 'week', 'month']).default('day') });

// Payments over time, bucketed by day, week (Monday) or month in UTC. Buckets with nothing in
// them are left out. API calls are only metered per month, so they are null for day and week.
usageRoutes.get('/details', validate('query', detailsQuery), async (c) => {
  const deps = c.get('deps');
  const { organizationId } = c.get('user');
  const q = valid<z.infer<typeof detailsQuery>>(c, 'query');
  const now = deps.now();
  const { start, endExclusive } = resolveRange(now, q.startDate, q.endDate, new Date(now.getTime() - 30 * DAY));

  const rows = await deps.db.query<{ bucket: string; currency: string; total: number; successful: number; failed: number; volume_minor: string }>(
    `select to_char(date_trunc($4, created_at at time zone 'UTC'), 'YYYY-MM-DD') as bucket, currency::text,
            count(*)::int as total,
            count(*) filter (where status = 'COMPLETED')::int as successful,
            count(*) filter (where status = 'FAILED')::int as failed,
            coalesce(sum(round(amount_value * 100)) filter (where status = 'COMPLETED'), 0)::text as volume_minor
       from payments where organization_id = $1 and created_at >= $2 and created_at < $3
      group by 1, 2 order by 1, 2`,
    [organizationId, start, endExclusive, q.groupBy],
  );

  type Point = { period: string; payments: number; successful: number; failed: number; volumeByCurrency: Volume; apiCalls: number | null };
  const points = new Map<string, Point>();
  const point = (key: string): Point => {
    let p = points.get(key);
    if (!p) points.set(key, (p = { period: key, payments: 0, successful: 0, failed: 0, volumeByCurrency: {}, apiCalls: null }));
    return p;
  };
  for (const r of rows) {
    const p = point(r.bucket);
    p.payments += r.total;
    p.successful += r.successful;
    p.failed += r.failed;
    p.volumeByCurrency[r.currency] = Number(r.volume_minor);
  }

  if (q.groupBy === 'month') {
    const metered = await deps.db.query<{ month: string; api_calls: number }>(
      `select month, api_calls from billing_usage where organization_id = $1 and month >= $2 and month <= $3`,
      [organizationId, monthKey(start), monthKey(new Date(endExclusive.getTime() - 1))],
    );
    for (const m of metered) point(`${m.month}-01`).apiCalls = m.api_calls;
    for (const p of points.values()) p.apiCalls ??= 0;
  }

  return ok(c, {
    groupBy: q.groupBy,
    period: period(start, endExclusive),
    series: [...points.values()].sort((a, b) => a.period.localeCompare(b.period)),
  });
});
