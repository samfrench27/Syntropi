import { ApiError } from '../../http';
import type { AppDeps } from '../../types';
import type { AdapterPayment, CreateOptions, PaymentAdapter, PaymentStatus } from './types';

const TIMEOUT_MS = 8000;

/** Token.io status (the v2 payments and webhook vocabularies) to Syntropi's. Unknown values stay PENDING. */
export function mapTokenStatus(tokenStatus: string | undefined | null): PaymentStatus {
  switch ((tokenStatus ?? '').toUpperCase()) {
    case 'INITIATION_PENDING':
    case 'INITIATION_PENDING_REDIRECT_AUTH':
    case 'INITIATION_PENDING_REDIRECT_AUTH_VERIFICATION':
    case 'INITIATION_PENDING_REDIRECT_HP':
    case 'INITIATION_PENDING_EMBEDDED_AUTH':
    case 'INITIATION_PENDING_EMBEDDED_AUTH_VERIFICATION':
    case 'INITIATION_PENDING_DECOUPLED_AUTH':
    case 'PENDING_AUTHENTICATION':
      return 'AUTHORIZING';
    case 'INITIATION_PENDING_REDEMPTION':
    case 'INITIATION_PENDING_REDEMPTION_VERIFICATION':
    case 'PENDING_SUBMISSION':
      return 'AUTHORIZED';
    case 'INITIATION_PROCESSING':
    case 'SETTLEMENT_IN_PROGRESS':
    case 'SUBMITTED':
      return 'SUBMITTED';
    case 'INITIATION_COMPLETED':
    case 'ACCEPTED':
      return 'ACCEPTED';
    case 'SETTLEMENT_COMPLETED':
    case 'COMPLETED':
      return 'COMPLETED';
    case 'INITIATION_REJECTED':
    case 'INITIATION_REJECTED_INSUFFICIENT_FUNDS':
    case 'INITIATION_FAILED':
    case 'SETTLEMENT_INCOMPLETE':
    case 'FAILED':
      return 'FAILED';
    case 'INITIATION_DECLINED':
    case 'INITIATION_EXPIRED':
    case 'CANCELLED':
      return 'CANCELLED';
    case 'EXPIRED':
      return 'EXPIRED';
    default:
      return 'PENDING';
  }
}

function credentials(deps: AppDeps): { key: string; base: string } {
  const key = deps.env.TOKEN_API_KEY;
  const base = deps.env.TOKEN_API_BASE_URL;
  if (!key || !base) throw new ApiError('Provider is not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  return { key, base: base.replace(/\/+$/, '') };
}

/** One call to Token.io. The caller never sees what Token.io said, only that the request failed. */
async function call(deps: AppDeps, method: string, path: string, body?: unknown): Promise<any> {
  const { key, base } = credentials(deps);
  let res: Response;
  try {
    res = await deps.fetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Basic ${key}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error: any) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.warn(`Token.io ${method} ${path} failed: ${error?.message}`);
    throw new ApiError(timedOut ? 'Provider timed out' : 'Provider request failed', timedOut ? 504 : 502, 'PROVIDER_ERROR');
  }
  if (!res.ok) {
    console.warn(`Token.io ${method} ${path} returned ${res.status}`);
    throw new ApiError('Provider request failed', 502, 'PROVIDER_ERROR');
  }
  if (res.status === 204) return {};
  try {
    return await res.json();
  } catch {
    throw new ApiError('Provider returned an unreadable response', 502, 'PROVIDER_ERROR');
  }
}

function buildRequest(payment: AdapterPayment, opts: CreateOptions, callbackUrl: string) {
  const to = payment.toAccount;
  let localInstrument: 'FASTER_PAYMENTS' | 'SEPA';
  if (to.iban) localInstrument = 'SEPA';
  else if (to.sortCode && to.accountNumber) localInstrument = 'FASTER_PAYMENTS';
  else throw new ApiError('toAccount must have either IBAN or sortCode+accountNumber', 400);

  const creditor: Record<string, unknown> = { name: to.accountName };
  if (localInstrument === 'SEPA') {
    creditor.iban = to.iban;
    if (to.bic) creditor.bic = to.bic;
  } else {
    creditor.sortCode = to.sortCode;
    creditor.accountNumber = to.accountNumber;
  }

  const initiation: Record<string, unknown> = {
    refId: payment.paymentId.slice(0, 35),
    remittanceInformationPrimary: payment.reference || `Payment ${payment.paymentId}`,
    amount: { value: payment.amountValue, currency: payment.currency },
    localInstrument,
    creditor,
    callbackUrl,
    flowType: opts.flow,
  };

  const from = payment.fromAccount;
  if (from?.accountName) {
    const debtor: Record<string, unknown> = { name: from.accountName };
    if (from.iban) {
      debtor.iban = from.iban;
      if (from.bic) debtor.bic = from.bic;
    } else if (from.sortCode && from.accountNumber) {
      debtor.sortCode = from.sortCode;
      debtor.accountNumber = from.accountNumber;
    }
    initiation.debtor = debtor;
  }
  const bankId = opts.bankId ?? payment.bankId;
  if (bankId) initiation.bankId = bankId;

  return { initiation, pispConsentAccepted: true };
}

const safeUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
};

export const tokenAdapter: PaymentAdapter = {
  code: 'token',
  assertConfigured(deps) {
    credentials(deps);
  },

  async create(deps, payment, opts) {
    const callbackUrl =
      payment.redirectUrl || (deps.config.hostedPagesUrl ? `${deps.config.hostedPagesUrl.replace(/\/+$/, '')}/sessions/${payment.paymentId}` : undefined);
    if (!callbackUrl) throw new ApiError('redirectUrl is required for this provider', 400);

    const out = await call(deps, 'POST', '/v2/payments', buildRequest(payment, opts, callbackUrl));
    const p = out?.payment;
    if (!p?.id || typeof p.id !== 'string') throw new ApiError('Provider returned an unreadable response', 502, 'PROVIDER_ERROR');
    return {
      providerPaymentId: p.id,
      redirectUrl: safeUrl(p.authentication?.redirectUrl),
      status: mapTokenStatus(p.status),
      data: { providerStatus: p.status ?? null },
    };
  },

  async getStatus(deps, providerPaymentId) {
    const out = await call(deps, 'GET', `/v2/payments/${encodeURIComponent(providerPaymentId)}`);
    const p = out?.payment;
    if (!p) throw new ApiError('Provider returned an unreadable response', 502, 'PROVIDER_ERROR');
    return { status: mapTokenStatus(p.status), data: { providerStatus: p.status ?? null } };
  },

  async cancel(deps, providerPaymentId) {
    await call(deps, 'DELETE', `/v2/payments/${encodeURIComponent(providerPaymentId)}`);
  },
};
