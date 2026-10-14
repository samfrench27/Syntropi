/** What GET /api/payments/:id/hosted and /status return (the Worker's `hostedView`). */
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

export interface PaymentSession {
  paymentId: string;
  status: PaymentStatus;
  amount: { value: string; currency: string };
  reference?: string;
  description?: string;
  toAccount: { accountName: string; accountNumber?: string; sortCode?: string };
  merchant?: { name: string; logo?: string; redirectUri?: string };
  createdAt: string;
  expiresAt?: string | null;
}

/** One bank from GET /api/banks (only the fields the page uses). */
export interface Bank {
  id: string;
  name: string;
  displayName?: string | null;
  logoUrl?: string;
}

/** POST /api/payments/initiate */
export interface InitiateResult {
  paymentId: string;
  status: PaymentStatus;
  redirectUrl: string | null;
}
