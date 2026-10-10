import { z } from 'zod';
import { ApiError } from '../http';
import type { PaymentTokenClaims } from '../lib/paymentToken';
import type { AppDeps } from '../types';
import { MOCK_PROVIDER } from './providerAccess';
import { applyStatusAtomic, formatAmount, loadPayment, refreshExpiry, type PaymentRow } from './payments';

export const decisionSchema = z.object({ decision: z.enum(['approve', 'reject']) });

/** The payment this Mock bank token is for. Only Mock bank payments are ever visible here. */
async function loadForBank(deps: AppDeps, claims: PaymentTokenClaims): Promise<PaymentRow> {
  const row = await loadPayment(deps.db, claims.organizationId, claims.paymentId);
  if (row.provider_code !== MOCK_PROVIDER) throw new ApiError('Payment not found', 404);
  const fresh = await refreshExpiry(deps, row);
  if (fresh.status === 'EXPIRED') throw new ApiError('This payment has expired', 410, 'PAYMENT_EXPIRED');
  return fresh;
}

/** Just what the bank page needs to show. */
export async function mockBankPayment(deps: AppDeps, claims: PaymentTokenClaims) {
  const row = await loadForBank(deps, claims);
  return {
    paymentId: row.payment_id,
    merchant: { name: row.organization_name },
    organizationName: row.organization_name,
    amount: { value: formatAmount(row.amount_text), currency: row.currency },
    currency: row.currency,
    reference: row.reference ?? undefined,
    status: row.status,
    expiresAt: row.expires_at,
  };
}

function returnUrl(redirectUrl: string | null, paymentId: string, status: string): string | null {
  if (!redirectUrl) return null;
  try {
    const url = new URL(redirectUrl);
    url.searchParams.set('paymentId', paymentId);
    url.searchParams.set('status', status);
    return url.toString();
  } catch {
    return null;
  }
}

export async function mockBankDecision(deps: AppDeps, claims: PaymentTokenClaims, decision: 'approve' | 'reject') {
  const row = await loadForBank(deps, claims);
  if (row.status !== 'AUTHORIZING' && row.status !== 'AUTHORIZED') {
    throw new ApiError(`Payment is already ${row.status}`, 409, 'PAYMENT_NOT_PENDING');
  }
  const approved = decision === 'approve';
  const { changed } = await applyStatusAtomic(deps.db, deps.now(), row.id, approved ? 'COMPLETED' : 'FAILED', {
    details: approved ? 'Approved on the Mock bank' : 'Rejected on the Mock bank',
    ...(approved ? {} : { error: { code: 'USER_REJECTED', message: 'The payment was rejected on the Mock bank' } }),
  });
  // Someone else decided in the meantime
  if (!changed) throw new ApiError('Payment is no longer awaiting a decision', 409, 'PAYMENT_NOT_PENDING');

  const status = approved ? 'COMPLETED' : 'FAILED';
  return { status, redirectUrl: returnUrl(row.redirect_url, row.payment_id, status) };
}
