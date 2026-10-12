import type { AppDeps } from '../../types';
import type { IsoState } from '../../services/isoStatus';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZING'
  | 'AUTHORIZED'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export const TERMINAL_STATUSES: PaymentStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'];

/** The columns of `payments` an adapter needs. Amounts are exact decimal strings. */
export interface AdapterPayment {
  id: string;
  paymentId: string;
  organizationId: string;
  clientId: string;
  toAccount: Record<string, any>;
  fromAccount: Record<string, any> | null;
  amountValue: string;
  currency: string;
  reference: string | null;
  redirectUrl: string | null;
  flowType: 'API_ONLY' | 'HOSTED_PAGES' | 'EMBEDDED_HOSTED_PAGES';
  bankId: string | null;
}

export interface CreateOptions {
  bankId?: string | null;
  /** The flow the customer will follow at the provider. */
  flow: 'API_ONLY' | 'FULL_HOSTED_PAGES' | 'EMBEDDED_HOSTED_PAGES';
}

export interface CreateResult {
  providerPaymentId?: string;
  redirectUrl?: string;
  /** What the provider reported, as an ISO 20022 status. `status` is the Syntropi status derived from it. */
  iso: IsoState;
  status: PaymentStatus;
  /** Kept in payments.provider_data. Never returned to callers. */
  data: Record<string, unknown>;
}

export interface StatusResult {
  iso: IsoState;
  status: PaymentStatus;
  data: Record<string, unknown>;
}

export interface PaymentAdapter {
  code: string;
  /** Throws 503 when this provider cannot be used because credentials or URLs are missing. */
  assertConfigured(deps: AppDeps): void;
  create(deps: AppDeps, payment: AdapterPayment, opts: CreateOptions): Promise<CreateResult>;
  getStatus?(deps: AppDeps, providerPaymentId: string): Promise<StatusResult>;
  cancel?(deps: AppDeps, providerPaymentId: string): Promise<void>;
}
