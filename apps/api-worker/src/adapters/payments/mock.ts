import { ApiError } from '../../http';
import { signPaymentToken } from '../../lib/paymentToken';
import type { AppDeps } from '../../types';
import type { AdapterPayment, PaymentAdapter } from './types';

export const MOCK_BANK_TOKEN_TTL = '30m';

/** The Mock bank page for one payment, with the token that lets the customer's browser act on it. */
export async function mockBankUrl(deps: AppDeps, payment: Pick<AdapterPayment, 'paymentId' | 'organizationId' | 'clientId'>): Promise<string> {
  const base = deps.config.mockBankUrl;
  if (!base) throw new ApiError('Mock bank is not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  const token = await signPaymentToken(
    deps.config.hostedPagesJwtSecret,
    { paymentId: payment.paymentId, organizationId: payment.organizationId, clientId: payment.clientId, purpose: 'mock-bank-access' },
    MOCK_BANK_TOKEN_TTL,
  );
  return `${base.replace(/\/+$/, '')}/pay/${encodeURIComponent(payment.paymentId)}?token=${encodeURIComponent(token)}`;
}

/** The practice bank: needs no credentials and moves no money. The customer decides on the Mock bank page. */
export const mockAdapter: PaymentAdapter = {
  code: 'mock',
  assertConfigured(deps) {
    if (!deps.config.mockBankUrl) throw new ApiError('Mock bank is not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  },
  async create(deps, payment) {
    return { redirectUrl: await mockBankUrl(deps, payment), status: 'AUTHORIZING', data: { simulated: true } };
  },
};
