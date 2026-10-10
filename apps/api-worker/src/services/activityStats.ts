import type { Db } from '../db';

/**
 * Port of Express `activity.service.getAnalyticsData`: daily counts and a per-action breakdown,
 * done in SQL with GROUP BY. Pass `organizationId` to confine it to one tenant.
 *
 * As in Express, the daily stats respect the date range but the action breakdown counts every
 * activity matching the filter.
 */
export async function getActivityStats(db: Db, filter: { organizationId?: string }, startDate: Date, endDate: Date) {
  const org = filter.organizationId ?? null;

  const daily = await db.query<{ year: number; month: number; day: number; count: string; actions: string[] }>(
    `select extract(year from created_at at time zone 'UTC')::int as year,
            extract(month from created_at at time zone 'UTC')::int as month,
            extract(day from created_at at time zone 'UTC')::int as day,
            count(*) as count,
            array_agg(action order by created_at) as actions
       from activities
      where ($1::uuid is null or organization_id = $1::uuid)
        and created_at >= $2::timestamptz and created_at <= $3::timestamptz
      group by 1, 2, 3
      order by 1, 2, 3`,
    [org, startDate.toISOString(), endDate.toISOString()],
  );

  const breakdown = await db.query<{ action: string; count: string }>(
    `select action, count(*) as count
       from activities
      where ($1::uuid is null or organization_id = $1::uuid)
      group by action
      order by count(*) desc, action`,
    [org],
  );

  return {
    dailyStats: daily.map((d) => ({
      _id: { year: d.year, month: d.month, day: d.day },
      count: Number(d.count),
      actions: d.actions,
    })),
    actionBreakdown: breakdown.map((b) => ({ _id: b.action, action: b.action, count: Number(b.count) })),
  };
}
