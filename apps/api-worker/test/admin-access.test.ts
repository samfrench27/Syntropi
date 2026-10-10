import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/app';
import { seedPeople, type People } from './admin-fixtures';

let t: TestApp;
let p: People;
beforeEach(async () => {
  t = await createTestApp();
  p = await seedPeople(t);
});

const id = '00000000-0000-0000-0000-0000000000a1';
const admin: [string, string][] = [
  ['GET', '/api/admin/users'], ['GET', `/api/admin/users/${id}`], ['POST', '/api/admin/users'], ['PUT', `/api/admin/users/${id}`],
  ['DELETE', `/api/admin/users/${id}`], ['GET', `/api/admin/users/${id}/activities`],
  ['GET', '/api/admin/organizations'], ['GET', `/api/admin/organizations/${id}`], ['POST', '/api/admin/organizations'],
  ['PUT', `/api/admin/organizations/${id}`], ['DELETE', `/api/admin/organizations/${id}`], ['GET', `/api/admin/organizations/${id}/users`],
  ['GET', `/api/admin/organizations/${id}/api-keys`], ['GET', `/api/admin/organizations/${id}/activities`],
  ['GET', '/api/admin/api-keys'], ['POST', '/api/admin/api-keys'], ['GET', `/api/admin/api-keys/${id}`], ['DELETE', `/api/admin/api-keys/${id}`],
  ['GET', '/api/admin/activities'], ['GET', `/api/admin/activities/${id}`],
  ['GET', '/api/admin/providers'], ['GET', `/api/admin/providers/${id}`], ['POST', '/api/admin/providers'],
  ['PUT', `/api/admin/providers/${id}`], ['DELETE', `/api/admin/providers/${id}`],
];
const client: [string, string][] = [
  ['GET', '/api/client/api-keys'], ['GET', `/api/client/api-keys/${id}`], ['POST', '/api/client/api-keys'], ['DELETE', `/api/client/api-keys/${id}`],
  ['GET', '/api/client/organization'], ['PUT', '/api/client/organization'], ['GET', '/api/client/activities'],
];

describe('authentication', () => {
  it.each([...admin, ...client])('%s %s needs a token', async (method, path) => {
    expect((await t.request(method, path)).status).toBe(401);
    expect((await t.request(method, path, { token: 'not.a.token' })).status).toBe(401);
  });
});

describe('roles', () => {
  it.each(admin)('%s %s is closed to the user role', async (method, path) => {
    expect((await t.request(method, path, { user: p.plainA, body: method === 'GET' ? undefined : {} })).status).toBe(403);
  });

  it.each(['/api/admin/providers'])('writes to %s are closed to org admins', async (path) => {
    expect((await t.request('POST', path, { user: p.userA, body: {} })).status).toBe(403);
  });
});
