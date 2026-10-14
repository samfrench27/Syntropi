import { beforeEach, describe, expect, it } from 'vitest';
import { generateApiKey } from '../src/lib/crypto';
import { createTestApp, type TestApp } from './helpers/app';

let t: TestApp;
let superId: string;
let plainUserA: string;
let adminA2: string;

async function addUser(role: string, org: string, email: string, first = 'Test', last = 'Person') {
  const [u] = await t.admin((pg) => pg.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]).then((r) => r.rows));
  await t.admin((pg) => pg.query(`insert into profiles (id, email, first_name, last_name, role, organization_id) values ($1, $2, $3, $4, $5, $6)`, [u.id, email, first, last, role, org]));
  return u.id as string;
}

const providers = (user: string) => t.request('GET', '/api/client/providers', { user });
const request = (user: string, code: string, note?: string) => t.request('POST', `/api/client/providers/${code}/request`, { user, body: note === undefined ? {} : { note } });
const queue = (query = '', user = superId) => t.request('GET', `/api/admin/provider-requests${query}`, { user });
const decide = (id: string, verb: string, note?: string, user = superId) => t.request('POST', `/api/admin/provider-requests/${id}/${verb}`, { user, body: note === undefined ? {} : { note } });
const find = (res: any, code: string) => res.json.data.providers.find((p: any) => p.code === code);

beforeEach(async () => {
  t = await createTestApp({
    env: { TOKEN_API_KEY: 'k', TOKEN_API_BASE_URL: 'https://token.test' },
    fetch: async () => new Response(JSON.stringify({ payment: { id: 'tok_1', status: 'INITIATION_PENDING' } })),
  });
  superId = await addUser('superadmin', t.ids.orgA, 'root@syntropi.test', 'Sam', 'Root');
  plainUserA = await addUser('user', t.ids.orgA, 'plain@acme.test');
  adminA2 = await addUser('admin', t.ids.orgA, 'second@acme.test');
}, 60000);

describe('client providers', () => {
  it('lists the catalogue for the organization: Mock bank always on, others none, inactive hidden', async () => {
    const res = await providers(t.ids.userA);
    expect(res.status).toBe(200);
    const list = res.json.data.providers;
    expect(list.map((p: any) => p.code)).toEqual(['mock', 'token', 'yapily']);
    expect(find(res, 'mock')).toMatchObject({ accessStatus: 'approved', alwaysOn: true, name: 'Mock bank' });
    expect(find(res, 'token')).toMatchObject({ accessStatus: 'none', alwaysOn: false, requestNote: null, reviewNote: null });
    expect(find(res, 'truelayer')).toBeUndefined();
  });

  it('is visible to plain users too, and needs sign-in', async () => {
    expect((await providers(plainUserA)).status).toBe(200);
    expect((await t.request('GET', '/api/client/providers')).status).toBe(401);
  });

  it('shows each organization only its own access', async () => {
    await request(t.ids.userA, 'token', 'Pay by bank at checkout');
    expect(find(await providers(t.ids.userA), 'token')).toMatchObject({ accessStatus: 'pending', requestNote: 'Pay by bank at checkout' });
    expect(find(await providers(t.ids.userB), 'token').accessStatus).toBe('none');
  });

  it('creates a pending request, and logs it', async () => {
    const res = await request(t.ids.userA, 'token', '  Launching in Q1  ');
    expect(res.status).toBe(201);
    expect(res.json.data.provider).toMatchObject({ code: 'token', accessStatus: 'pending', requestNote: 'Launching in Q1' });

    const [row] = await t.rows(`select status, requested_by, request_note from provider_access where organization_id = $1`, [t.ids.orgA]);
    expect(row).toMatchObject({ status: 'pending', requested_by: t.ids.userA, request_note: 'Launching in Q1' });
    const acts = await t.rows(`select action, user_id from activities where organization_id = $1 and action like 'provider_access.%'`, [t.ids.orgA]);
    expect(acts).toEqual([{ action: 'provider_access.request', user_id: t.ids.userA }]);
  });

  it('is idempotent while pending: no new row, no second log, the original note stays', async () => {
    await request(t.ids.userA, 'token', 'first');
    const again = await request(adminA2, 'token', 'second');
    expect(again.status).toBe(200);
    expect(again.json.data.provider).toMatchObject({ accessStatus: 'pending', requestNote: 'first' });
    expect(await t.rows(`select 1 from provider_access`)).toHaveLength(1);
    expect(await t.rows(`select 1 from activities where action = 'provider_access.request'`)).toHaveLength(1);
  });

  it('answers 409 for an approved provider, 404 for unknown or inactive, 400 for mock', async () => {
    await t.admin((pg) => pg.query(`insert into provider_access (organization_id, provider_code, status) values ($1, 'token', 'approved')`, [t.ids.orgA]));
    expect((await request(t.ids.userA, 'token')).status).toBe(409);
    expect((await request(t.ids.userA, 'nonesuch')).status).toBe(404);
    expect((await request(t.ids.userA, 'truelayer')).status).toBe(404); // inactive
    const mock = await request(t.ids.userA, 'mock');
    expect(mock.status).toBe(400);
    expect(await t.rows(`select 1 from provider_access where provider_code in ('mock', 'truelayer')`)).toEqual([]);
  });

  it('lets only organization admins request; a plain user gets 403 and nothing is written', async () => {
    expect((await request(plainUserA, 'token')).status).toBe(403);
    expect((await t.request('POST', '/api/client/providers/token/request', { body: {} })).status).toBe(401);
    expect(await t.rows(`select 1 from provider_access`)).toEqual([]);
  });

  it('validates the note', async () => {
    expect((await request(t.ids.userA, 'token', 'x'.repeat(1001))).status).toBe(400);
    expect((await t.request('POST', '/api/client/providers/token/request', { user: t.ids.userA, body: { note: 42 } })).status).toBe(400);
  });

  it('allows a new request after a rejection or revocation, clearing the review', async () => {
    await request(t.ids.userA, 'token', 'please');
    const [{ id }] = await t.rows(`select id from provider_access`);

    await decide(id, 'reject', 'Not yet');
    expect(find(await providers(t.ids.userA), 'token')).toMatchObject({ accessStatus: 'rejected', reviewNote: 'Not yet' });

    const again = await request(t.ids.userA, 'token', 'we fixed it');
    expect(again.status).toBe(201);
    expect(again.json.data.provider).toMatchObject({ accessStatus: 'pending', requestNote: 'we fixed it', reviewNote: null, reviewedAt: null });
    expect(await t.rows(`select 1 from provider_access`)).toHaveLength(1);
    expect((await t.rows(`select reviewed_by, reviewed_at, review_note from provider_access`))[0]).toEqual({ reviewed_by: null, reviewed_at: null, review_note: null });

    await decide(id, 'approve');
    await decide(id, 'revoke', 'Contract ended');
    expect((await request(t.ids.userA, 'token')).json.data.provider.accessStatus).toBe('pending');
  });
});

describe('admin approval queue', () => {
  let reqId: string;
  beforeEach(async () => {
    await request(t.ids.userA, 'token', 'Pay by bank');
    await request(t.ids.userB, 'yapily', 'Account data');
    [{ id: reqId }] = await t.rows(`select id from provider_access where organization_id = $1`, [t.ids.orgA]);
  });

  it('is for superadmins only', async () => {
    expect((await queue('', t.ids.userA)).status).toBe(403); // an org admin
    expect((await queue('', plainUserA)).status).toBe(403);
    expect((await t.request('GET', '/api/admin/provider-requests')).status).toBe(401);
    expect((await decide(reqId, 'approve', undefined, t.ids.userA)).status).toBe(403);
    expect((await t.rows(`select status from provider_access where id = $1`, [reqId]))[0].status).toBe('pending');
  });

  it('lists requests newest first with organization, requester and counts', async () => {
    const res = await queue();
    expect(res.status).toBe(200);
    const { requests, pagination, counts } = res.json.data;
    expect(requests.map((r: any) => r.providerCode)).toEqual(['yapily', 'token']);
    expect(requests[1]).toMatchObject({
      id: reqId,
      organizationId: t.ids.orgA,
      organizationName: 'Acme Coffee',
      providerCode: 'token',
      providerName: 'Token.io',
      status: 'pending',
      requestNote: 'Pay by bank',
      requestedBy: { id: t.ids.userA, name: 'Ada Admin', email: 'a@acme.test' },
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
    });
    expect(requests[1].requestedAt).toBeTruthy();
    expect(pagination).toEqual({ total: 2, page: 1, limit: 20, pages: 1 });
    expect(counts).toEqual({ pending: 2, approved: 0, rejected: 0, revoked: 0 });
  });

  it('filters by status and organization, paginates, and counts everything regardless of the filter', async () => {
    await decide(reqId, 'approve');
    const pending = await queue('?status=pending');
    expect(pending.json.data.requests.map((r: any) => r.providerCode)).toEqual(['yapily']);
    expect(pending.json.data.counts).toEqual({ pending: 1, approved: 1, rejected: 0, revoked: 0 });

    expect((await queue('?status=approved')).json.data.requests).toHaveLength(1);
    expect((await queue(`?organizationId=${t.ids.orgB}`)).json.data.requests).toHaveLength(1);
    const page = await queue('?limit=1&page=2');
    expect(page.json.data.requests).toHaveLength(1);
    expect(page.json.data.pagination).toMatchObject({ total: 2, page: 2, limit: 1, pages: 2 });
    expect((await queue('?status=bogus')).status).toBe(400);
  });

  it('gets one request, or 404 / 400', async () => {
    expect((await t.request('GET', `/api/admin/provider-requests/${reqId}`, { user: superId })).json.data.request).toMatchObject({ id: reqId, organizationName: 'Acme Coffee' });
    expect((await t.request('GET', '/api/admin/provider-requests/00000000-0000-0000-0000-000000000999', { user: superId })).status).toBe(404);
    expect((await t.request('GET', '/api/admin/provider-requests/nope', { user: superId })).status).toBe(400);
  });

  it('approves, recording the reviewer, note, time and an activity row for the organization', async () => {
    const res = await decide(reqId, 'approve', 'Welcome aboard');
    expect(res.status).toBe(200);
    expect(res.json.data.request).toMatchObject({
      status: 'approved',
      reviewNote: 'Welcome aboard',
      reviewedBy: { id: superId, name: 'Sam Root', email: 'root@syntropi.test' },
    });
    expect(res.json.data.request.reviewedAt).toBeTruthy();

    const acts = await t.rows(`select action, user_id, organization_id, details from activities where action like 'admin.provider_access.%'`);
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ action: 'admin.provider_access.approve', user_id: superId, organization_id: t.ids.orgA });
    expect(acts[0].details).toMatchObject({ providerCode: 'token', requestId: reqId, note: 'Welcome aboard' });
  });

  it('approves without a note', async () => {
    const res = await decide(reqId, 'approve');
    expect(res.json.data.request).toMatchObject({ status: 'approved', reviewNote: null });
  });

  it('requires a note to reject or revoke', async () => {
    expect((await decide(reqId, 'reject')).status).toBe(400);
    expect((await decide(reqId, 'reject', '   ')).status).toBe(400);
    expect((await t.rows(`select status from provider_access where id = $1`, [reqId]))[0].status).toBe('pending');
    expect((await decide(reqId, 'reject', 'Not a fit')).json.data.request).toMatchObject({ status: 'rejected', reviewNote: 'Not a fit' });

    await decide(reqId, 'approve');
    expect((await decide(reqId, 'revoke')).status).toBe(400);
  });

  it('only allows the valid transitions, everything else is 409', async () => {
    // pending cannot be revoked
    expect((await decide(reqId, 'revoke', 'x')).status).toBe(409);
    // pending -> approved; approved cannot be approved or rejected again
    expect((await decide(reqId, 'approve')).status).toBe(200);
    expect((await decide(reqId, 'approve')).status).toBe(409);
    expect((await decide(reqId, 'reject', 'x')).status).toBe(409);
    // approved -> revoked; revoked is final until the organization asks again
    expect((await decide(reqId, 'revoke', 'Contract ended')).json.data.request.status).toBe('revoked');
    expect((await decide(reqId, 'approve')).status).toBe(409);
    expect((await decide(reqId, 'revoke', 'x')).status).toBe(409);
    expect((await decide(reqId, 'reject', 'x')).status).toBe(409);
  });

  it('allows rejected -> approved', async () => {
    await decide(reqId, 'reject', 'Not yet');
    expect((await decide(reqId, 'reject', 'again')).status).toBe(409);
    const res = await decide(reqId, 'approve', 'Changed our mind');
    expect(res.json.data.request.status).toBe('approved');
  });

  it('answers 404 for unknown requests', async () => {
    expect((await decide('00000000-0000-0000-0000-000000000999', 'approve')).status).toBe(404);
  });
});

describe('the whole approval flow, as payments see it', () => {
  const payment = (key: string, provider: string) =>
    t.request('POST', '/api/payments', {
      headers: { 'x-api-key': key },
      body: { provider, toAccount: { accountName: 'Acme', sortCode: '040004', accountNumber: '12345678' }, amount: { value: '12.00', currency: 'GBP' }, redirectUrl: 'https://shop.test/r' },
    });

  it('blocks token until approved, allows it after, and blocks it again after reject or revoke', async () => {
    const k = await generateApiKey();
    await t.admin((pg) => pg.query(`insert into api_keys (organization_id, name, key_hash, key_prefix, permissions, created_by) values ($1, 'k', $2, $3, '{read,write}', $4)`, [t.ids.orgA, k.hash, k.prefix, t.ids.userA]));

    expect((await payment(k.key, 'token')).json.error.code).toBe('PROVIDER_NOT_APPROVED');

    await request(t.ids.userA, 'token', 'please');
    expect((await payment(k.key, 'token')).status).toBe(403); // pending is not enough

    const [{ id }] = await t.rows(`select id from provider_access where organization_id = $1`, [t.ids.orgA]);
    await decide(id, 'reject', 'Missing paperwork');
    expect((await payment(k.key, 'token')).status).toBe(403);

    await request(t.ids.userA, 'token', 'paperwork attached');
    await decide(id, 'approve', 'Thanks');
    expect((await providers(t.ids.userA)).json.data.providers.find((p: any) => p.code === 'token').accessStatus).toBe('approved');
    const allowed = await payment(k.key, 'token');
    expect(allowed.status).toBe(201);
    expect(allowed.json.data.provider).toBe('token');

    // Another organization is still blocked
    const kb = await generateApiKey();
    await t.admin((pg) => pg.query(`insert into api_keys (organization_id, name, key_hash, key_prefix, permissions, created_by) values ($1, 'k', $2, $3, '{read,write}', $4)`, [t.ids.orgB, kb.hash, kb.prefix, t.ids.userB]));
    expect((await payment(kb.key, 'token')).status).toBe(403);

    await decide(id, 'revoke', 'Contract ended');
    expect((await payment(k.key, 'token')).status).toBe(403);
    // The Mock bank was never affected
    expect((await payment(k.key, 'mock')).status).toBe(201);
  });
});
