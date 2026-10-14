import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/app';
import { addActivity, seedPeople, type People } from './admin-fixtures';

let t: TestApp;
let p: People;
beforeEach(async () => {
  t = await createTestApp();
  p = await seedPeople(t);
});

const base = '/api/admin/organizations';
const newOrg = (over: Record<string, unknown> = {}) => ({ name: 'Cobalt Cycles', contactEmail: 'Hello@Cobalt.test', plan: 'starter', ...over });

describe('GET /api/admin/organizations', () => {
  it('shows an org admin only their own organization', async () => {
    const { status, json } = await t.request('GET', base, { user: p.userA });
    expect(status).toBe(200);
    expect(json.data.organizations.map((o: any) => o.id)).toEqual([p.orgA]);
    expect(json.data.organizations[0]).toMatchObject({
      _id: p.orgA,
      name: 'Acme Coffee',
      contactEmail: 'a@acme.test',
      settings: { rateLimit: 100, allowedProviders: ['mock'] },
    });
    expect(json.data.pagination).toEqual({ total: 1, page: 1, limit: 20, pages: 1 });
  });

  it('shows a superadmin everything, with filters and safe search', async () => {
    expect((await t.request('GET', base, { user: p.superId })).json.data.pagination.total).toBe(3);
    expect((await t.request('GET', `${base}?search=borealis`, { user: p.superId })).json.data.organizations).toHaveLength(1);
    expect((await t.request('GET', `${base}?search=%25`, { user: p.superId })).json.data.organizations).toHaveLength(0);
    expect((await t.request('GET', `${base}?plan=enterprise`, { user: p.superId })).json.data.organizations).toHaveLength(0);
  });

  it('lists approved providers as allowedProviders', async () => {
    await t.admin((pg) => pg.query(`insert into provider_access (organization_id, provider_code, status) values ($1, 'token', 'approved'), ($1, 'yapily', 'pending')`, [p.orgA]));
    const { json } = await t.request('GET', base, { user: p.userA });
    expect(json.data.organizations[0].settings.allowedProviders).toEqual(['mock', 'token']);
  });

  it('rejects bad filters', async () => {
    expect((await t.request('GET', `${base}?plan=gold`, { user: p.superId })).status).toBe(400);
  });
});

describe('GET /api/admin/organizations/:id', () => {
  it('returns the organization with stats', async () => {
    const { status, json } = await t.request('GET', `${base}/${p.orgA}`, { user: p.userA });
    expect(status).toBe(200);
    expect(json.data.stats).toEqual({ userCount: 2, apiKeyCount: 1 });
    expect(json.data.organization.id).toBe(p.orgA);
  });
  it('is forbidden across tenants, both ways, and open to a superadmin', async () => {
    expect((await t.request('GET', `${base}/${p.orgB}`, { user: p.userA })).status).toBe(403);
    expect((await t.request('GET', `${base}/${p.orgA}`, { user: p.userB })).status).toBe(403);
    expect((await t.request('GET', `${base}/${p.orgB}`, { user: p.superId })).status).toBe(200);
  });
  it('validates and 404s', async () => {
    expect((await t.request('GET', `${base}/bad`, { user: p.userA })).status).toBe(400);
    expect((await t.request('GET', `${base}/${p.missing}`, { user: p.superId })).status).toBe(404);
  });
});

describe('POST /api/admin/organizations', () => {
  it('creates an organization (superadmin)', async () => {
    const { status, json } = await t.request('POST', base, {
      user: p.superId,
      body: newOrg({ address: { city: 'Leeds' }, settings: { rateLimit: 250, webhookUrl: 'https://cobalt.test/hook' }, ownerId: p.plainA }),
    });
    expect(status).toBe(201);
    expect(json.data.organization).toMatchObject({
      name: 'Cobalt Cycles',
      contactEmail: 'hello@cobalt.test',
      billingEmail: 'hello@cobalt.test',
      plan: 'starter',
      status: 'active',
      address: { city: 'Leeds' },
      settings: { rateLimit: 250, webhookUrl: 'https://cobalt.test/hook' },
      ownerId: { id: p.plainA },
    });
    expect(await t.rows(`select 1 from activities where action = 'admin.organization.create'`)).toHaveLength(1);
  });
  it('is superadmin only', async () => {
    expect((await t.request('POST', base, { user: p.userA, body: newOrg() })).status).toBe(403);
    expect(await t.rows(`select 1 from organizations where name = 'Cobalt Cycles'`)).toHaveLength(0);
  });
  it('validates and 404s an unknown owner', async () => {
    for (const bad of [{ name: '' }, { contactEmail: 'x' }, { plan: 'gold' }, { ownerId: 'x' }, { settings: { webhookUrl: 'javascript:alert(1)' } }, { settings: { rateLimit: 0 } }]) {
      expect((await t.request('POST', base, { user: p.superId, body: newOrg(bad) })).status).toBe(400);
    }
    expect((await t.request('POST', base, { user: p.superId, body: newOrg({ ownerId: p.missing }) })).status).toBe(404);
  });
});

describe('PUT /api/admin/organizations/:id', () => {
  const put = (user: string, id: string, body: unknown) => t.request('PUT', `${base}/${id}`, { user, body });

  it('lets an org admin update their own contact details', async () => {
    const { status, json } = await put(p.userA, p.orgA, { name: 'Acme Coffee Co', billingEmail: 'bills@acme.test', settings: { webhookUrl: 'https://acme.test/hook' } });
    expect(status).toBe(200);
    expect(json.data.organization).toMatchObject({ name: 'Acme Coffee Co', billingEmail: 'bills@acme.test', settings: { webhookUrl: 'https://acme.test/hook' } });
  });
  it('accepts a form that resends unchanged plan, status and rate limit', async () => {
    expect((await put(p.userA, p.orgA, { plan: 'free', status: 'active', settings: { rateLimit: 100 } })).status).toBe(200);
  });
  it('stops an org admin changing plan, status or rate limit', async () => {
    expect((await put(p.userA, p.orgA, { plan: 'growth' })).status).toBe(403);
    expect((await put(p.userA, p.orgA, { plan: 'enterprise' })).status).toBe(403);
    expect((await put(p.userA, p.orgA, { status: 'suspended' })).status).toBe(403);
    expect((await put(p.userA, p.orgA, { settings: { rateLimit: 99999 } })).status).toBe(403);
    expect((await t.rows(`select plan, status, rate_limit from organizations where id = $1`, [p.orgA]))[0]).toEqual({ plan: 'free', status: 'active', rate_limit: 100 });
  });
  it('lets a superadmin change anything, anywhere', async () => {
    const { status, json } = await put(p.superId, p.orgB, { plan: 'enterprise', status: 'suspended', settings: { rateLimit: 500 } });
    expect(status).toBe(200);
    expect(json.data.organization).toMatchObject({ plan: 'enterprise', status: 'suspended', settings: { rateLimit: 500 } });
  });
  it('is forbidden across tenants, both ways', async () => {
    expect((await put(p.userA, p.orgB, { name: 'Hacked' })).status).toBe(403);
    expect((await put(p.userB, p.orgA, { name: 'Hacked' })).status).toBe(403);
    expect((await t.rows(`select name from organizations where id in ($1, $2) order by name`, [p.orgA, p.orgB])).map((r) => r.name)).toEqual(['Acme Coffee', 'Borealis Retail']);
  });
  it('validates and 404s', async () => {
    expect((await put(p.userA, p.orgA, { contactEmail: 'x' })).status).toBe(400);
    expect((await put(p.userA, 'bad', {})).status).toBe(400);
    expect((await put(p.superId, p.missing, {})).status).toBe(404);
  });
});

describe('DELETE /api/admin/organizations/:id', () => {
  const del = (user: string, id: string) => t.request('DELETE', `${base}/${id}`, { user });

  it('deletes an empty organization with its keys (superadmin)', async () => {
    const [{ id }] = await t.admin(async (pg) => (await pg.query(`insert into organizations (name, contact_email) values ('Empty Ltd', 'e@empty.test') returning id`)).rows as any[]);
    await t.admin((pg) => pg.query(`insert into api_keys (organization_id, name, key_hash, key_prefix, created_by) values ($1, 'k', 'h-empty', 'sk_e', $2)`, [id, p.superId]));
    expect((await del(p.superId, id)).status).toBe(200);
    expect(await t.rows(`select 1 from organizations where id = $1`, [id])).toHaveLength(0);
    expect(await t.rows(`select 1 from api_keys where key_hash = 'h-empty'`)).toHaveLength(0);
  });
  it('is superadmin only', async () => {
    expect((await del(p.userA, p.orgA)).status).toBe(403);
    expect((await del(p.userA, p.orgB)).status).toBe(403);
  });
  it('refuses the platform organization and organizations with users', async () => {
    expect((await del(p.superId, p.platformOrg)).status).toBe(403);
    expect((await del(p.superId, p.orgA)).status).toBe(400);
  });
  it('validates and 404s', async () => {
    expect((await del(p.superId, 'bad')).status).toBe(400);
    expect((await del(p.superId, p.missing)).status).toBe(404);
  });
});

describe('organization sub-resources', () => {
  it('lists users, keys and activities of the own organization only', async () => {
    await addActivity(t, { orgId: p.orgA, userId: p.userA, action: 'x.a' });
    await addActivity(t, { orgId: p.orgB, userId: p.userB, action: 'x.b' });
    const users = await t.request('GET', `${base}/${p.orgA}/users`, { user: p.userA });
    expect(users.json.data.users.map((u: any) => u.id).sort()).toEqual([p.userA, p.plainA].sort());
    const keys = await t.request('GET', `${base}/${p.orgA}/api-keys`, { user: p.userA });
    expect(keys.json.data.apiKeys).toHaveLength(1);
    expect(keys.json.data.apiKeys[0]).toMatchObject({ keyPrefix: 'sk_aaaa', createdBy: { id: p.userA } });
    expect(JSON.stringify(keys.json)).not.toContain('hash-a');
    const acts = await t.request('GET', `${base}/${p.orgA}/activities`, { user: p.userA });
    expect(acts.json.data.activities.map((a: any) => a.action)).toEqual(['x.a']);
  });
  it('is forbidden across tenants, both ways, on every sub-resource', async () => {
    for (const sub of ['users', 'api-keys', 'activities']) {
      expect((await t.request('GET', `${base}/${p.orgB}/${sub}`, { user: p.userA })).status).toBe(403);
      expect((await t.request('GET', `${base}/${p.orgA}/${sub}`, { user: p.userB })).status).toBe(403);
      expect((await t.request('GET', `${base}/${p.orgB}/${sub}`, { user: p.superId })).status).toBe(200);
      expect((await t.request('GET', `${base}/bad/${sub}`, { user: p.userA })).status).toBe(400);
      expect((await t.request('GET', `${base}/${p.missing}/${sub}`, { user: p.superId })).status).toBe(404);
    }
  });
});
