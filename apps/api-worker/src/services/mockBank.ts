import { z } from 'zod';
import { ApiError } from '../http';
import type { PaymentTokenClaims } from '../lib/paymentToken';
import type { AppDeps } from '../types';
import { MOCK_PROVIDER } from './providerAccess';
import { applyIso, formatAmount, loadPayment, refreshExpiry, type PaymentRow } from './payments';
import { buildApprovalTimeline, isoView, mockScenarioSchema, type MockScenario } from './isoStatus';

export const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  /** How the payment moves after the decision. Falls back to the scenario set when the payment was created, then to instant. */
  scenario: mockScenarioSchema.optional(),
});

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
    isoStatus: isoView(row.iso_status, row.iso_reason_code),
    /** The scenario the merchant chose when creating the payment, if any. */
    scenario: scenarioOf(row),
    expiresAt: row.expires_at,
  };
}

function scenarioOf(row: PaymentRow): MockScenario | null {
  try {
    const raw = typeof row.mock_scenario === 'string' ? JSON.parse(row.mock_scenario) : row.mock_scenario;
    const parsed = mockScenarioSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
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

export async function mockBankDecision(
  deps: AppDeps,
  claims: PaymentTokenClaims,
  input: { decision: 'approve' | 'reject'; scenario?: MockScenario },
) {
  const row = await loadForBank(deps, claims);
  const waiting = row.status === 'AUTHORIZING' || (row.status === 'AUTHORIZED' && !hasScheduledSteps(row));
  if (!waiting) throw new ApiError(`Payment is already ${row.status}`, 409, 'PAYMENT_NOT_PENDING');
  const scenario = input.scenario ?? scenarioOf(row) ?? undefined;
  const now = deps.now();

  const status = await deps.db.tx(async (tx) => {
    let applied: boolean;
    if (input.decision === 'approve') {
      // The first step happens now; the rest are applied as they fall due (see applyDueTransitions)
      const [first, ...rest] = buildApprovalTimeline(now, scenario);
      ({ changed: applied } = await applyIso(tx, now, row.id, { status: first.iso, reason: first.reason }, { details: 'Approved on the Mock bank' }));
      if (applied && rest.length > 0) {
        await tx.query(`update payments set scheduled_transitions = $2::jsonb where id = $1`, [row.id, JSON.stringify(rest)]);
      }
    } else {
      ({ changed: applied } = await applyIso(
        tx,
        now,
        row.id,
        { status: 'RJCT', reason: scenario?.rejectReason ?? 'CUST' },
        { details: 'Rejected on the Mock bank', error: { code: 'USER_REJECTED', message: 'The payment was rejected on the Mock bank' } },
      ));
    }
    // Someone else decided in the meantime
    if (!applied) return null;
    const [current] = await tx.query<{ status: PaymentRow['status'] }>(`select status from payments where id = $1`, [row.id]);
    return current.status;
  });
  if (!status) throw new ApiError('Payment is no longer awaiting a decision', 409, 'PAYMENT_NOT_PENDING');

  // The customer goes back to the merchant now, with the status at this moment (later steps come in as they fall due)
  return { status, redirectUrl: returnUrl(row.redirect_url, row.payment_id, status) };
}

function hasScheduledSteps(row: PaymentRow): boolean {
  try {
    const v = typeof row.scheduled_transitions === 'string' ? JSON.parse(row.scheduled_transitions) : row.scheduled_transitions;
    return Array.isArray(v) && v.length > 0;
  } catch {
    return false;
  }
}
