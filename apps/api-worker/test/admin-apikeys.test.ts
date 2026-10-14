import { beforeEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/lib/crypto';
import { createTestApp, type TestApp } from './helpers/app';
import { seedPeople, type People } from './admin-fixtures';

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

const base = '/api/admin/api-keys';

describe('POST /api/admin/api-keys', () => {
  it('creates a key, returns the plaintext once and stores only its hash', async () => {
    const { status, json } = await t.request('POST', base, {
      user: p.userA,
      body: { name: 'Checkout', organizationId: p.orgA, environment: 'production', permissions: ['read', 'write'] },
    });
    expect(status).toBe(201);
    const d = json.data;
    expect(d.key).toMatch(/^sk_[0-9a-f]{48}$/);
    expect(d.apiKey.key).toBe(d.key);
    expect(d).toMatchObject({ _id: d.id, name: 'Checkout', environment: 'production', permissions: ['read', 'write'], keyPrefix: d.key.slice(0, 11) });

    const [row] = await t.rows(`select key_hash, key_prefix, created_by, organization_id from api_keys where id = $1`, [d.id]);
    expect(row).toMatchObject({ key_hash: await sha256Hex(d.key), key_prefix: d.key.slice(0, 11), created_by: p.userA, organization_id: p.orgA });
    expect(JSON.stringify(await t.rows(`select * from api_keys where id = $1`, [d.id]))).not.toContain(d.key);
    expect(await t.rows(`select 1 from activities where action = 'admin.apiKey.create'`)).toHaveLength(1);

    // Reading it back never shows the plaintext
    const again = await t.request('GET', `${base}/${d.id}`, { user: p.userA });
    expect(JSON.stringify(again.json)).not.toContain(d.key);
  });
  it('defaults to a sandbox key with no permissions', async () => {
    const { json } = await t.request('POST', base, { user: p.userA, body: { name: 'Bare', organizationId: p.orgA } });
    expect(json.data).toMatchObject({ environment: 'sandbox', permissions: [] });
  });
  it('will not create keys in another organization, either way, but a superadmin can', async () => {
    expect((await t.request('POST', base, { user: p.userA, body: { name: 'x', organizationId: p.orgB } })).status).toBe(403);
    expect((await t.request('POST', base, { user: p.userB, body: { name: 'x', organizationId: p.orgA } })).status).toBe(403);
    expect((await t.request('POST', base, { user: p.superId, body: { name: 'x', organizationId: p.orgB } })).status).toBe(201);
  });
  it('validates and 404s an unknown organization', async () => {
    for (const bad of [{ name: '' }, { organizationId: 'x' }, { environment: 'prod' }, { permissions: ['root'] }]) {
      expect((await t.request('POST', base, { user: p.userA, body: { name: 'k', organizationId: p.orgA, ...bad } })).status).toBe(400);
    }
    expect((await t.request('POST', base, { user: p.superId, body: { name: 'k', organizationId: p.missing } })).status).toBe(404);
  });
});

describe('GET /api/admin/api-keys', () => {
  it('lists the own organization only, never the key or hash', async () => {
    const { status, json } = await t.request('GET', base, { user: p.userA });
    expect(status).toBe(200);
    expect(json.data.apiKeys).toHaveLength(1);
    expect(json.data.apiKeys[0]).toMatchObject({ id: keyA, _id: keyA, keyPrefix: 'sk_aaaa', organization: { id: p.orgA, name: 'Acme Coffee' }, isActive: true });
    expect(JSON.stringify(json)).not.toMatch(/hash-a|key_hash|keyHash/);
    expect(json.data.pagination.total).toBe(1);
  });
  it('refuses another organization via the filter, and lets a superadmin see all', async () => {
    expect((await t.request('GET', `${base}?organizationId=${p.orgB}`, { user: p.userA })).status).toBe(403);
    expect((await t.request('GET', `${base}?organizationId=${p.orgA}`, { user: p.userB })).status).toBe(403);
    expect((await t.request('GET', base, { user: p.superId })).json.data.pagination.total).toBe(2);
  });
  it('hides revoked keys unless asked, and filters by environment', async () => {
    await t.request('DELETE', `${base}/${keyA}`, { user: p.userA });
    expect((await t.request('GET', base, { user: p.userA })).json.data.apiKeys).toHaveLength(0);
    expect((await t.request('GET', `${base}?isActive=false`, { user: p.userA })).json.data.apiKeys).toHaveLength(1);
    expect((await t.request('GET', `${base}?isActive=false&environment=production`, { user: p.userA })).json.data.apiKeys).toHaveLength(0);
    expect((await t.request('GET', `${base}?environment=moon`, { user: p.userA })).status).toBe(400);
  });
});

describe('GET /api/admin/api-keys/:id', () => {
  it('returns own key (no secret) and hides other tenants', async () => {
    const own = await t.request('GET', `${base}/${keyA}`, { user: p.userA });
    expect(own.status).toBe(200);
    expect(own.json.data.apiKey).toMatchObject({ id: keyA, keyPrefix: 'sk_aaaa' });
    expect(own.json.data.apiKey.key).toBeUndefined();
    expect((await t.request('GET', `${base}/${keyB}`, { user: p.userA })).status).toBe(404);
    expect((await t.request('GET', `${base}/${keyA}`, { user: p.userB })).status).toBe(404);
    expect((await t.request('GET', `${base}/${keyB}`, { user: p.superId })).status).toBe(200);
  });
  it('validates and 404s', async () => {
    expect((await t.request('GET', `${base}/bad`, { user: p.userA })).status).toBe(400);
    expect((await t.request('GET', `${base}/${p.missing}`, { user: p.userA })).status).toBe(404);
  });
});

describe('DELETE /api/admin/api-keys/:id', () => {
  it('revokes (deactivates) a key and logs it', async () => {
    const { status } = await t.request('DELETE', `${base}/${keyA}`, { user: p.userA });
    expect(status).toBe(200);
    expect((await t.rows(`select is_active from api_keys where id = $1`, [keyA]))[0].is_active).toBe(false);
    expect(await t.rows(`select 1 from activities where action = 'admin.apiKey.revoke'`)).toHaveLength(1);
  });
  it("will not revoke another organization's key, either way", async () => {
    expect((await t.request('DELETE', `${base}/${keyB}`, { user: p.userA })).status).toBe(404);
    expect((await t.request('DELETE', `${base}/${keyA}`, { user: p.userB })).status).toBe(404);
    expect((await t.rows(`select is_active from api_keys`)).every((r) => r.is_active)).toBe(true);
    expect((await t.request('DELETE', `${base}/${keyB}`, { user: p.superId })).status).toBe(200);
  });
  it('validates and 404s', async () => {
    expect((await t.request('DELETE', `${base}/bad`, { user: p.userA })).status).toBe(400);
    expect((await t.request('DELETE', `${base}/${p.missing}`, { user: p.userA })).status).toBe(404);
  });
});
