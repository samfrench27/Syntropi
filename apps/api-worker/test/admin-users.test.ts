import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, STRONG_PASSWORD, type TestApp } from './helpers/app';
import { addActivity, seedPeople, type People } from './admin-fixtures';

let t: TestApp;
let p: People;
beforeEach(async () => {
  t = await createTestApp();
  p = await seedPeople(t);
});

const newUser = (org: string, over: Record<string, unknown> = {}) => ({
  email: 'New.Hire@acme.test',
  password: STRONG_PASSWORD,
  firstName: 'New',
  lastName: 'Hire',
  role: 'user',
  organizationId: org,
  ...over,
});

describe('GET /api/admin/users', () => {
  it('lists only the caller organization for an org admin', async () => {
    const { status, json } = await t.request('GET', '/api/admin/users', { user: p.userA });
    expect(status).toBe(200);
    expect(json.data.users.map((u: any) => u.id).sort()).toEqual([p.userA, p.plainA].sort());
    expect(json.data.pagination).toEqual({ total: 2, page: 1, limit: 20, pages: 1 });
    expect(json.data.users[0]).toMatchObject({ _id: json.data.users[0].id, organization: { name: 'Acme Coffee' } });
  });

  it('lets a superadmin see every organization and filter by one', async () => {
    const all = await t.request('GET', '/api/admin/users', { user: p.superId });
    expect(all.json.data.pagination.total).toBe(5);
    const one = await t.request('GET', `/api/admin/users?organizationId=${p.orgB}`, { user: p.superId });
    expect(one.json.data.users.map((u: any) => u.id).sort()).toEqual([p.userB, p.plainB].sort());
  });

  it('refuses an org admin asking for another organization, in both directions', async () => {
    expect((await t.request('GET', `/api/admin/users?organizationId=${p.orgB}`, { user: p.userA })).status).toBe(403);
    expect((await t.request('GET', `/api/admin/users?organizationId=${p.orgA}`, { user: p.userB })).status).toBe(403);
  });

  it('filters by role, status and search, treating % and _ literally', async () => {
    expect((await t.request('GET', '/api/admin/users?role=user', { user: p.superId })).json.data.pagination.total).toBe(2);
    expect((await t.request('GET', '/api/admin/users?search=pat', { user: p.userA })).json.data.users).toHaveLength(1);
    expect((await t.request('GET', '/api/admin/users?search=%25', { user: p.userA })).json.data.users).toHaveLength(0);
    expect((await t.request('GET', '/api/admin/users?search=.*', { user: p.userA })).json.data.users).toHaveLength(0);
    expect((await t.request('GET', `/api/admin/users?search=${encodeURIComponent("'; drop table profiles;--")}`, { user: p.userA })).status).toBe(200);
    expect((await t.request('GET', '/api/admin/users?status=suspended', { user: p.userA })).json.data.users).toHaveLength(0);
  });

  it('paginates', async () => {
    const { json } = await t.request('GET', '/api/admin/users?page=2&limit=1', { user: p.userA });
    expect(json.data.users).toHaveLength(1);
    expect(json.data.pagination).toEqual({ total: 2, page: 2, limit: 1, pages: 2 });
  });

  it('rejects bad filters with 400', async () => {
    expect((await t.request('GET', '/api/admin/users?role=root', { user: p.userA })).status).toBe(400);
    expect((await t.request('GET', '/api/admin/users?organizationId=nope', { user: p.userA })).status).toBe(400);
  });
});

describe('GET /api/admin/users/:id', () => {
  it('returns a user in the same organization, with id and _id', async () => {
    const { status, json } = await t.request('GET', `/api/admin/users/${p.plainA}`, { user: p.userA });
    expect(status).toBe(200);
    expect(json.data.user).toMatchObject({ id: p.plainA, _id: p.plainA, email: 'pat@acme.test', organization: { id: p.orgA, plan: 'free' } });
  });
  it("does not reveal another organization's user (404), either way round", async () => {
    expect((await t.request('GET', `/api/admin/users/${p.plainB}`, { user: p.userA })).status).toBe(404);
    expect((await t.request('GET', `/api/admin/users/${p.plainA}`, { user: p.userB })).status).toBe(404);
  });
  it('lets a superadmin read any user', async () => {
    expect((await t.request('GET', `/api/admin/users/${p.plainB}`, { user: p.superId })).status).toBe(200);
  });
  it('404s an unknown id and 400s a malformed one', async () => {
    expect((await t.request('GET', `/api/admin/users/${p.missing}`, { user: p.userA })).status).toBe(404);
    expect((await t.request('GET', '/api/admin/users/not-a-uuid', { user: p.userA })).status).toBe(400);
  });
});

describe('POST /api/admin/users', () => {
  it('creates a user with a password, in step with Supabase', async () => {
    const { status, json } = await t.request('POST', '/api/admin/users', { user: p.userA, body: newUser(p.orgA) });
    expect(status).toBe(201);
    const id = json.data.user.id;
    expect(json.data.user).toMatchObject({ _id: id, email: 'new.hire@acme.test', role: 'user', organization: { id: p.orgA, name: 'Acme Coffee' } });
    expect(t.fake.calls).toContain('createUser:password');
    expect(t.fake.metadata.get(id)).toEqual({ role: 'user', organization_id: p.orgA });
    const [row] = await t.rows(`select organization_id, created_by, status from profiles where id = $1`, [id]);
    expect(row).toMatchObject({ organization_id: p.orgA, created_by: p.userA, status: 'active' });
    const [log] = await t.rows(`select organization_id, details from activities where action = 'admin.user.create'`);
    expect(log.organization_id).toBe(p.orgA);
    expect(log.details).toMatchObject({ userId: id, organizationId: p.orgA });
  });

  it('sends an invite when no password is given', async () => {
    const { status } = await t.request('POST', '/api/admin/users', { user: p.userA, body: newUser(p.orgA, { password: undefined }) });
    expect(status).toBe(201);
    expect(t.fake.calls).toContain('createUser:invite');
  });

  it('will not add people to another organization', async () => {
    const { status } = await t.request('POST', '/api/admin/users', { user: p.userA, body: newUser(p.orgB) });
    expect(status).toBe(403);
    expect(t.fake.calls).toEqual([]);
    expect((await t.request('POST', '/api/admin/users', { user: p.userB, body: newUser(p.orgA) })).status).toBe(403);
  });

  it('lets only a superadmin create admins, and anywhere', async () => {
    expect((await t.request('POST', '/api/admin/users', { user: p.userA, body: newUser(p.orgA, { role: 'admin' }) })).status).toBe(403);
    const ok = await t.request('POST', '/api/admin/users', { user: p.superId, body: newUser(p.orgB, { role: 'admin' }) });
    expect(ok.status).toBe(201);
    expect(t.fake.metadata.get(ok.json.data.user.id)).toEqual({ role: 'admin', organization_id: p.orgB });
  });

  it('rejects a duplicate email, unknown organization and bad bodies', async () => {
    expect((await t.request('POST', '/api/admin/users', { user: p.userA, body: newUser(p.orgA, { email: 'PAT@acme.test' }) })).status).toBe(400);
    expect((await t.request('POST', '/api/admin/users', { user: p.superId, body: newUser(p.missing) })).status).toBe(404);
    for (const bad of [{ email: 'nope' }, { password: 'short' }, { role: 'superadmin' }, { firstName: '' }, { organizationId: 'x' }]) {
      expect((await t.request('POST', '/api/admin/users', { user: p.userA, body: newUser(p.orgA, bad) })).status).toBe(400);
    }
  });

  it('holds an admin-set password to the same rules as signup, and still allows no password (an invite)', async () => {
    for (const password of ['short', 'Password1234', 'alllowercase-longer-77', 'NewHire-Lamps-77']) {
      const { status, json } = await t.request('POST', '/api/admin/users', { user: p.userA, body: newUser(p.orgA, { password }) });
      expect(status, password).toBe(400);
      expect(json.error.code, password).toBe('WEAK_PASSWORD');
    }
    expect(t.fake.calls).not.toContain('createUser:password');
    expect(await t.rows(`select 1 from profiles where email = 'new.hire@acme.test'`)).toHaveLength(0);

    const invite = await t.request('POST', '/api/admin/users', { user: p.userA, body: newUser(p.orgA, { password: undefined }) });
    expect(invite.status).toBe(201);
    expect(t.fake.calls).toContain('createUser:invite');
  });

  it('creates nothing when Supabase fails', async () => {
    t.fake.failures.createUser = new Error('down');
    expect((await t.request('POST', '/api/admin/users', { user: p.userA, body: newUser(p.orgA) })).status).toBe(500);
    expect(await t.rows(`select 1 from profiles where email = 'new.hire@acme.test'`)).toHaveLength(0);
  });

  it('removes the Supabase identity when the profile cannot be written', async () => {
    await t.admin((pg) =>
      pg.exec(`create function boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
               create trigger boom before insert on profiles for each row when (new.email = 'new.hire@acme.test') execute function boom();`),
    );
    expect((await t.request('POST', '/api/admin/users', { user: p.userA, body: newUser(p.orgA) })).status).toBe(500);
    expect(t.fake.calls).toEqual(['createUser:password', 'deleteUser']);
    expect(await t.rows(`select 1 from auth.users where email = 'new.hire@acme.test'`)).toHaveLength(0);
  });
});

describe('PUT /api/admin/users/:id', () => {
  const put = (user: string, id: string, body: unknown) => t.request('PUT', `/api/admin/users/${id}`, { user, body });

  it('updates names in the same organization', async () => {
    const { status, json } = await put(p.userA, p.plainA, { firstName: 'Patricia' });
    expect(status).toBe(200);
    expect(json.data.user).toMatchObject({ firstName: 'Patricia', lastName: 'Picker' });
    expect(await t.rows(`select 1 from activities where action = 'admin.user.update'`)).toHaveLength(1);
  });

  it('syncs role and status to Supabase', async () => {
    const r = await put(p.superId, p.plainA, { role: 'admin', status: 'suspended' });
    expect(r.status).toBe(200);
    expect(t.fake.calls).toEqual(['setAppMetadata', 'setActive:false']);
    expect(t.fake.metadata.get(p.plainA)).toMatchObject({ role: 'admin' });
    expect(t.fake.banned.has(p.plainA)).toBe(true);
    await put(p.superId, p.plainA, { status: 'active' });
    expect(t.fake.banned.has(p.plainA)).toBe(false);
  });

  it('rolls the profile back when Supabase fails', async () => {
    t.fake.failures.setActive = new Error('down');
    expect((await put(p.superId, p.plainA, { role: 'admin', status: 'suspended' })).status).toBe(500);
    const [row] = await t.rows(`select role, status from profiles where id = $1`, [p.plainA]);
    expect(row).toEqual({ role: 'user', status: 'active' });
    expect(t.fake.metadata.get(p.plainA)).toMatchObject({ role: 'user' });
  });

  it('keeps org admins within their limits', async () => {
    expect((await put(p.userA, p.plainA, { role: 'admin' })).status).toBe(403);
    expect((await put(p.userA, p.userA, { firstName: 'X' })).status).toBe(403);
    expect((await put(p.userA, p.superId, { firstName: 'X' })).status).toBe(404);
  });

  it("will not touch another organization's user, either way round", async () => {
    expect((await put(p.userA, p.plainB, { firstName: 'Hacked' })).status).toBe(404);
    expect((await put(p.userB, p.plainA, { firstName: 'Hacked' })).status).toBe(404);
    expect((await t.rows(`select first_name from profiles where id = $1`, [p.plainB]))[0].first_name).toBe('Quinn');
  });

  it('does not let anyone change a superadmin role or status', async () => {
    expect((await put(p.superId, p.superId, { role: 'user' })).status).toBe(403);
    expect((await put(p.superId, p.superId, { firstName: 'Root2' })).status).toBe(200);
  });

  it('validates the body and the id', async () => {
    expect((await put(p.userA, p.plainA, { role: 'superadmin' })).status).toBe(400);
    expect((await put(p.userA, p.plainA, { status: 'deleted' })).status).toBe(400);
    expect((await put(p.userA, 'bad', {})).status).toBe(400);
    expect((await put(p.superId, p.missing, {})).status).toBe(404);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  const del = (user: string, id: string) => t.request('DELETE', `/api/admin/users/${id}`, { user });

  it('deletes a user and their Supabase identity', async () => {
    const r = await del(p.userA, p.plainA);
    expect(r.status).toBe(200);
    expect(t.fake.calls).toContain('deleteUser');
    expect(await t.rows(`select 1 from profiles where id = $1`, [p.plainA])).toHaveLength(0);
    expect(await t.rows(`select 1 from activities where action = 'admin.user.delete'`)).toHaveLength(1);
  });

  it('hands the keys of a deleted user to the admin who deleted them', async () => {
    await t.admin((pg) =>
      pg.query(`insert into api_keys (organization_id, name, key_hash, key_prefix, created_by) values ($1, 'Pat key', 'h-pat', 'sk_pat', $2)`, [p.orgA, p.plainA]),
    );
    expect((await del(p.userA, p.plainA)).status).toBe(200);
    expect((await t.rows(`select created_by from api_keys where key_hash = 'h-pat'`))[0].created_by).toBe(p.userA);
  });

  it("will not delete another organization's user, either way round", async () => {
    expect((await del(p.userA, p.plainB)).status).toBe(404);
    expect((await del(p.userB, p.plainA)).status).toBe(404);
    expect(await t.rows(`select 1 from profiles where id in ($1, $2)`, [p.plainA, p.plainB])).toHaveLength(2);
  });

  it('protects admins, superadmins and organization owners', async () => {
    expect((await del(p.userA, p.userA)).status).toBe(403);
    expect((await del(p.superId, p.superId)).status).toBe(403);
    await t.admin((pg) => pg.query(`update organizations set owner_id = $1 where id = $2`, [p.plainA, p.orgA]));
    expect((await del(p.superId, p.plainA)).status).toBe(400);
  });

  it('lets a superadmin delete an admin in any organization', async () => {
    expect((await del(p.superId, p.userB)).status).toBe(200);
  });

  it('keeps the profile when Supabase refuses', async () => {
    t.fake.failures.deleteUser = new Error('down');
    expect((await del(p.userA, p.plainA)).status).toBe(500);
    expect(await t.rows(`select 1 from profiles where id = $1`, [p.plainA])).toHaveLength(1);
  });

  it('400s a malformed id and 404s an unknown one', async () => {
    expect((await del(p.userA, 'bad')).status).toBe(400);
    expect((await del(p.userA, p.missing)).status).toBe(404);
  });
});

describe('GET /api/admin/users/:id/activities', () => {
  it("returns the user's activity, paginated", async () => {
    await addActivity(t, { orgId: p.orgA, userId: p.plainA, action: 'client.apiKey.create' });
    await addActivity(t, { orgId: p.orgA, userId: p.plainA, action: 'client.apiKey.revoke' });
    await addActivity(t, { orgId: p.orgA, userId: p.userA, action: 'other' });
    const { status, json } = await t.request('GET', `/api/admin/users/${p.plainA}/activities?limit=1`, { user: p.userA });
    expect(status).toBe(200);
    expect(json.data.activities).toHaveLength(1);
    expect(json.data.activities[0]).toMatchObject({ user: { id: p.plainA }, _id: expect.any(String) });
    expect(json.data.pagination).toEqual({ total: 2, page: 1, limit: 1, pages: 2 });
  });
  it('is closed to other organizations and validates the id', async () => {
    expect((await t.request('GET', `/api/admin/users/${p.plainB}/activities`, { user: p.userA })).status).toBe(404);
    expect((await t.request('GET', `/api/admin/users/${p.plainA}/activities`, { user: p.userB })).status).toBe(404);
    expect((await t.request('GET', '/api/admin/users/bad/activities', { user: p.userA })).status).toBe(400);
    expect((await t.request('GET', `/api/admin/users/${p.missing}/activities`, { user: p.superId })).status).toBe(404);
  });
});
