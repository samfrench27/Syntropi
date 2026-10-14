import { beforeEach, describe, expect, it } from 'vitest';
import { approvedProviderCodes, assertProviderAllowed } from '../src/services/providerAccess';
import { createTestApp, type TestApp } from './helpers/app';

let t: TestApp;
beforeEach(async () => {
  t = await createTestApp();
});

const grant = (org: string, provider: string, status: string) =>
  t.admin((pg) => pg.query(`insert into provider_access (organization_id, provider_code, status) values ($1, $2, $3)`, [org, provider, status]));

describe('provider access', () => {
  it('gives every organization the Mock bank and nothing else by default', async () => {
    expect(await approvedProviderCodes(t.db, t.ids.orgA)).toEqual(['mock']);
  });

  it('adds only approved providers, and only for the organization that was approved', async () => {
    await grant(t.ids.orgA, 'token', 'approved');
    expect(await approvedProviderCodes(t.db, t.ids.orgA)).toEqual(['mock', 'token']);
    expect(await approvedProviderCodes(t.db, t.ids.orgB)).toEqual(['mock']);
  });

  it('ignores pending, rejected and revoked requests', async () => {
    await grant(t.ids.orgA, 'token', 'pending');
    await grant(t.ids.orgA, 'yapily', 'rejected');
    await t.admin((pg) => pg.query(`insert into provider_access (organization_id, provider_code, status) values ($1, 'truelayer', 'revoked')`, [t.ids.orgA]));
    expect(await approvedProviderCodes(t.db, t.ids.orgA)).toEqual(['mock']);
  });

  it('stops counting an approved provider that has been switched off platform-wide', async () => {
    await grant(t.ids.orgA, 'token', 'approved');
    await t.admin((pg) => pg.query(`update providers set status = 'inactive' where code = 'token'`));
    expect(await approvedProviderCodes(t.db, t.ids.orgA)).toEqual(['mock']);
  });

  it('allows the Mock bank, and refuses an unapproved provider with a clear 403', async () => {
    await expect(assertProviderAllowed(t.db, t.ids.orgA, 'mock')).resolves.toBeUndefined();
    await expect(assertProviderAllowed(t.db, t.ids.orgA, 'token')).rejects.toMatchObject({ status: 403, code: 'PROVIDER_NOT_APPROVED' });
    await grant(t.ids.orgA, 'token', 'approved');
    await expect(assertProviderAllowed(t.db, t.ids.orgA, 'token')).resolves.toBeUndefined();
  });
});
