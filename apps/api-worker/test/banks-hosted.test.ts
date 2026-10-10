import { beforeEach, describe, expect, it } from 'vitest';
import { signPaymentToken } from '../src/lib/paymentToken';
import { createTestApp, type TestApp } from './helpers/app';

const SECRET = 'test-hosted-pages-secret-0123456789';
let t: TestApp;

/** A real bank reachable through Token.io, and the org approved for it. */
async function approveTokenForOrgA() {
  await t.admin(async (pg) => {
    await pg.query(`insert into provider_access (organization_id, provider_code, status) values ($1, 'token', 'approved')`, [t.ids.orgA]);
    const { rows } = await pg.query<{ id: string }>(`insert into banks (syntropi_id, name, country, active) values ('gb-realbank', 'Real Bank', 'GB', true) returning id`);
    await pg.query(`insert into bank_provider_mappings (bank_id, provider_code, provider_id, active) values ($1, 'token', 'ob-real', true)`, [rows[0].id]);
  });
}

const hostedToken = (paymentId: string, organizationId: string) =>
  signPaymentToken(SECRET, { paymentId, organizationId, clientId: 'c', purpose: 'hosted-pages-access' });

const bankIds = (json: any) => (json.data.banks as { id: string }[]).map((b) => b.id);

beforeEach(async () => {
  t = await createTestApp();
});

describe('banks for a hosted payment page', () => {
  it("shows only the Mock banks for a mock payment, even when the organization is approved for a real provider", async () => {
    await approveTokenForOrgA();
    const token = await hostedToken('pay_a1', t.ids.orgA); // pay_a1 is a mock payment
    const { status, json } = await t.request('GET', '/api/banks?country=GB', { token });
    expect(status).toBe(200);
    expect(bankIds(json)).not.toContain('gb-realbank');
    expect(bankIds(json).length).toBeGreaterThan(0);
  });

  it("shows only the payment's own provider's banks for a real-provider payment", async () => {
    await approveTokenForOrgA();
    await t.admin((pg) =>
      pg.query(`insert into payments (payment_id, organization_id, client_id, to_account, amount_value, provider_code) values ('pay_real', $1, 'c', '{"accountName":"Acme"}', 5, 'token')`, [t.ids.orgA]),
    );
    const token = await hostedToken('pay_real', t.ids.orgA);
    const { json } = await t.request('GET', '/api/banks?country=GB', { token });
    expect(bankIds(json)).toEqual(['gb-realbank']);
  });

  it('returns nothing for a real-provider payment once the approval has been revoked', async () => {
    await approveTokenForOrgA();
    await t.admin(async (pg) => {
      await pg.query(`insert into payments (payment_id, organization_id, client_id, to_account, amount_value, provider_code) values ('pay_real', $1, 'c', '{"accountName":"Acme"}', 5, 'token')`, [t.ids.orgA]);
      await pg.query(`update provider_access set status = 'revoked' where organization_id = $1`, [t.ids.orgA]);
    });
    const token = await hostedToken('pay_real', t.ids.orgA);
    const { json } = await t.request('GET', '/api/banks?country=GB', { token });
    expect(bankIds(json)).toEqual([]);
  });

  it('refuses a token for a payment that does not exist in that organization', async () => {
    const wrongOrg = await hostedToken('pay_a1', t.ids.orgB); // pay_a1 belongs to org A
    expect((await t.request('GET', '/api/banks', { token: wrongOrg })).status).toBe(404);
    const unknown = await hostedToken('pay_missing', t.ids.orgA);
    expect((await t.request('GET', '/api/banks', { token: unknown })).status).toBe(404);
  });

  it('applies the same scope when a single bank or the provider list is requested', async () => {
    await approveTokenForOrgA();
    const token = await hostedToken('pay_a1', t.ids.orgA);
    expect((await t.request('GET', '/api/banks/gb-realbank', { token })).status).toBe(404);
    const providers = await t.request('GET', '/api/banks/providers', { token });
    expect(providers.json.data.providers).toEqual(['mock']);
  });
});
