import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/app';
import { seedPeople, type People } from './admin-fixtures';

let t: TestApp;
let p: People;
beforeEach(async () => {
  t = await createTestApp();
  p = await seedPeople(t);
});

const send = (user: string | undefined, id: string) => t.request('POST', `/api/admin/users/${id}/send-password-reset`, { user });

describe('POST /api/admin/users/:id/send-password-reset', () => {
  it('emails the person a link to the dashboard reset page, and tells the admin nothing else', async () => {
    const { status, json } = await send(p.userA, p.plainA);
    expect(status).toBe(200);
    expect(json).toEqual({ success: true, message: 'Password reset email sent', data: { sent: true } });
    expect(t.fake.resets).toEqual([{ email: 'pat@acme.test', redirectTo: 'http://localhost:3000/reset-password' }]);
    // no link, token or password anywhere in the response
    expect(JSON.stringify(json)).not.toMatch(/token|link|password":/i);
  });

  it('records who sent it, in the sender organization, without any secret', async () => {
    await send(p.userA, p.plainA);
    const [row] = await t.rows(`select user_id, organization_id, action, details from activities where action = 'admin.user.password_reset_sent'`);
    expect(row).toMatchObject({ user_id: p.userA, organization_id: p.orgA, action: 'admin.user.password_reset_sent' });
    expect(row.details).toEqual({ userId: p.plainA, email: 'pat@acme.test' });
  });

  it('needs a signed-in admin: 401 with no token, 403 for a plain user', async () => {
    expect((await send(undefined, p.plainA)).status).toBe(401);
    expect((await send(p.plainA, p.plainA)).status).toBe(403);
    expect(t.fake.resets).toHaveLength(0);
  });

  it('keeps organizations apart in both directions: another organization is a 404, not a hint it exists', async () => {
    expect((await send(p.userA, p.plainB)).status).toBe(404);
    expect((await send(p.userB, p.plainA)).status).toBe(404);
    expect((await send(p.userA, p.userB)).status).toBe(404);
    expect(t.fake.resets).toHaveLength(0);
  });

  it('does not let an org admin reset another admin, but a superadmin may reset anyone', async () => {
    await t.admin((pg) => pg.query(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a4', 'sam@acme.test')`));
    await t.admin((pg) =>
      pg.query(`insert into profiles (id, email, first_name, last_name, role, organization_id) values ('00000000-0000-0000-0000-0000000000a4', 'sam@acme.test', 'Sam', 'Second', 'admin', $1)`, [p.orgA]),
    );
    const otherAdmin = '00000000-0000-0000-0000-0000000000a4';
    const refused = await send(p.userA, otherAdmin);
    expect(refused.status).toBe(403);
    expect(t.fake.resets).toHaveLength(0);
    expect((await send(p.superId, otherAdmin)).status).toBe(200);
    expect((await send(p.superId, p.plainB)).status).toBe(200);
  });

  it('is a 400 for a malformed id and a 404 for an unknown one', async () => {
    expect((await send(p.userA, 'not-an-id')).status).toBe(400);
    expect((await send(p.userA, p.missing)).status).toBe(404);
  });

  it('stops after three emails to the same person in an hour', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await send(p.userA, p.plainA)).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    expect(t.fake.resets).toHaveLength(3);
  });

  it('reports a failure to send, and says nothing about why', async () => {
    t.fake.failures.sendPasswordReset = new Error('smtp exploded: secret-host.internal');
    const { status, json } = await send(p.userA, p.plainA);
    expect(status).toBe(500);
    expect(JSON.stringify(json)).not.toContain('secret-host');
  });
});
