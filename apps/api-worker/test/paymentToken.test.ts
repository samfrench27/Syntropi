import { describe, expect, it } from 'vitest';
import { signPaymentToken, verifyPaymentToken } from '../src/lib/paymentToken';

const SECRET = 'a-test-secret-that-is-long-enough-0123456789';
const claims = { paymentId: 'pay_1', organizationId: 'org_1', clientId: 'c1', purpose: 'hosted-pages-access' as const };

describe('payment tokens', () => {
  it('round-trip for the purpose they were issued for', async () => {
    const token = await signPaymentToken(SECRET, claims);
    expect(await verifyPaymentToken(SECRET, token, 'hosted-pages-access')).toEqual(claims);
  });

  it('are refused for a different purpose, so a hosted-pages token cannot drive the mock bank', async () => {
    const token = await signPaymentToken(SECRET, claims);
    await expect(verifyPaymentToken(SECRET, token, 'mock-bank-access')).rejects.toThrow();
  });

  it('are refused when expired, tampered with, or signed with another secret', async () => {
    await expect(verifyPaymentToken(SECRET, await signPaymentToken(SECRET, claims, '-1m'), 'hosted-pages-access')).rejects.toThrow();
    const good = await signPaymentToken(SECRET, claims);
    await expect(verifyPaymentToken(SECRET, good.slice(0, -2) + 'xx', 'hosted-pages-access')).rejects.toThrow();
    await expect(verifyPaymentToken('another-secret-that-is-also-long-enough-99', good, 'hosted-pages-access')).rejects.toThrow();
  });

  it('refuse to be signed with a short secret', async () => {
    await expect(signPaymentToken('short', claims)).rejects.toThrow(/32 characters/);
  });
});
