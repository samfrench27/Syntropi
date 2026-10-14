import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/app';
import { seedPeople, type People } from './admin-fixtures';

let t: TestApp;
let p: People;
beforeEach(async () => {
  t = await createTestApp();
  p = await seedPeople(t);
});

const base = '/api/admin/providers';
const newProvider = (over: Record<string, unknown> = {}) => ({
  name: 'Fjord Pay',
  code: 'fjord',
  description: 'Fictional provider',
  apiSpec: { baseUrl: 'https://api.fjord.test', version: 'v1', documentation: 'https://docs.fjord.test' },
  features: ['payments'],
  status: 'active',
  settings: { sandbox: true },
  ...over,
});
const idOf = async (code: string) => (await t.rows(`select id from providers where code = $1`, [code]))[0].id as string;

describe('reads (any admin)', () => {
  it('lists the catalogue by name, with id and _id', async () => {
    const { status, json } = await t.request('GET', base, { user: p.userA });
    expect(status).toBe(200);
    const names = json.data.providers.map((x: any) => x.name);
    expect(names).toEqual([...names].sort());
    expect(json.data.providers.find((x: any) => x.code === 'token')).toMatchObject({
      _id: expect.any(String),
      apiSpec: { baseUrl: 'https://api.token.io', version: 'v2' },
      features: ['payments', 'banks'],
      status: 'active',
    });
  });
  it('gets one, 404s, and validates', async () => {
    const id = await idOf('yapily');
    expect((await t.request('GET', `${base}/${id}`, { user: p.userB })).json.data.provider.code).toBe('yapily');
    expect((await t.request('GET', `${base}/${p.missing}`, { user: p.userA })).status).toBe(404);
    expect((await t.request('GET', `${base}/bad`, { user: p.userA })).status).toBe(400);
  });
});

describe('POST /api/admin/providers', () => {
  it('creates a provider (superadmin)', async () => {
    const { status, json } = await t.request('POST', base, { user: p.superId, body: newProvider({ logoUrl: 'https://fjord.test/logo.png' }) });
    expect(status).toBe(201);
    expect(json.data.provider).toMatchObject({ code: 'fjord', features: ['payments'], settings: { sandbox: true }, apiSpec: { version: 'v1' }, logoUrl: 'https://fjord.test/logo.png' });
    expect(await t.rows(`select 1 from activities where action = 'admin.provider.create'`)).toHaveLength(1);
  });
  it('applies the Express defaults', async () => {
    const { json } = await t.request('POST', base, { user: p.superId, body: { name: 'Bare', code: 'bare' } });
    expect(json.data.provider).toMatchObject({ status: 'inactive', features: [], settings: {}, apiSpec: { baseUrl: '', version: '1.0' } });
  });
  it('is superadmin only', async () => {
    expect((await t.request('POST', base, { user: p.userA, body: newProvider() })).status).toBe(403);
  });
  it('rejects duplicates and bad bodies', async () => {
    expect((await t.request('POST', base, { user: p.superId, body: newProvider({ code: 'token' }) })).status).toBe(400);
    for (const bad of [{ code: 'Bad Code' }, { name: '' }, { status: 'gone' }, { logoUrl: 'javascript:x' }, { features: 'x' }]) {
      expect((await t.request('POST', base, { user: p.superId, body: newProvider(bad) })).status).toBe(400);
    }
  });
});

describe('PUT /api/admin/providers/:id', () => {
  it('updates fields and merges apiSpec (superadmin)', async () => {
    const id = await idOf('token');
    const { status, json } = await t.request('PUT', `${base}/${id}`, { user: p.superId, body: { description: 'New text', status: 'maintenance', features: ['banks'], apiSpec: { version: 'v3' } } });
    expect(status).toBe(200);
    expect(json.data.provider).toMatchObject({ description: 'New text', status: 'maintenance', features: ['banks'], code: 'token', apiSpec: { baseUrl: 'https://api.token.io', version: 'v3' } });
  });
  it('is superadmin only', async () => {
    expect((await t.request('PUT', `${base}/${await idOf('token')}`, { user: p.userA, body: { name: 'x' } })).status).toBe(403);
  });
  it('validates and 404s', async () => {
    expect((await t.request('PUT', `${base}/${await idOf('token')}`, { user: p.superId, body: { status: 'gone' } })).status).toBe(400);
    expect((await t.request('PUT', `${base}/bad`, { user: p.superId, body: {} })).status).toBe(400);
    expect((await t.request('PUT', `${base}/${p.missing}`, { user: p.superId, body: {} })).status).toBe(404);
  });
});

describe('DELETE /api/admin/providers/:id', () => {
  it('deletes a provider (superadmin)', async () => {
    const id = await idOf('tink');
    expect((await t.request('DELETE', `${base}/${id}`, { user: p.superId })).status).toBe(200);
    expect(await t.rows(`select 1 from providers where code = 'tink'`)).toHaveLength(0);
    expect(await t.rows(`select 1 from activities where action = 'admin.provider.delete'`)).toHaveLength(1);
  });
  it('is superadmin only, and protects the Mock bank and providers with payments', async () => {
    expect((await t.request('DELETE', `${base}/${await idOf('tink')}`, { user: p.userA })).status).toBe(403);
    expect((await t.request('DELETE', `${base}/${await idOf('mock')}`, { user: p.superId })).status).toBe(403);
    await t.admin((pg) => pg.query(`update payments set provider_code = 'yapily' where payment_id = 'pay_a1'`));
    expect((await t.request('DELETE', `${base}/${await idOf('yapily')}`, { user: p.superId })).status).toBe(409);
  });
  it('validates and 404s', async () => {
    expect((await t.request('DELETE', `${base}/bad`, { user: p.superId })).status).toBe(400);
    expect((await t.request('DELETE', `${base}/${p.missing}`, { user: p.superId })).status).toBe(404);
  });
});
