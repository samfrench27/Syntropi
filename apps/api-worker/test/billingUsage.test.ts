import { beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { ApiError } from '../src/http';
import { usageRoutes } from '../src/routes/client/usage';
import type { AppEnv } from '../src/types';
import { createTestApp, type TestApp } from './helpers/app';
import { EXTRA, seedExtraUsers } from './billingFake';

// /api/client/usage is not mounted in src/app.ts yet, so mount it on a small app with the same deps
let t: TestApp;
let usageApp: Hono<AppEnv>;
const NOW = new Date('2026-10-15T12:00:00Z');

beforeEach(async () => {
  t = await createTestApp({ now: () => NOW });
  await seedExtraUsers(t);
  usageApp = new Hono<AppEnv>();
  usageApp.use('*', async (c, next) => {
    c.set('deps', t.deps);
    await next();
  });
  usageApp.route('/api/client/usage', usageRoutes);
  usageApp.onError((err, c) => (err instanceof ApiError ? c.json({ success: false, error: { message: err.message } }, err.status as 400) : c.json({ success: false }, 500)));

  await t.admin(async (pg) => {
    await pg.query(`update organizations set plan = 'growth' where id = $1`, [t.ids.orgA]);
    await pg.query(`select billing_increment($1, '2026-10', 7, 40, 5, 2)`, [t.ids.orgA]);
    await pg.query(`select billing_increment($1, '2026-09', 20, 300, 18, 2)`, [t.ids.orgA]);
    await pg.query(`select billing_increment($1, '2026-10', 99, 999, 90, 9)`, [t.ids.orgB]);
    await pg.query(`delete from payments`);
    await pg.query(
      `insert into payments (payment_id, organization_id, client_id, to_account, amount_value, currency, provider_code, status, created_at) values
        ('a1', $1, 'c', '{}', 10.10, 'GBP', 'mock', 'COMPLETED', '2026-10-01T09:00:00Z'),
        ('a2', $1, 'c', '{}', 20.20, 'GBP', 'mock', 'COMPLETED', '2026-10-01T23:30:00Z'),
        ('a3', $1, 'c', '{}', 5.00, 'GBP', 'mock', 'FAILED', '2026-10-02T09:00:00Z'),
        ('a4', $1, 'c', '{}', 3.00, 'EUR', 'mock', 'COMPLETED', '2026-10-10T09:00:00Z'),
        ('a5', $1, 'c', '{}', 8.00, 'GBP', 'mock', 'PENDING', '2026-10-13T09:00:00Z'),
        ('a6', $1, 'c', '{}', 100.00, 'GBP', 'mock', 'COMPLETED', '2026-09-20T09:00:00Z'),
        ('b1', $2, 'c', '{}', 777.00, 'GBP', 'mock', 'COMPLETED', '2026-10-01T09:00:00Z')`,
      [t.ids.orgA, t.ids.orgB],
    );
  });
}, 60000);

async function get(path: string, user?: string) {
  const headers: Record<string, string> = {};
  if (user) headers.Authorization = `Bearer ${await t.tokenFor(user)}`;
  const res = await usageApp.request(`/api/client/usage${path}`, { headers });
  return { status: res.status, json: (await res.json()) as any };
}

describe('auth', () => {
  it('needs a sign-in and is open to every role', async () => {
    expect((await get('/summary')).status).toBe(401);
    expect((await get('/details')).status).toBe(401);
    for (const user of [t.ids.userA, EXTRA.plainA, EXTRA.superadmin]) expect((await get('/summary', user)).status).toBe(200);
  });
});

describe('GET /summary', () => {
  it('defaults to this month so far: metered usage, plan limits and payment outcomes', async () => {
    const { status, json } = await get('/summary', t.ids.userA);
    expect(status).toBe(200);
    expect(json.data).toEqual({
      period: { startDate: '2026-10-01T00:00:00.000Z', endDate: '2026-10-15T12:00:00.000Z' },
      plan: 'growth',
      limits: { payments: 1000, apiCalls: 10000, users: 25 },
      usage: { payments: 7, apiCalls: 40, successfulPayments: 5, failedPayments: 2, users: 3 },
      percentUsed: { payments: 0.7, apiCalls: 0.4, users: 12 },
      payments: {
        total: 5,
        successful: 3,
        failed: 1,
        successRate: 75,
        volumeByCurrency: [
          { currency: 'EUR', minor: 300 },
          { currency: 'GBP', minor: 3030 },
        ],
      },
    });
  });

  it('covers a date range across months, with a bare end date meaning the whole day', async () => {
    const { json } = await get('/summary?startDate=2026-09-01&endDate=2026-10-01', t.ids.userA);
    expect(json.data.usage).toMatchObject({ payments: 27, apiCalls: 340, successfulPayments: 23, failedPayments: 4 });
    // 1 Oct is included in full: both of its payments
    expect(json.data.payments.total).toBe(3);
    expect(json.data.payments.volumeByCurrency).toEqual([{ currency: 'GBP', minor: 13030 + 0 }]);
  });

  it('reports unlimited limits as -1 with no percentage (enterprise)', async () => {
    await t.admin((pg) => pg.query(`update organizations set plan = 'enterprise' where id = $1`, [t.ids.orgA]));
    const { json } = await get('/summary', t.ids.userA);
    expect(json.data.limits).toEqual({ payments: -1, apiCalls: -1, users: -1 });
    expect(json.data.percentUsed).toEqual({ payments: null, apiCalls: null, users: null });
  });

  it('is limited to the caller organization', async () => {
    const { json } = await get('/summary', t.ids.userB);
    expect(json.data.usage).toMatchObject({ payments: 99, apiCalls: 999, users: 1 });
    expect(json.data.payments).toMatchObject({ total: 1, volumeByCurrency: [{ currency: 'GBP', minor: 77700 }] });
    expect(json.data.plan).toBe('free');
  });

  it('is all zeros for an organization with no activity', async () => {
    await t.admin((pg) => pg.exec(`delete from billing_usage; delete from payments`));
    const { json } = await get('/summary', t.ids.userA);
    expect(json.data.usage).toMatchObject({ payments: 0, apiCalls: 0, successfulPayments: 0, failedPayments: 0 });
    expect(json.data.payments).toEqual({ total: 0, successful: 0, failed: 0, successRate: 0, volumeByCurrency: [] });
  });

  it('validates dates', async () => {
    for (const q of ['startDate=yesterday', 'endDate=2026-13-45', 'startDate=2026-10-05&endDate=2026-10-01', 'startDate=2024-01-01&endDate=2026-01-01']) {
      expect((await get(`/summary?${q}`, t.ids.userA)).status, q).toBe(400);
    }
  });
});

describe('GET /details', () => {
  it('groups payments by day (UTC), oldest first, leaving empty days out', async () => {
    const { status, json } = await get('/details?startDate=2026-10-01&endDate=2026-10-15', t.ids.userA);
    expect(status).toBe(200);
    expect(json.data.groupBy).toBe('day');
    expect(json.data.series).toEqual([
      { period: '2026-10-01', payments: 2, successful: 2, failed: 0, volumeByCurrency: { GBP: 3030 }, apiCalls: null },
      { period: '2026-10-02', payments: 1, successful: 0, failed: 1, volumeByCurrency: { GBP: 0 }, apiCalls: null },
      { period: '2026-10-10', payments: 1, successful: 1, failed: 0, volumeByCurrency: { EUR: 300 }, apiCalls: null },
      { period: '2026-10-13', payments: 1, successful: 0, failed: 0, volumeByCurrency: { GBP: 0 }, apiCalls: null },
    ]);
  });

  it('groups by week starting Monday', async () => {
    const { json } = await get('/details?startDate=2026-10-01&endDate=2026-10-15&groupBy=week', t.ids.userA);
    expect(json.data.series.map((s: any) => [s.period, s.payments])).toEqual([
      ['2026-09-28', 3],
      ['2026-10-05', 1],
      ['2026-10-12', 1],
    ]);
  });

  it('groups by month and adds metered API calls', async () => {
    const { json } = await get('/details?startDate=2026-09-01&endDate=2026-10-31&groupBy=month', t.ids.userA);
    expect(json.data.series).toEqual([
      { period: '2026-09-01', payments: 1, successful: 1, failed: 0, volumeByCurrency: { GBP: 10000 }, apiCalls: 300 },
      { period: '2026-10-01', payments: 5, successful: 3, failed: 1, volumeByCurrency: { EUR: 300, GBP: 3030 }, apiCalls: 40 },
    ]);
  });

  it('defaults to the last 30 days and never shows another organization', async () => {
    const a = await get('/details', t.ids.userA);
    expect(a.json.data.period.startDate).toBe('2026-09-15T12:00:00.000Z');
    expect(a.json.data.series.reduce((n: number, s: any) => n + s.payments, 0)).toBe(6);
    const b = await get('/details', t.ids.userB);
    expect(b.json.data.series).toEqual([{ period: '2026-10-01', payments: 1, successful: 1, failed: 0, volumeByCurrency: { GBP: 77700 }, apiCalls: null }]);
  });

  it('validates groupBy and dates', async () => {
    expect((await get('/details?groupBy=year', t.ids.userA)).status).toBe(400);
    expect((await get('/details?startDate=nope', t.ids.userA)).status).toBe(400);
    expect((await get("/details?groupBy=day';drop table payments;--", t.ids.userA)).status).toBe(400);
  });
});
