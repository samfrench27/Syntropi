import { beforeEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/lib/crypto';
import { signPaymentToken } from '../src/lib/paymentToken';
import { cleanupNonGBBanks, syncBanksFromProviders } from '../src/services/banks';
import { createTestApp, type TestApp } from './helpers/app';

const SECRET = 'test-hosted-pages-secret-0123456789';
const ENV = { TOKEN_API_KEY: 'tok-test-key', TOKEN_API_BASE_URL: 'https://token.test', YAPILY_CLIENT_ID: 'yap-id', YAPILY_CLIENT_SECRET: 'yap-secret' };

// Small fictional provider responses
const tokenBank = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  bic: 'FICTGB2L',
  logoUri: `https://logos.test/${id}.png`,
  supportedLocalInstruments: ['FASTER_PAYMENTS'],
  supportsAccountList: true,
  supportsSinglePayment: true,
  ...extra,
});
const yapilyInst = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  fullName: name,
  countries: [{ countryCode2: 'GB' }],
  environmentType: 'LIVE',
  media: [{ source: `https://logos.test/${id}.png`, type: 'logo' }],
  features: ['ACCOUNTS', 'CREATE_DOMESTIC_SINGLE_PAYMENT'],
  ...extra,
});

interface Provider {
  tokenPages: any[][]; // one array of banks per page
  yapily: any[];
  tokenStatus: number;
  calls: { url: string; headers: any }[];
}

let t: TestApp;
let clock: Date;
let up: Provider;

const advance = (ms = 60_000) => (clock = new Date(clock.getTime() + ms));

async function setup(env: Record<string, string> = ENV) {
  clock = new Date('2026-10-09T10:00:00Z');
  up = { tokenPages: [[tokenBank('t-1', 'Alder Bank'), tokenBank('t-2', 'Birch Business Bank')]], yapily: [], tokenStatus: 200, calls: [] };
  t = await createTestApp({
    env,
    now: () => clock,
    fetch: async (input, init) => {
      const url = String(input);
      up.calls.push({ url, headers: init?.headers });
      if (url.startsWith('https://token.test/')) {
        if (up.tokenStatus !== 200) return new Response('nope', { status: up.tokenStatus });
        const page = Number(new URL(url).searchParams.get('page') || '1');
        return Response.json({ banks: up.tokenPages[page - 1] ?? [], paging: { page, perPage: 200, pageCount: up.tokenPages.length } });
      }
      if (url === 'https://api.yapily.com/institutions') return Response.json({ data: up.yapily });
      throw new Error(`Unexpected outbound request in test: ${url}`);
    },
  });
}

async function makeKey(orgId: string, permissions = ['read'], plain = `sk_banks_${Math.random().toString(36).slice(2)}`) {
  const userId = orgId === t.ids.orgA ? t.ids.userA : t.ids.userB;
  await t.admin((pg) =>
    pg.query(`insert into api_keys (organization_id, name, key_hash, key_prefix, permissions, created_by) values ($1, 'banks key', $2, 'sk_banks', $3, $4)`, [orgId, hash(plain), permissions, userId]),
  );
  return plain;
}
// sha256Hex is async; resolve it up front per key
let hashes = new Map<string, string>();
const hash = (plain: string) => hashes.get(plain)!;
async function key(orgId: string, permissions = ['read']) {
  const plain = `sk_banks_${Math.random().toString(36).slice(2)}`;
  hashes.set(plain, await sha256Hex(plain));
  return makeKey(orgId, permissions, plain);
}

const approve = (orgId: string, provider: string, status = 'approved') =>
  t.admin((pg) => pg.query(`insert into provider_access (organization_id, provider_code, status) values ($1, $2, $3)`, [orgId, provider, status]));
const makeSuperadmin = () => t.admin((pg) => pg.query(`update profiles set role = 'superadmin' where id = $1`, [t.ids.userA]));
const sync = (providers?: string[]) => syncBanksFromProviders(t.deps, providers);
const names = (json: any) => json.data.banks.map((b: any) => b.name);
const get = async (orgKey: string, path: string) => t.request('GET', path, { headers: { 'x-api-key': orgKey } });

beforeEach(() => setup());

describe('flexibleAuth on /api/banks', () => {
  it('rejects requests with no credentials', async () => {
    expect((await t.request('GET', '/api/banks')).status).toBe(401);
  });

  it('accepts an API key with read permission and rejects bad or under-privileged keys', async () => {
    expect((await get(await key(t.ids.orgA), '/api/banks')).status).toBe(200);
    expect((await get('sk_not_a_key', '/api/banks')).status).toBe(401);
    expect((await get(await key(t.ids.orgA, ['write']), '/api/banks')).status).toBe(403);
  });

  it('accepts a hosted-pages payment token', async () => {
    const token = await signPaymentToken(SECRET, { paymentId: 'pay_a1', organizationId: t.ids.orgA, clientId: 'client-a', purpose: 'hosted-pages-access' });
    const { status, json } = await t.request('GET', '/api/banks', { token });
    expect(status).toBe(200);
    expect(names(json)).toContain('National Bank of Test');
  });

  it('rejects a payment token meant for something else, and garbage tokens', async () => {
    const wrong = await signPaymentToken(SECRET, { paymentId: 'pay_a1', organizationId: t.ids.orgA, clientId: 'c', purpose: 'mock-bank-access' });
    expect((await t.request('GET', '/api/banks', { token: wrong })).status).toBe(401);
    expect((await t.request('GET', '/api/banks', { token: 'not-a-jwt' })).status).toBe(401);
  });

  it('accepts a signed-in user and keeps the existing auth failures (inactive account)', async () => {
    expect((await t.request('GET', '/api/banks', { user: t.ids.userA })).status).toBe(200);
    await t.admin((pg) => pg.query(`update profiles set status = 'suspended' where id = $1`, [t.ids.userA]));
    expect((await t.request('GET', '/api/banks', { user: t.ids.userA })).status).toBe(403);
  });

  it('applies to /providers and /:id too', async () => {
    expect((await t.request('GET', '/api/banks/providers')).status).toBe(401);
    expect((await t.request('GET', '/api/banks/gb-national-bank-of-test')).status).toBe(401);
  });
});

describe('approval-gated results', () => {
  beforeEach(async () => {
    up.yapily = [yapilyInst('y-1', 'Alder Bank'), yapilyInst('y-2', 'Yew Bank')];
    await sync(['token', 'yapily']);
  });

  it('shows an unapproved organization only the mock banks', async () => {
    const { json } = await get(await key(t.ids.orgB), '/api/banks');
    expect(names(json).sort()).toEqual(['Financial Trust Test', 'National Bank of Test']);
    expect(json.data.banks.every((b: any) => Object.keys(b.providerSupport).join() === 'mock')).toBe(true);
  });

  it('404s a real bank (by friendly id and by uuid) for an unapproved organization', async () => {
    const k = await key(t.ids.orgB);
    expect((await get(k, '/api/banks/gb-yew-bank')).status).toBe(404);
    const [{ id }] = await t.rows(`select id from banks where syntropi_id = 'gb-yew-bank'`);
    expect((await get(k, `/api/banks/${id}`)).status).toBe(404);
    // a pending or rejected request grants nothing
    await approve(t.ids.orgB, 'yapily', 'pending');
    expect((await get(k, '/api/banks/gb-yew-bank')).status).toBe(404);
  });

  it('shows approved providers only, and trims each bank to the providers allowed', async () => {
    await approve(t.ids.orgA, 'token');
    const k = await key(t.ids.orgA);
    const { json } = await get(k, '/api/banks');
    expect(names(json)).toEqual(['Alder Bank', 'Birch Business Bank', 'Financial Trust Test', 'National Bank of Test']);
    const alder = json.data.banks.find((b: any) => b.name === 'Alder Bank');
    // Alder Bank is also on Yapily, which this organization is not approved for
    expect(Object.keys(alder.providerSupport)).toEqual(['token']);
    expect(alder.recommendedProvider).toBe('token');
    expect(names(await get(k, '/api/banks?provider=yapily').then((r) => r.json))).toEqual([]);

    const one = await get(k, '/api/banks/gb-alder-bank');
    expect(one.status).toBe(200);
    expect(Object.keys(one.json.data.bank.providerSupport)).toEqual(['token']);
    expect((await get(k, '/api/banks/gb-yew-bank')).status).toBe(404);
  });

  it('does not leak between organizations', async () => {
    await approve(t.ids.orgA, 'yapily');
    expect(names((await get(await key(t.ids.orgB), '/api/banks')).json)).not.toContain('Yew Bank');
    expect(names((await get(await key(t.ids.orgA), '/api/banks')).json)).toContain('Yew Bank');
  });

  it('applies to payment tokens like API keys', async () => {
    const token = await signPaymentToken(SECRET, { paymentId: 'pay_b1', organizationId: t.ids.orgB, clientId: 'c', purpose: 'hosted-pages-access' });
    expect(names((await t.request('GET', '/api/banks', { token })).json)).not.toContain('Alder Bank');
  });

  it('an inactive provider approval stops counting once the provider is deactivated', async () => {
    await approve(t.ids.orgA, 'token');
    await t.admin((pg) => pg.query(`update providers set status = 'inactive' where code = 'token'`));
    expect(names((await get(await key(t.ids.orgA), '/api/banks')).json)).not.toContain('Alder Bank');
  });

  it('shows a superadmin everything', async () => {
    await makeSuperadmin();
    const { json } = await t.request('GET', '/api/banks', { user: t.ids.userA });
    expect(names(json)).toEqual(expect.arrayContaining(['Alder Bank', 'Yew Bank', 'National Bank of Test']));
    const alder = json.data.banks.find((b: any) => b.name === 'Alder Bank');
    expect(Object.keys(alder.providerSupport).sort()).toEqual(['token', 'yapily']);
  });

  it('lists only usable providers on /providers', async () => {
    const k = await key(t.ids.orgA);
    expect((await get(k, '/api/banks/providers')).json.data.providers).toEqual(['mock']);
    await approve(t.ids.orgA, 'token');
    expect((await get(k, '/api/banks/providers')).json.data.providers).toEqual(['mock', 'token']);
    await makeSuperadmin();
    expect((await t.request('GET', '/api/banks/providers', { user: t.ids.userA })).json.data.providers).toEqual(['mock', 'token', 'yapily']);
  });

  it('keeps the mock bank response shape callers rely on', async () => {
    const { json } = await get(await key(t.ids.orgB), '/api/banks/gb-national-bank-of-test');
    expect(json.success).toBe(true);
    expect(json.data.bank).toMatchObject({
      id: 'gb-national-bank-of-test',
      name: 'National Bank of Test',
      country: 'GB',
      active: true,
      supportedPaymentMethods: ['sepa', 'faster_payments', 'chaps'],
      features: { payments: true },
      recommendedProvider: 'mock',
    });
    expect(json.data.bank.providerSupport.mock).toMatchObject({ available: true, providerId: 'bank_001' });
    expect(json.data.bank.uuid).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('search, filters and pagination', () => {
  beforeEach(async () => {
    up.tokenPages = [[tokenBank('t-1', 'Alder Bank'), tokenBank('t-2', 'Cedar 100% Bank'), tokenBank('t-3', 'Cedar_Co Bank'), tokenBank('t-4', 'CedarXCo Bank', { supportedLocalInstruments: ['CHAPS'] })]];
    await sync(['token']);
    await approve(t.ids.orgA, 'token');
  });
  const list = async (qs: string) => (await get(await key(t.ids.orgA), `/api/banks${qs}`)).json;

  it('searches by name, case-insensitively', async () => {
    expect(names(await list('?search=alder'))).toEqual(['Alder Bank']);
  });

  it('treats % and _ in the search as literal characters', async () => {
    expect(names(await list(`?search=${encodeURIComponent('100%')}`))).toEqual(['Cedar 100% Bank']);
    expect(names(await list(`?search=${encodeURIComponent('r_c')}`))).toEqual(['Cedar_Co Bank']);
    expect(names(await list(`?search=${encodeURIComponent('%')}`))).toEqual(['Cedar 100% Bank']);
    expect(names(await list(`?search=${encodeURIComponent('\\')}`))).toEqual([]);
  });

  it('filters by payment method, provider and country', async () => {
    expect(names(await list('?paymentMethod=chaps'))).toEqual(['CedarXCo Bank', 'National Bank of Test']);
    expect(names(await list('?provider=token')).sort()).toEqual(['Alder Bank', 'Cedar 100% Bank', 'CedarXCo Bank', 'Cedar_Co Bank']);
    expect(names(await list('?country=DE'))).toEqual(['European Test Bank']);
    expect((await get(await key(t.ids.orgA), '/api/banks?country=GBR')).status).toBe(400);
  });

  it('paginates and reports totals', async () => {
    const p1 = await list('?limit=2&page=1');
    expect(p1.data.pagination).toEqual({ total: 6, page: 1, limit: 2, pages: 3 });
    expect(names(p1)).toEqual(['Alder Bank', 'Cedar 100% Bank']);
    const p3 = await list('?limit=2&page=3');
    expect(names(p3)).toEqual(['Financial Trust Test', 'National Bank of Test']);
    const beyond = await list('?limit=2&page=9');
    expect(beyond.data.banks).toEqual([]);
    expect(beyond.data.pagination.total).toBe(6);
  });

  it('serves a list request in two queries or fewer', async () => {
    const k = await key(t.ids.orgA);
    await get(k, '/api/banks'); // warm the API key cache
    const spy: string[] = [];
    const original = t.deps.db.query.bind(t.deps.db);
    t.deps.db.query = ((text: string, params?: unknown[]) => (spy.push(text), original(text, params))) as any;
    await get(k, '/api/banks?search=a');
    t.deps.db.query = original;
    // Excludes the API key's own bookkeeping statements, which run off the hot path
    expect(spy.filter((s) => !/api_keys|billing_increment/.test(s))).toHaveLength(2);
  });
});

describe('POST /api/banks/sync', () => {
  it('is superadmin only', async () => {
    expect((await t.request('POST', '/api/banks/sync')).status).toBe(401);
    expect((await t.request('POST', '/api/banks/sync', { user: t.ids.userA })).status).toBe(403); // admin
    expect((await t.request('POST', '/api/banks/sync', { headers: { 'x-api-key': await key(t.ids.orgA, ['read', 'write']) } })).status).toBe(401);
  });

  it('runs the sync and returns the Express summary shape', async () => {
    await makeSuperadmin();
    const { status, json } = await t.request('POST', '/api/banks/sync?provider=token', { user: t.ids.userA });
    expect(status).toBe(200);
    expect(json).toMatchObject({ success: true, message: 'Bank synchronization completed', data: { token: { created: 2, updated: 0, skipped: 0, total: 2 } } });
    expect(Object.keys(json.data)).toEqual(['token']);
  });

  it('reports an unsupported provider without crashing', async () => {
    await makeSuperadmin();
    const { json } = await t.request('POST', '/api/banks/sync?provider=nope', { user: t.ids.userA });
    expect(json.data.nope.error).toMatch(/Unsupported provider/);
  });
});

describe('syncBanksFromProviders', () => {
  const mapping = async (syntropiId: string, provider: string) =>
    (await t.rows(`select m.* from bank_provider_mappings m join banks b on b.id = m.bank_id where b.syntropi_id = $1 and m.provider_code = $2`, [syntropiId, provider]))[0];

  it('creates banks with friendly ids, mappings, GB country and features', async () => {
    const res = await sync(['token']);
    expect(res.token).toEqual({ created: 2, updated: 0, skipped: 0, total: 2 });
    const banks = await t.rows(`select syntropi_id, name, country, logo_url, supported_payment_methods from banks where syntropi_id like 'gb-%' and syntropi_id not like 'gb-national%' and syntropi_id not like 'gb-financial%' order by syntropi_id`);
    expect(banks.map((b) => b.syntropi_id)).toEqual(['gb-alder-bank', 'gb-birch-bank-business']);
    expect(banks[0]).toMatchObject({ country: 'GB', logo_url: 'https://logos.test/t-1.png', supported_payment_methods: ['faster_payments'] });
    const m = await mapping('gb-alder-bank', 'token');
    expect(m).toMatchObject({ provider_id: 't-1', active: true });
    expect(m.metadata.supportedFeatures).toMatchObject({ accountList: true, singlePayment: true });
  });

  it('calls Token with the configured base URL and key, and Yapily with basic auth, using the injected fetch', async () => {
    up.yapily = [yapilyInst('y-1', 'Yew Bank')];
    await sync();
    const tokenCall = up.calls.find((c) => c.url.startsWith('https://token.test/v2/banks'))!;
    expect(tokenCall.url).toContain('countries=GB');
    expect(tokenCall.headers.Authorization).toBe('Basic tok-test-key');
    expect(up.calls.find((c) => c.url.includes('yapily'))!.headers.Authorization).toBe(`Basic ${btoa('yap-id:yap-secret')}`);
  });

  it('updates on a second run instead of duplicating, and unions payment methods', async () => {
    await sync(['token']);
    advance();
    up.tokenPages = [[tokenBank('t-1', 'Alder Bank', { supportedLocalInstruments: ['CHAPS'] }), tokenBank('t-2', 'Birch Business Bank')]];
    const res = await sync(['token']);
    expect(res.token).toEqual({ created: 0, updated: 2, skipped: 0, total: 2 });
    expect(await t.rows(`select 1 from banks where name = 'Alder Bank'`)).toHaveLength(1);
    const [bank] = await t.rows(`select supported_payment_methods as m from banks where syntropi_id = 'gb-alder-bank'`);
    expect(bank.m.sort()).toEqual(['chaps', 'faster_payments']);
    expect((await mapping('gb-alder-bank', 'token')).supported_payment_methods).toEqual(['chaps']);
  });

  it('matches by name and country when the friendly id differs, keeping one bank for two providers', async () => {
    await t.admin((pg) => pg.query(`insert into banks (syntropi_id, name, country) values ('legacy-alder', 'ALDER BANK', 'GB')`));
    up.yapily = [yapilyInst('y-1', 'Alder Bank')];
    const res = await sync(['token', 'yapily']);
    expect(res.token).toMatchObject({ created: 1, updated: 1 }); // Alder matched the legacy row, Birch is new
    expect(res.yapily).toMatchObject({ created: 0, updated: 1 });
    expect(await t.rows(`select 1 from banks where lower(name) = 'alder bank'`)).toHaveLength(1);
    const maps = await t.rows(`select m.provider_code from bank_provider_mappings m join banks b on b.id = m.bank_id where b.syntropi_id = 'legacy-alder' order by 1`);
    expect(maps.map((m) => m.provider_code)).toEqual(['token', 'yapily']);
  });

  it('matches by the provider id when the bank was renamed', async () => {
    await sync(['token']);
    advance();
    up.tokenPages = [[tokenBank('t-1', 'Alder Bank Renamed'), tokenBank('t-2', 'Birch Business Bank')]];
    const res = await sync(['token']);
    expect(res.token).toMatchObject({ created: 0, updated: 2 });
  });

  it('marks mappings the provider no longer lists as inactive, hides them, and reactivates them on return', async () => {
    await sync(['token']);
    await approve(t.ids.orgA, 'token');
    const k = await key(t.ids.orgA);
    advance();
    up.tokenPages = [[tokenBank('t-1', 'Alder Bank')]];
    const res = await sync(['token']);
    expect(res.token).toEqual({ created: 0, updated: 1, skipped: 1, total: 2 });
    expect((await mapping('gb-birch-bank-business', 'token')).active).toBe(false);
    expect(names((await get(k, '/api/banks')).json)).not.toContain('Birch Business Bank');
    expect((await get(k, '/api/banks/gb-birch-bank-business')).status).toBe(404);

    advance();
    up.tokenPages = [[tokenBank('t-1', 'Alder Bank'), tokenBank('t-2', 'Birch Business Bank')]];
    await sync(['token']);
    expect((await mapping('gb-birch-bank-business', 'token')).active).toBe(true);
    expect((await get(k, '/api/banks/gb-birch-bank-business')).status).toBe(200);
  });

  it('never deactivates mappings of other providers or the mock bank', async () => {
    up.yapily = [yapilyInst('y-1', 'Yew Bank')];
    await sync(['token', 'yapily']);
    advance();
    up.tokenPages = [[tokenBank('t-1', 'Alder Bank')]];
    await sync(['token']);
    expect((await mapping('gb-yew-bank', 'yapily')).active).toBe(true);
    expect((await mapping('gb-national-bank-of-test', 'mock')).active).toBe(true);
  });

  it('skips a provider with missing credentials, with a note, and makes no request', async () => {
    await setup({ TOKEN_API_BASE_URL: 'https://token.test' }); // no key, no Yapily
    const res = await sync();
    expect(res.token.note).toMatch(/TOKEN_API_KEY/);
    expect(res.yapily.note).toMatch(/YAPILY_CLIENT_ID/);
    expect(res.truelayer.note).toMatch(/not implemented/);
    expect(res.tink.note).toMatch(/not implemented/);
    expect(res.token).toMatchObject({ created: 0, updated: 0, skipped: 0, total: 0 });
    expect(up.calls).toHaveLength(0);
  });

  it('has no built-in credentials: an empty env never reaches a provider', async () => {
    await setup({});
    await sync();
    expect(up.calls).toHaveLength(0);
  });

  it('reports a provider failure without touching existing data or the other providers', async () => {
    await sync(['token']);
    advance();
    up.tokenStatus = 500;
    up.yapily = [yapilyInst('y-1', 'Yew Bank')];
    const res = await sync();
    expect(res.token).toEqual({ error: 'Token.io returned HTTP 500' });
    expect(res.yapily).toMatchObject({ created: 1 });
    expect((await mapping('gb-alder-bank', 'token')).active).toBe(true);
  });

  it('does not deactivate anything when a provider returns an empty list', async () => {
    await sync(['token']);
    advance();
    up.tokenPages = [[]];
    const res = await sync(['token']);
    expect(res.token).toMatchObject({ skipped: 0, total: 0 });
    expect(res.token.note).toMatch(/no banks/);
    expect((await mapping('gb-alder-bank', 'token')).active).toBe(true);
  });

  it('follows Token pagination', async () => {
    up.tokenPages = [[tokenBank('t-1', 'Alder Bank')], [tokenBank('t-2', 'Birch Bank')]];
    const res = await sync(['token']);
    expect(res.token.created).toBe(2);
    expect(up.calls.filter((c) => c.url.includes('token.test'))).toHaveLength(2);
  });

  it('imports GB, non-sandbox Yapily institutions only', async () => {
    up.yapily = [
      yapilyInst('y-1', 'Yew Bank'),
      yapilyInst('y-2', 'Elm Bank', { countries: [{ countryCode2: 'DE' }] }),
      yapilyInst('y-3', 'Fir Sandbox', { environmentType: 'SANDBOX' }),
    ];
    const res = await sync(['yapily']);
    expect(res.yapily.created).toBe(1);
    expect(await t.rows(`select 1 from banks where name in ('Elm Bank', 'Fir Sandbox')`)).toHaveLength(0);
  });

  it('handles many banks in chunks', async () => {
    up.tokenPages = [Array.from({ length: 200 }, (_, i) => tokenBank(`t-${i}`, `Bulk Bank ${i}`))];
    const res = await sync(['token']);
    expect(res.token.created).toBe(200);
    advance();
    expect((await sync(['token'])).token).toMatchObject({ created: 0, updated: 200, skipped: 0 });
  });
});

describe('cleanupNonGBBanks', () => {
  it('deletes non-GB banks but keeps the mock banks', async () => {
    await t.admin((pg) => pg.query(`insert into banks (syntropi_id, name, country) values ('de-old', 'Old DE Bank', 'DE')`));
    expect(await cleanupNonGBBanks(t.deps.db)).toBe(1);
    expect(await t.rows(`select 1 from banks where country <> 'GB'`)).toHaveLength(3); // DE, SE, US mock banks
  });
});

describe('seed migration', () => {
  it('seeds five mock banks mapped to the mock provider', async () => {
    const rows = await t.rows(`select b.name, m.provider_id from banks b join bank_provider_mappings m on m.bank_id = b.id where m.provider_code = 'mock' order by m.provider_id`);
    expect(rows.map((r) => r.provider_id)).toEqual(['bank_001', 'bank_002', 'bank_003', 'bank_004', 'bank_005']);
  });
});
