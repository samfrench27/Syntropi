import { beforeEach, describe, expect, it } from 'vitest';
import { getActivityStats } from '../src/services/activityStats';
import { createTestApp, type TestApp } from './helpers/app';
import { addActivity, seedPeople, type People } from './admin-fixtures';

let t: TestApp;
let p: People;
let actA1: string;
let actB1: string;
beforeEach(async () => {
  t = await createTestApp();
  p = await seedPeople(t);
  actA1 = await addActivity(t, { orgId: p.orgA, userId: p.userA, action: 'admin.user.create', at: '2026-03-01T10:00:00Z', details: { n: 1 } });
  await addActivity(t, { orgId: p.orgA, userId: p.plainA, action: 'client.apiKey.create', at: '2026-03-02T10:00:00Z' });
  actB1 = await addActivity(t, { orgId: p.orgB, userId: p.userB, action: 'admin.user.create', at: '2026-03-01T11:00:00Z' });
});

const base = '/api/admin/activities';

describe('GET /api/admin/activities', () => {
  it('lists only own-organization activity for an org admin, newest first', async () => {
    const { status, json } = await t.request('GET', base, { user: p.userA });
    expect(status).toBe(200);
    expect(json.data.activities.map((a: any) => a.action)).toEqual(['client.apiKey.create', 'admin.user.create']);
    expect(json.data.activities[0]).toMatchObject({ _id: expect.any(String), user: { firstName: 'Pat', _id: p.plainA }, organization: { name: 'Acme Coffee' } });
    expect(json.data.pagination).toEqual({ total: 2, page: 1, limit: 20, pages: 1 });
  });
  it('shows a superadmin every organization', async () => {
    expect((await t.request('GET', base, { user: p.superId })).json.data.pagination.total).toBe(3);
    expect((await t.request('GET', `${base}?organizationId=${p.orgB}`, { user: p.superId })).json.data.activities).toHaveLength(1);
  });
  it('refuses other organizations, and cannot be widened with userId', async () => {
    expect((await t.request('GET', `${base}?organizationId=${p.orgB}`, { user: p.userA })).status).toBe(403);
    expect((await t.request('GET', `${base}?organizationId=${p.orgA}`, { user: p.userB })).status).toBe(403);
    const viaUser = await t.request('GET', `${base}?userId=${p.userB}`, { user: p.userA });
    expect(viaUser.json.data.activities).toHaveLength(0);
  });
  it('filters by action and date range and paginates', async () => {
    expect((await t.request('GET', `${base}?action=admin.user.create`, { user: p.userA })).json.data.activities).toHaveLength(1);
    expect((await t.request('GET', `${base}?startDate=2026-03-02T00:00:00Z`, { user: p.userA })).json.data.activities).toHaveLength(1);
    expect((await t.request('GET', `${base}?endDate=2026-03-01T23:59:59Z`, { user: p.userA })).json.data.activities).toHaveLength(1);
    expect((await t.request('GET', `${base}?userId=${p.plainA}`, { user: p.userA })).json.data.activities).toHaveLength(1);
    const page = await t.request('GET', `${base}?limit=1&page=2`, { user: p.userA });
    expect(page.json.data.activities).toHaveLength(1);
    expect(page.json.data.pagination).toEqual({ total: 2, page: 2, limit: 1, pages: 2 });
  });
  it('rejects bad filters', async () => {
    expect((await t.request('GET', `${base}?startDate=yesterday`, { user: p.userA })).status).toBe(400);
    expect((await t.request('GET', `${base}?userId=x`, { user: p.userA })).status).toBe(400);
  });
});

describe('GET /api/admin/activities/:id', () => {
  it('returns an activity in scope, hides other tenants, and validates', async () => {
    const own = await t.request('GET', `${base}/${actA1}`, { user: p.userA });
    expect(own.status).toBe(200);
    expect(own.json.data.activity).toMatchObject({ id: actA1, _id: actA1, action: 'admin.user.create', details: { n: 1 } });
    expect((await t.request('GET', `${base}/${actB1}`, { user: p.userA })).status).toBe(404);
    expect((await t.request('GET', `${base}/${actA1}`, { user: p.userB })).status).toBe(404);
    expect((await t.request('GET', `${base}/${actB1}`, { user: p.superId })).status).toBe(200);
    expect((await t.request('GET', `${base}/bad`, { user: p.userA })).status).toBe(400);
    expect((await t.request('GET', `${base}/${p.missing}`, { user: p.userA })).status).toBe(404);
  });
});

describe('activity statistics (SQL GROUP BY)', () => {
  const start = new Date('2026-03-01T00:00:00Z');
  const end = new Date('2026-03-31T00:00:00Z');

  it('groups by day and by action for one organization', async () => {
    await addActivity(t, { orgId: p.orgA, userId: p.userA, action: 'admin.user.create', at: '2026-03-02T23:00:00Z' });
    const s = await getActivityStats(t.deps.db, { organizationId: p.orgA }, start, end);
    expect(s.dailyStats).toEqual([
      { _id: { year: 2026, month: 3, day: 1 }, count: 1, actions: ['admin.user.create'] },
      { _id: { year: 2026, month: 3, day: 2 }, count: 2, actions: ['client.apiKey.create', 'admin.user.create'] },
    ]);
    expect(s.actionBreakdown).toEqual([
      { _id: 'admin.user.create', action: 'admin.user.create', count: 2 },
      { _id: 'client.apiKey.create', action: 'client.apiKey.create', count: 1 },
    ]);
  });
  it('covers every organization when none is given, and respects the date range', async () => {
    expect((await getActivityStats(t.deps.db, {}, start, end)).dailyStats[0].count).toBe(2);
    expect((await getActivityStats(t.deps.db, {}, new Date('2026-04-01T00:00:00Z'), new Date('2026-04-02T00:00:00Z'))).dailyStats).toEqual([]);
  });
});
