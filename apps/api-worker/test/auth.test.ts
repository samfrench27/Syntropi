import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, ISSUER, STRONG_PASSWORD, type TestApp } from './helpers/app';

let t: TestApp;
beforeEach(async () => {
  t = await createTestApp();
});

describe('authenticate (Supabase access tokens)', () => {
  it('accepts a valid token and returns the signed-in profile', async () => {
    const { status, json } = await t.request('GET', '/api/auth/me', { user: t.ids.userA });
    expect(status).toBe(200);
    expect(json.data.user).toMatchObject({
      id: t.ids.userA,
      role: 'admin',
      organizationId: t.ids.orgA,
      organization: { id: t.ids.orgA, name: 'Acme Coffee' },
    });
  });

  it('rejects a request with no token', async () => {
    expect((await t.request('GET', '/api/auth/me')).status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = await t.tokenFor(t.ids.userA, { expiresIn: '-1m' });
    expect((await t.request('GET', '/api/auth/me', { token })).status).toBe(401);
  });

  it('rejects a token signed by a different key', async () => {
    const token = await t.tokenFor(t.ids.userA, { key: t.keys.otherKey });
    expect((await t.request('GET', '/api/auth/me', { token })).status).toBe(401);
  });

  it('rejects the wrong issuer and the wrong audience', async () => {
    const wrongIssuer = await t.tokenFor(t.ids.userA, { issuer: 'https://evil.example/auth/v1' });
    const wrongAudience = await t.tokenFor(t.ids.userA, { audience: 'anon' });
    expect((await t.request('GET', '/api/auth/me', { token: wrongIssuer })).status).toBe(401);
    expect((await t.request('GET', '/api/auth/me', { token: wrongAudience })).status).toBe(401);
    expect(ISSUER).toContain('/auth/v1');
  });

  it('rejects a valid token whose user has no profile', async () => {
    const token = await t.tokenFor('00000000-0000-0000-0000-00000000dead', { role: 'admin' });
    expect((await t.request('GET', '/api/auth/me', { token })).status).toBe(401);
  });

  it('blocks accounts that are not active', async () => {
    await t.admin((pg) => pg.query(`update profiles set status = 'suspended' where id = $1`, [t.ids.userA]));
    expect((await t.request('GET', '/api/auth/me', { user: t.ids.userA })).status).toBe(403);
  });

  it('rejects a token with no role claim, and ignores user_metadata', async () => {
    const noRole = await t.tokenFor(t.ids.userA, { role: null });
    expect((await t.request('GET', '/api/auth/me', { token: noRole })).status).toBe(403);
    const sneaky = await t.tokenFor(t.ids.userA, { role: null, userMetadata: { role: 'superadmin' } });
    expect((await t.request('GET', '/api/auth/me', { token: sneaky })).status).toBe(403);
  });

  it('asks for a refresh when the role changed after the token was issued', async () => {
    const stale = await t.tokenFor(t.ids.userA); // says admin
    await t.admin((pg) => pg.query(`update profiles set role = 'user' where id = $1`, [t.ids.userA]));
    const { status, json } = await t.request('GET', '/api/auth/me', { token: stale });
    expect(status).toBe(401);
    expect(json.error.message).toMatch(/refresh/i);
  });
});

describe('POST /api/auth/signup', () => {
  const body = { email: 'New@Example.test', password: STRONG_PASSWORD, firstName: 'Ada', lastName: 'Lovelace', companyName: 'Analytical Co' };
  const leftovers = async () =>
    (await t.rows(`select (select count(*) from organizations where name = 'Analytical Co')::int as orgs, (select count(*) from profiles where lower(email) = 'new@example.test')::int as profiles`))[0];

  it('creates the company, the identity and the profile, with the Mock bank only', async () => {
    const { status, json } = await t.request('POST', '/api/auth/signup', { body });
    expect(status).toBe(201);
    expect(json).toMatchObject({ success: true, data: { emailConfirmationRequired: true } });

    const [profile] = await t.rows(`select p.id, p.role, p.organization_id, o.name, o.owner_id from profiles p join organizations o on o.id = p.organization_id where lower(p.email) = 'new@example.test'`);
    expect(profile).toMatchObject({ role: 'admin', name: 'Analytical Co' });
    expect(profile.owner_id).toBe(profile.id);
    // trusted claims are what authenticate reads
    expect(t.fake.metadata.get(profile.id)).toEqual({ role: 'admin', organization_id: profile.organization_id });
    // nothing granted beyond the Mock bank
    expect(await t.rows(`select 1 from provider_access where organization_id = $1`, [profile.organization_id])).toEqual([]);
    expect((await t.rows(`select action from activities where organization_id = $1`, [profile.organization_id])).map((a) => a.action)).toEqual(['auth.signup']);
  });

  it('gives the same answer for an email that already has an account, and creates nothing', async () => {
    const existing = { ...body, email: 'a@acme.test' };
    const { status, json } = await t.request('POST', '/api/auth/signup', { body: existing });
    expect(status).toBe(201);
    expect(json.data.emailConfirmationRequired).toBe(true);
    expect(t.fake.calls).not.toContain('signUp');
    expect((await leftovers()).orgs).toBe(0);
  });

  it('gives the same answer when the identity provider says the address is registered', async () => {
    t.fake.registered.add('new@example.test');
    const { status } = await t.request('POST', '/api/auth/signup', { body });
    expect(status).toBe(201);
    expect(await leftovers()).toEqual({ orgs: 0, profiles: 0 });
  });

  it('rolls everything back if setting the trusted claims fails', async () => {
    t.fake.failures.setAppMetadata = new Error('supabase down');
    const { status, json } = await t.request('POST', '/api/auth/signup', { body });
    expect(status).toBe(500);
    expect(json.error.message).toBe('Internal Server Error'); // no detail leaks
    expect(await leftovers()).toEqual({ orgs: 0, profiles: 0 });
    expect(t.fake.calls).toContain('deleteUser');
  });

  it('rejects bad input with a 400', async () => {
    for (const bad of [{ email: 'not-an-email' }, { companyName: '' }, { firstName: '' }]) {
      const { status, json } = await t.request('POST', '/api/auth/signup', { body: { ...body, ...bad } });
      expect(status).toBe(400);
      expect(json.error.message).toBe('Validation failed');
    }
    expect(t.fake.calls).not.toContain('signUp');
  });

  it('rejects a weak password with WEAK_PASSWORD, says what is missing, and never reaches the identity provider', async () => {
    const { status, json } = await t.request('POST', '/api/auth/signup', { body: { ...body, password: 'short' } });
    expect(status).toBe(400);
    expect(json.error.code).toBe('WEAK_PASSWORD');
    expect(json.error.details).toEqual(expect.arrayContaining(['length', 'uppercase', 'number']));
    expect(json.error.message).toMatch(/^Your password needs:/);
    // 11 characters, one short of the minimum
    const eleven = await t.request('POST', '/api/auth/signup', { body: { ...body, password: 'Harbor-Lam1' } });
    expect(eleven.status).toBe(400);
    expect(eleven.json.error.details).toEqual(['length']);
    expect(t.fake.calls).not.toContain('signUp');
    expect(await leftovers()).toEqual({ orgs: 0, profiles: 0 });
  });

  it('rejects commonly used passwords however they are dressed up', async () => {
    for (const password of ['Password1234', 'p@ssw0rd1234', 'Qwerty123456', 'Welcome12345!']) {
      const { status, json } = await t.request('POST', '/api/auth/signup', { body: { ...body, password } });
      expect(status, password).toBe(400);
      expect(json.error.details, password).toContain('common');
    }
  });

  it('rejects a password built from the email name or the person\'s name', async () => {
    const byName = await t.request('POST', '/api/auth/signup', { body: { ...body, password: 'Lovelace-Harbor-77' } });
    expect(byName.status).toBe(400);
    expect(byName.json.error.details).toContain('personal');
    const byEmail = await t.request('POST', '/api/auth/signup', { body: { ...body, email: 'quiet.harbor@example.test', password: 'Quiet.Harbor-Lamps-77' } });
    expect(byEmail.status).toBe(400);
    expect(byEmail.json.error.details).toContain('personal');
  });

  it('accepts exactly 12 characters with the right mix, and no symbol is needed', async () => {
    const { status } = await t.request('POST', '/api/auth/signup', { body: { ...body, password: 'HarborLamps7' } });
    expect(status).toBe(201);
  });

  it('limits repeated signups from one caller', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const { status } = await t.request('POST', '/api/auth/signup', {
        headers: { 'cf-connecting-ip': '203.0.113.9' },
        body: { ...body, email: `person${i}@example.test`, companyName: `Co ${i}` },
      });
      statuses.push(status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});

describe('plumbing', () => {
  it('answers health checks and returns JSON 404s', async () => {
    expect((await t.request('GET', '/health')).json.status).toBe('ok');
    const missing = await t.request('GET', '/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.json).toEqual({ success: false, error: { message: 'Not found' } });
  });

  it('only allows the configured browser origins', async () => {
    const allowed = await t.app.request('/health', { headers: { Origin: 'http://localhost:3000' } });
    const blocked = await t.app.request('/health', { headers: { Origin: 'https://evil.example' } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull();
  });
});
