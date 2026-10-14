import { beforeEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/lib/crypto';
import { createTestApp, type TestApp } from './helpers/app';
import { addActivity, seedPeople, type People } from './admin-fixtures';

let t: TestApp;
let p: People;
let keyA: string;
let keyB: string;
beforeEach(async () => {
  t = await createTestApp();
  p = await seedPeople(t);
  keyA = (await t.rows(`select id from api_keys where organization_id = $1`, [p.orgA]))[0].id;
  keyB = (await t.rows(`select id from api_keys where organization_id = $1`, [p.orgB]))[0].id;
});

describe('client API keys', () => {
  const base = '/api/client/api-keys';

  it('creates a key for the caller organization and shows the plaintext once', async () => {
    // Even if the body names another organization, the caller's own is used
    const { status, json } = await t.request('POST', base, {
      user: p.plainA,
      body: { name: 'Shop', environment: 'production', permissions: ['read'], organizationId: p.orgB },
    });
    expect(status).toBe(201);
    const d = json.data;
    expect(d.key).toMatch(/^sk_[0-9a-f]{48}$/);
    expect(d).toMatchObject({ _id: d.id, name: 'Shop', environment: 'production', permissions: ['read'], apiKey: { key: d.key } });
    const [row] = await t.rows(`select organization_id, key_hash, created_by from api_keys where id = $1`, [d.id]);
    expect(row).toEqual({ organization_id: p.orgA, key_hash: await sha256Hex(d.key), created_by: p.plainA });
    expect(await t.rows(`select 1 from activities where action = 'client.apiKey.create' and organization_id = $1`, [p.orgA])).toHaveLength(1);
  });
  it('validates the body', async () => {
    for (const bad of [{ name: '' }, { environment: 'x' }, { permissions: ['root'] }, {}]) {
      expect((await t.request('POST', base, { user: p.userA, body: bad })).status).toBe(400);
    }
  });

  it('lists active keys of the own organization without secrets', async () => {
    const { status, json } = await t.request('GET', base, { user: p.userA });
    expect(status).toBe(200);
    expect(json.data.apiKeys).toHaveLength(1);
    expect(json.data.apiKeys[0]).toMatchObject({ id: keyA, _id: keyA, keyPrefix: 'sk_aaaa', createdBy: { id: p.userA } });
    expect(JSON.stringify(json)).not.toMatch(/hash-a|keyHash/);
    expect(json.data.pagination).toEqual({ total: 1, page: 1, limit: 20, pages: 1 });
    expect((await t.request('GET', base, { user: p.userB })).json.data.apiKeys.map((k: any) => k.id)).toEqual([keyB]);
  });
  it('ignores an organizationId query parameter', async () => {
    expect((await t.request('GET', `${base}?organizationId=${p.orgB}`, { user: p.userA })).json.data.apiKeys.map((k: any) => k.id)).toEqual([keyA]);
  });

  it('gets own key and 404s the other tenant, both ways', async () => {
    expect((await t.request('GET', `${base}/${keyA}`, { user: p.userA })).json.data.apiKey.id).toBe(keyA);
    expect((await t.request('GET', `${base}/${keyB}`, { user: p.userA })).status).toBe(404);
    expect((await t.request('GET', `${base}/${keyA}`, { user: p.userB })).status).toBe(404);
    expect((await t.request('GET', `${base}/${keyB}`, { user: p.superId })).status).toBe(404);
    expect((await t.request('GET', `${base}/bad`, { user: p.userA })).status).toBe(400);
    expect((await t.request('GET', `${base}/${p.missing}`, { user: p.userA })).status).toBe(404);
  });

  it('revokes own key only', async () => {
    expect((await t.request('DELETE', `${base}/${keyB}`, { user: p.userA })).status).toBe(404);
    expect((await t.request('DELETE', `${base}/${keyA}`, { user: p.userB })).status).toBe(404);
    expect((await t.rows(`select is_active from api_keys`)).every((r) => r.is_active)).toBe(true);
    expect((await t.request('DELETE', `${base}/${keyA}`, { user: p.userA })).status).toBe(200);
    expect((await t.rows(`select is_active from api_keys where id = $1`, [keyA]))[0].is_active).toBe(false);
    expect((await t.request('GET', base, { user: p.userA })).json.data.apiKeys).toHaveLength(0);
    expect(await t.rows(`select 1 from activities where action = 'client.apiKey.revoke'`)).toHaveLength(1);
    expect((await t.request('DELETE', `${base}/bad`, { user: p.userA })).status).toBe(400);
    expect((await t.request('DELETE', `${base}/${p.missing}`, { user: p.userA })).status).toBe(404);
  });
});

describe('client organization', () => {
  const base = '/api/client/organization';

  it('returns the caller organization and stats', async () => {
    const { status, json } = await t.request('GET', base, { user: p.plainA });
    expect(status).toBe(200);
    expect(json.data.organization).toMatchObject({ id: p.orgA, _id: p.orgA, name: 'Acme Coffee', settings: { rateLimit: 100, allowedProviders: ['mock'] } });
    expect(json.data.stats).toEqual({ userCount: 2, apiKeyCount: 1 });
    expect((await t.request('GET', base, { user: p.userB })).json.data.organization.id).toBe(p.orgB);
  });

  it('lets an org admin update contact details and webhook only', async () => {
    const { status, json } = await t.request('PUT', base, {
      user: p.userA,
      body: { contactEmail: 'Team@Acme.test', address: { city: 'Leeds' }, settings: { webhookUrl: 'https://acme.test/hook' }, plan: 'enterprise', status: 'suspended', name: 'Hacked' },
    });
    expect(status).toBe(200);
    expect(json.data.organization).toMatchObject({ contactEmail: 'team@acme.test', address: { city: 'Leeds' }, settings: { webhookUrl: 'https://acme.test/hook' } });
    expect((await t.rows(`select name, plan, status from organizations where id = $1`, [p.orgA]))[0]).toEqual({ name: 'Acme Coffee', plan: 'free', status: 'active' });
    expect((await t.rows(`select contact_email from organizations where id = $1`, [p.orgB]))[0].contact_email).toBe('b@borealis.test');
    expect(await t.rows(`select 1 from activities where action = 'client.organization.update'`)).toHaveLength(1);
  });
  it('is closed to non-admin roles', async () => {
    expect((await t.request('PUT', base, { user: p.plainA, body: { contactEmail: 'x@acme.test' } })).status).toBe(403);
    expect((await t.request('PUT', base, { user: p.superId, body: { contactEmail: 'x@acme.test' } })).status).toBe(403);
  });
  it('validates', async () => {
    expect((await t.request('PUT', base, { user: p.userA, body: { contactEmail: 'nope' } })).status).toBe(400);
    expect((await t.request('PUT', base, { user: p.userA, body: { settings: { webhookUrl: 'ftp://x.test' } } })).status).toBe(400);
  });
});

describe('client activities', () => {
  const base = '/api/client/activities';

  it('lists only the caller organization, whatever the query says', async () => {
    await addActivity(t, { orgId: p.orgA, userId: p.userA, action: 'a.one', at: '2026-03-01T00:00:00Z' });
    await addActivity(t, { orgId: p.orgA, userId: p.plainA, action: 'a.two', at: '2026-03-05T00:00:00Z' });
    await addActivity(t, { orgId: p.orgB, userId: p.userB, action: 'b.one' });
    const { status, json } = await t.request('GET', `${base}?organizationId=${p.orgB}`, { user: p.plainA });
    expect(status).toBe(200);
    expect(json.data.activities.map((a: any) => a.action)).toEqual(['a.two', 'a.one']);
    expect(json.data.activities[0]).toMatchObject({ _id: expect.any(String), user: { firstName: 'Pat' } });
    expect(json.data.pagination).toEqual({ total: 2, page: 1, limit: 20, pages: 1 });
    expect((await t.request('GET', base, { user: p.userB })).json.data.activities.map((a: any) => a.action)).toEqual(['b.one']);
  });
  it('filters by action and dates, and rejects bad dates', async () => {
    await addActivity(t, { orgId: p.orgA, userId: p.userA, action: 'a.one', at: '2026-03-01T00:00:00Z' });
    await addActivity(t, { orgId: p.orgA, userId: p.userA, action: 'a.two', at: '2026-03-05T00:00:00Z' });
    expect((await t.request('GET', `${base}?action=a.one`, { user: p.userA })).json.data.activities).toHaveLength(1);
    expect((await t.request('GET', `${base}?startDate=2026-03-03T00:00:00Z`, { user: p.userA })).json.data.activities).toHaveLength(1);
    expect((await t.request('GET', `${base}?endDate=2026-03-03T00:00:00Z`, { user: p.userA })).json.data.activities).toHaveLength(1);
    expect((await t.request('GET', `${base}?startDate=soon`, { user: p.userA })).status).toBe(400);
  });
});
