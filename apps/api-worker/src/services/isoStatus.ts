import { z } from 'zod';
import type { PaymentStatus } from '../adapters/payments/types';

/**
 * ISO 20022 payment status (ExternalPaymentTransactionStatus1Code, as used in pain.002 and pacs.002)
 * and the Syntropi status each one stands for. This file is the one source of truth for that mapping.
 */
export const ISO_STATUSES = ['RCVD', 'PDNG', 'ACTC', 'ACCP', 'ACSP', 'ACSC', 'RJCT', 'CANC'] as const;
export type IsoStatus = (typeof ISO_STATUSES)[number];

/** ISO ExternalStatusReason1Code values Syntropi uses. */
export const ISO_REASONS = ['AM04', 'AC04', 'CUST', 'NOAS', 'NARR'] as const;
export type IsoReason = (typeof ISO_REASONS)[number];

export interface IsoState {
  status: IsoStatus;
  /** Present on RJCT and CANC. */
  reason?: IsoReason;
}

export const ISO_INFO: Record<IsoStatus, { name: string; description: string }> = {
  RCVD: { name: 'Received', description: 'The payment has been received and nothing has happened to it yet.' },
  PDNG: { name: 'Pending', description: 'The payment is waiting, for example for the customer to approve it at their bank.' },
  ACTC: { name: 'AcceptedTechnicalValidation', description: 'The payment passed technical validation and is authorised.' },
  ACCP: { name: 'AcceptedCustomerProfile', description: 'The bank accepted the payment for execution after its checks.' },
  ACSP: { name: 'AcceptedSettlementInProcess', description: 'The payment is accepted and settlement is in progress.' },
  ACSC: { name: 'AcceptedSettlementCompleted', description: 'Settlement is complete.' },
  RJCT: { name: 'Rejected', description: 'The payment was rejected, did not complete, or timed out.' },
  CANC: { name: 'Cancelled', description: 'The payment was cancelled before it completed.' },
};

export const ISO_REASON_INFO: Record<IsoReason, string> = {
  AM04: 'InsufficientFunds',
  AC04: 'ClosedAccountNumber',
  CUST: 'RequestedByCustomer',
  NOAS: 'NoAnswerFromCustomer',
  NARR: 'Narrative',
};

/** The Syntropi status for an ISO status. A rejection with reason NOAS (the customer never answered) is EXPIRED. */
export function isoToSyntropi(iso: IsoState): PaymentStatus {
  switch (iso.status) {
    case 'RCVD':
      return 'PENDING';
    case 'PDNG':
      return 'AUTHORIZING';
    case 'ACTC':
      return 'AUTHORIZED';
    case 'ACCP':
      return 'SUBMITTED';
    case 'ACSP':
      return 'ACCEPTED';
    case 'ACSC':
      return 'COMPLETED';
    case 'CANC':
      return 'CANCELLED';
    case 'RJCT':
      return iso.reason === 'NOAS' ? 'EXPIRED' : 'FAILED';
  }
}

/** The ISO status a Syntropi status stands for, for callers that only know the Syntropi status. Matches iso_for_status() in the database. */
export function defaultIsoFor(status: PaymentStatus): IsoState {
  switch (status) {
    case 'PENDING':
      return { status: 'RCVD' };
    case 'AUTHORIZING':
      return { status: 'PDNG' };
    case 'AUTHORIZED':
      return { status: 'ACTC' };
    case 'SUBMITTED':
      return { status: 'ACCP' };
    case 'ACCEPTED':
      return { status: 'ACSP' };
    case 'COMPLETED':
      return { status: 'ACSC' };
    case 'CANCELLED':
      return { status: 'CANC', reason: 'CUST' };
    case 'EXPIRED':
      return { status: 'RJCT', reason: 'NOAS' };
    case 'FAILED':
      return { status: 'RJCT', reason: 'NARR' };
  }
}

/**
 * A code a provider sent, folded into the codes Syntropi uses. Variants of "accepted" fold into the
 * nearest stage; anything unknown is null so the caller can decide (never guessed as final).
 */
export function parseIsoCode(code: string | null | undefined): IsoStatus | null {
  switch ((code ?? '').toUpperCase()) {
    case 'RCVD':
      return 'RCVD';
    case 'PDNG':
      return 'PDNG';
    case 'ACTC':
      return 'ACTC';
    case 'ACCP':
    case 'ACFC':
      return 'ACCP';
    case 'ACSP':
    case 'ACWC':
    case 'ACWP':
      return 'ACSP';
    case 'ACSC':
    case 'ACIS':
      return 'ACSC';
    case 'RJCT':
      return 'RJCT';
    case 'CANC':
      return 'CANC';
    default:
      return null;
  }
}

/** How a payment's ISO status appears in API responses. */
export function isoView(status: IsoStatus, reason?: string | null) {
  const info = ISO_INFO[status];
  const known = reason && (ISO_REASONS as readonly string[]).includes(reason) ? (reason as IsoReason) : null;
  return {
    code: status,
    name: info.name,
    description: info.description,
    ...(known ? { reason: { code: known, name: ISO_REASON_INFO[known] } } : {}),
  };
}

// ---------------------------------------------------------------------------
// Mock bank scenarios: how an approved Mock bank payment moves through the ISO statuses over time
// ---------------------------------------------------------------------------

export const MOCK_PRESETS = ['instant', 'realistic', 'slow'] as const;
export const MOCK_REJECT_REASONS = ['CUST', 'AM04', 'AC04', 'NARR'] as const;

export const mockScenarioSchema = z.object({
  preset: z.enum(MOCK_PRESETS).optional(),
  /** Seconds until ACSC. Overrides the preset's timing. */
  completeAfterSeconds: z.number().int().min(1).max(3600).optional(),
  /** Used when the payment is rejected. */
  rejectReason: z.enum(MOCK_REJECT_REASONS).optional(),
});
export type MockScenario = z.infer<typeof mockScenarioSchema>;

export interface ScheduledStep {
  /** ISO 8601 time the step is due. */
  at: string;
  iso: IsoStatus;
  reason?: IsoReason;
}

/** Seconds after approval for each step, per preset. ACTC always happens at once. */
const PRESET_SECONDS: Record<'realistic' | 'slow', { ACCP: number; ACSP: number; ACSC: number }> = {
  realistic: { ACCP: 5, ACSP: 15, ACSC: 60 },
  slow: { ACCP: 30, ACSP: 120, ACSC: 600 },
};

/** The steps for an approved payment: ACTC, ACCP, ACSP, ACSC at their times. "Instant" is a single ACSC now. */
export function buildApprovalTimeline(now: Date, scenario: MockScenario | null | undefined): ScheduledStep[] {
  const at = (s: number) => new Date(now.getTime() + s * 1000).toISOString();

  let times: { ACCP?: number; ACSP?: number; ACSC: number } | null = null;
  if (scenario?.completeAfterSeconds !== undefined) {
    const n = scenario.completeAfterSeconds;
    // ACCP at 10% and ACSP at 40% of the way, kept only when they fall strictly between the step before and n
    const accp = Math.max(1, Math.round(n * 0.1));
    const acsp = Math.max(1, Math.round(n * 0.4));
    times = { ACSC: n };
    let prev = 0;
    if (accp > prev && accp < n) {
      times.ACCP = accp;
      prev = accp;
    }
    if (acsp > prev && acsp < n) times.ACSP = acsp;
  } else if (scenario?.preset === 'realistic' || scenario?.preset === 'slow') {
    times = PRESET_SECONDS[scenario.preset];
  }

  if (!times) return [{ at: at(0), iso: 'ACSC' }];

  const steps: ScheduledStep[] = [{ at: at(0), iso: 'ACTC' }];
  if (times.ACCP !== undefined) steps.push({ at: at(times.ACCP), iso: 'ACCP' });
  if (times.ACSP !== undefined) steps.push({ at: at(times.ACSP), iso: 'ACSP' });
  steps.push({ at: at(times.ACSC), iso: 'ACSC' });
  return steps;
}
