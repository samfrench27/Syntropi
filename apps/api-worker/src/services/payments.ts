import { z } from 'zod';
import type { Db } from '../db';
import { ApiError } from '../http';
import { randomId } from '../lib/crypto';
import { signPaymentToken } from '../lib/paymentToken';
import { getPaymentAdapter, TERMINAL_STATUSES, type AdapterPayment, type PaymentStatus } from '../adapters/payments';
import { mockBankUrl } from '../adapters/payments/mock';
import type { AppDeps } from '../types';
import { MOCK_PROVIDER, assertProviderAllowed } from './providerAccess';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export const PAYMENT_STATUSES = ['PENDING', 'AUTHORIZING', 'AUTHORIZED', 'SUBMITTED', 'ACCEPTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'] as const;
export const FLOW_TYPES = ['API_ONLY', 'HOSTED_PAGES', 'EMBEDDED_HOSTED_PAGES'] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional();

const accountSchema = z.object({
  accountName: z.string().trim().min(1, 'accountName is required').max(140),
  accountNumber: optionalText(34),
  sortCode: optionalText(8),
  iban: optionalText(34),
  bic: optionalText(11),
  bankName: optionalText(140),
});

/** An exact decimal. Up to the 4 decimal places the database keeps, so nothing is rounded silently. */
const amountValue = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,16}(\.\d{1,4})?$/.test(v) && /[1-9]/.test(v), 'must be a positive decimal with at most 4 decimal places');

const httpUrl = z
  .string()
  .max(2000)
  .refine((v) => {
    try {
      const p = new URL(v).protocol;
      return p === 'https:' || p === 'http:';
    } catch {
      return false;
    }
  }, 'must be an http(s) URL');

export const createPaymentSchema = z.object({
  fromAccount: accountSchema.optional(),
  toAccount: accountSchema.refine((a) => !!a.iban || (!!a.sortCode && !!a.accountNumber), {
    message: 'toAccount must have either IBAN or sortCode+accountNumber',
  }),
  amount: z.object({ value: amountValue, currency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/).transform((c) => c.toUpperCase()) }),
  reference: z
    .union([
      z.string().trim().max(140).transform((reference) => ({ reference, endToEndId: undefined as string | undefined })),
      z.object({ reference: optionalText(140), endToEndId: optionalText(35) }),
    ])
    .optional(),
  flowType: z.enum(FLOW_TYPES).optional(),
  redirectUrl: httpUrl.optional(),
  provider: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{1,50}$/)
    .optional(),
  bankId: z.string().trim().min(1).max(100).optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const initiateSchema = z.object({
  paymentId: z.string().min(1).max(100),
  bankId: z.string().trim().min(1).max(100),
  flowType: z.enum(['API_ONLY', 'HOSTED']).optional(),
  // Accepted for compatibility but never used: where the customer returns to is fixed when the payment is created
  redirectUri: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Rows and shapes
// ---------------------------------------------------------------------------

const COLUMNS = `p.id, p.payment_id, p.organization_id, o.name as organization_name, p.client_id, p.from_account, p.to_account,
  p.amount_value::text as amount_text, p.currency, p.reference, p.end_to_end_id, p.flow_type, p.redirect_url, p.status,
  p.provider_code, p.bank_id, p.provider_payment_id, p.provider_redirect_url, p.expires_at, p.completed_at,
  p.error_code, p.error_message, p.created_at, p.updated_at`;
const FROM = `from payments p join organizations o on o.id = p.organization_id`;

export interface PaymentRow {
  id: string;
  payment_id: string;
  organization_id: string;
  organization_name: string;
  client_id: string;
  from_account: Record<string, any> | null;
  to_account: Record<string, any>;
  amount_text: string;
  currency: string;
  reference: string | null;
  end_to_end_id: string | null;
  flow_type: (typeof FLOW_TYPES)[number];
  redirect_url: string | null;
  status: PaymentStatus;
  provider_code: string;
  bank_id: string | null;
  provider_payment_id: string | null;
  provider_redirect_url: string | null;
  expires_at: Date | string | null;
  completed_at: Date | string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/** numeric(20,4) text ("10.5000") to the caller's form: no trailing zeros, but never fewer than 2 decimals. */
export function formatAmount(text: string): string {
  const [int, frac = ''] = text.split('.');
  const trimmed = frac.replace(/0+$/, '').padEnd(2, '0');
  return `${int}.${trimmed}`;
}

const amountOf = (r: PaymentRow) => ({ value: formatAmount(r.amount_text), currency: r.currency });

const toAdapterPayment = (r: PaymentRow): AdapterPayment => ({
  id: r.id,
  paymentId: r.payment_id,
  organizationId: r.organization_id,
  clientId: r.client_id,
  toAccount: r.to_account,
  fromAccount: r.from_account,
  amountValue: formatAmount(r.amount_text),
  currency: r.currency,
  reference: r.reference,
  redirectUrl: r.redirect_url,
  flowType: r.flow_type,
  bankId: r.bank_id,
});

export interface HistoryEntry {
  status: PaymentStatus;
  timestamp: Date | string;
  provider: string | null;
  details: string | null;
}

async function historyFor(db: Db, ids: string[]): Promise<Map<string, HistoryEntry[]>> {
  const out = new Map<string, HistoryEntry[]>();
  if (ids.length === 0) return out;
  const rows = await db.query<any>(
    `select payment_id, status, provider_code, details, created_at
       from payment_status_history where payment_id = any($1::uuid[]) order by created_at, id`,
    [ids],
  );
  for (const r of rows) {
    const list = out.get(r.payment_id) ?? [];
    list.push({ status: r.status, timestamp: r.created_at, provider: r.provider_code, details: r.details });
    out.set(r.payment_id, list);
  }
  return out;
}

const errorOf = (r: PaymentRow) => (r.error_code ? { code: r.error_code, message: r.error_message } : undefined);

/** What an API-key caller sees. Never includes anything the provider said. */
export function publicView(r: PaymentRow, history?: HistoryEntry[]) {
  return {
    paymentId: r.payment_id,
    status: r.status,
    provider: r.provider_code,
    bankId: r.bank_id ?? undefined,
    amount: amountOf(r),
    fromAccount: r.from_account ?? undefined,
    toAccount: r.to_account,
    reference: { reference: r.reference ?? undefined, endToEndId: r.end_to_end_id ?? undefined },
    flowType: r.flow_type,
    redirectUrl: r.redirect_url ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    expiresAt: r.expires_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    error: errorOf(r),
    ...(history ? { statusHistory: history } : {}),
  };
}

/** What the hosted payment page shows to the customer (the `PaymentSession` type in hosted-pages). */
export function hostedView(r: PaymentRow) {
  const acct = (a: Record<string, any>) => ({ accountName: a.accountName, accountNumber: a.accountNumber, sortCode: a.sortCode });
  return {
    paymentId: r.payment_id,
    status: r.status,
    amount: amountOf(r),
    reference: r.reference ?? undefined,
    description: r.reference ?? undefined,
    toAccount: acct(r.to_account),
    fromAccount: r.from_account ? acct(r.from_account) : undefined,
    merchant: { name: r.organization_name, logo: undefined, redirectUri: r.redirect_url ?? undefined },
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  };
}

/** What a dashboard admin sees. */
export function adminView(r: PaymentRow, history?: HistoryEntry[]) {
  return {
    paymentId: r.payment_id,
    organizationId: r.organization_id,
    organizationName: r.organization_name,
    clientId: r.client_id,
    status: r.status,
    provider: r.provider_code,
    bankId: r.bank_id ?? undefined,
    providerPaymentId: r.provider_payment_id ?? undefined,
    amount: amountOf(r),
    fromAccount: r.from_account ?? undefined,
    toAccount: r.to_account,
    reference: r.reference ?? undefined,
    endToEndId: r.end_to_end_id ?? undefined,
    flowType: r.flow_type,
    redirectUrl: r.redirect_url ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    expiresAt: r.expires_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    error: errorOf(r),
    ...(history
      ? { statusHistory: history }
      : {}),
    ...(history ? { audit: { statusChanges: history.length, lastStatusChange: history[history.length - 1] } } : {}),
  };
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/** A payment by its public id. With an organization it is tenant-scoped: another tenant's payment is a 404. */
export async function loadPayment(db: Db, organizationId: string | null, paymentId: string): Promise<PaymentRow> {
  const [row] = await db.query<PaymentRow>(
    `select ${COLUMNS} ${FROM} where p.payment_id = $1 and ($2::uuid is null or p.organization_id = $2::uuid)`,
    [paymentId, organizationId],
  );
  if (!row) throw new ApiError('Payment not found', 404);
  return row;
}

const loadByUuid = async (db: Db, id: string): Promise<PaymentRow> => {
  const [row] = await db.query<PaymentRow>(`select ${COLUMNS} ${FROM} where p.id = $1`, [id]);
  if (!row) throw new ApiError('Payment not found', 404);
  return row;
};

// ---------------------------------------------------------------------------
// Status changes (the one place that writes status, history and usage counters)
// ---------------------------------------------------------------------------

const RANK: Partial<Record<PaymentStatus, number>> = { PENDING: 0, AUTHORIZING: 1, AUTHORIZED: 2, SUBMITTED: 3, ACCEPTED: 4 };
const isTerminal = (s: PaymentStatus) => TERMINAL_STATUSES.includes(s);

/** Final states never change, and a live payment only moves forward (a late or repeated message cannot undo progress). */
export function canMove(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to || isTerminal(from)) return false;
  if (isTerminal(to)) return true;
  return (RANK[to] ?? 0) > (RANK[from] ?? 0);
}

export interface StatusChange {
  details?: string;
  error?: { code: string; message?: string | null };
  /** Merged into payments.provider_data. */
  providerData?: Record<string, unknown>;
}

const monthOf = (now: Date) => now.toISOString().slice(0, 7);

/**
 * Move a payment to a new status if the move is allowed, write the history row via
 * payment_set_status(), and count completed/failed payments once. The row is locked, so call this
 * inside a transaction (see applyStatusAtomic) when two writers could race.
 */
export async function applyStatus(db: Db, now: Date, paymentUuid: string, next: PaymentStatus, change: StatusChange = {}): Promise<{ changed: boolean }> {
  const [cur] = await db.query<{ status: PaymentStatus; organization_id: string }>(
    `select status, organization_id from payments where id = $1 for update`,
    [paymentUuid],
  );
  if (!cur) throw new ApiError('Payment not found', 404);
  if (!canMove(cur.status, next)) return { changed: false };

  await db.query(`select payment_set_status($1::uuid, $2::payment_status, $3)`, [paymentUuid, next, change.details ?? null]);
  if (change.error || change.providerData) {
    await db.query(
      `update payments set error_code = coalesce($2, error_code), error_message = coalesce($3, error_message),
              provider_data = provider_data || $4::jsonb where id = $1`,
      [paymentUuid, change.error?.code ?? null, change.error?.message?.slice(0, 500) ?? null, JSON.stringify(change.providerData ?? {})],
    );
  }
  if (next === 'COMPLETED' || next === 'FAILED') {
    await db.query(`select billing_increment($1::uuid, $2, 0, 0, $3, $4)`, [
      cur.organization_id,
      monthOf(now),
      next === 'COMPLETED' ? 1 : 0,
      next === 'FAILED' ? 1 : 0,
    ]);
  }
  return { changed: true };
}

export const applyStatusAtomic = (db: Db, now: Date, paymentUuid: string, next: PaymentStatus, change?: StatusChange) =>
  db.tx((tx) => applyStatus(tx, now, paymentUuid, next, change));

/** Payments nobody finished in time become EXPIRED the next time anyone looks at them. */
export async function refreshExpiry(deps: AppDeps, row: PaymentRow): Promise<PaymentRow> {
  const live = row.status === 'PENDING' || row.status === 'AUTHORIZING' || row.status === 'AUTHORIZED';
  if (!live || !row.expires_at || new Date(row.expires_at).getTime() > deps.now().getTime()) return row;
  await applyStatusAtomic(deps.db, deps.now(), row.id, 'EXPIRED', { details: 'Payment expired due to timeout' });
  return loadByUuid(deps.db, row.id);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function hostedPageUrl(deps: AppDeps, row: Pick<PaymentRow, 'payment_id' | 'organization_id' | 'client_id' | 'redirect_url'>): Promise<string> {
  const base = deps.config.hostedPagesUrl;
  if (!base) throw new ApiError('Hosted pages are not configured', 503, 'HOSTED_PAGES_NOT_CONFIGURED');
  const token = await signPaymentToken(
    deps.config.hostedPagesJwtSecret,
    { paymentId: row.payment_id, organizationId: row.organization_id, clientId: row.client_id, purpose: 'hosted-pages-access' },
    '1h',
  );
  const url = new URL(`/sessions/${encodeURIComponent(row.payment_id)}`, base);
  url.searchParams.set('token', token);
  if (row.redirect_url) url.searchParams.set('redirect_uri', row.redirect_url);
  return url.toString();
}

const FLOW_FOR_PROVIDER = { API_ONLY: 'API_ONLY', HOSTED_PAGES: 'FULL_HOSTED_PAGES', EMBEDDED_HOSTED_PAGES: 'EMBEDDED_HOSTED_PAGES' } as const;

/** Resolve the provider and check it is allowed BEFORE any provider call. Returns the adapter. */
async function resolveProvider(deps: AppDeps, organizationId: string, provider: string | undefined) {
  const code = provider ?? MOCK_PROVIDER;
  await assertProviderAllowed(deps.db, organizationId, code);
  const adapter = getPaymentAdapter(code);
  if (!adapter) throw new ApiError(`Payment provider not supported: ${code}`, 400, 'PROVIDER_NOT_SUPPORTED');
  adapter.assertConfigured(deps);
  return { code, adapter };
}

export async function createPayment(deps: AppDeps, ctx: { organizationId: string; clientId: string }, input: CreatePaymentInput) {
  const { code, adapter } = await resolveProvider(deps, ctx.organizationId, input.provider);
  const flowType = input.flowType ?? 'API_ONLY';
  if (flowType === 'EMBEDDED_HOSTED_PAGES' && !input.bankId) {
    throw new ApiError('bankId is required when flowType is EMBEDDED_HOSTED_PAGES', 400);
  }
  if (flowType !== 'API_ONLY' && !deps.config.hostedPagesUrl) {
    throw new ApiError('Hosted pages are not configured', 503, 'HOSTED_PAGES_NOT_CONFIGURED');
  }
  // With hosted pages the customer picks the bank, so the provider is only called once they have
  const deferred = flowType === 'HOSTED_PAGES' && !input.bankId;

  const paymentId = `pay_${randomId(14)}`;
  const now = deps.now();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const row = await deps.db.tx(async (tx) => {
    const [created] = await tx.query<{ id: string }>(
      `insert into payments (payment_id, organization_id, client_id, from_account, to_account, amount_value, currency,
                             reference, end_to_end_id, flow_type, redirect_url, status, provider_code, bank_id, provider_data, expires_at)
       values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::numeric, $7, $8, $9, $10::payment_flow_type, $11, 'PENDING', $12, $13, '{}'::jsonb, $14)
       returning id`,
      [
        paymentId,
        ctx.organizationId,
        ctx.clientId,
        input.fromAccount ? JSON.stringify(input.fromAccount) : null,
        JSON.stringify(input.toAccount),
        input.amount.value,
        input.amount.currency,
        input.reference?.reference ?? null,
        input.reference?.endToEndId ?? null,
        flowType,
        input.redirectUrl ?? null,
        code,
        input.bankId ?? null,
        expiresAt.toISOString(),
      ],
    );
    await tx.query(`select billing_increment($1::uuid, $2, 1, 0, 0, 0)`, [ctx.organizationId, monthOf(now)]);
    return loadByUuid(tx, created.id);
  });

  let redirectUrl: string | undefined;
  if (!deferred) {
    redirectUrl = await startWithProvider(deps, row, adapter, { bankId: input.bankId, flow: FLOW_FOR_PROVIDER[flowType] });
  }

  const fresh = await loadByUuid(deps.db, row.id);
  return {
    paymentId: fresh.payment_id,
    status: fresh.status,
    // One URL to send the customer to: Syntropi's hosted page for the hosted flows (the bank's own link is
    // only used by the hosted page itself), or the bank's link for API_ONLY
    redirectUrl: flowType === 'API_ONLY' ? (redirectUrl ?? null) : await hostedPageUrl(deps, fresh),
    provider: fresh.provider_code,
    bankId: fresh.bank_id ?? undefined,
    amount: amountOf(fresh),
    createdAt: fresh.created_at,
    expiresAt: fresh.expires_at,
  };
}

/** Call the provider for a payment that is not started yet and record what came back. Failure marks the payment FAILED. */
async function startWithProvider(
  deps: AppDeps,
  row: PaymentRow,
  adapter: NonNullable<ReturnType<typeof getPaymentAdapter>>,
  opts: { bankId?: string | null; flow: 'API_ONLY' | 'FULL_HOSTED_PAGES' | 'EMBEDDED_HOSTED_PAGES' },
): Promise<string | undefined> {
  let result;
  try {
    result = await adapter.create(deps, toAdapterPayment(row), opts);
  } catch (error: any) {
    await applyStatusAtomic(deps.db, deps.now(), row.id, 'FAILED', {
      details: 'Provider could not start the payment',
      error: { code: 'PROVIDER_ERROR', message: 'The provider could not start the payment' },
    }).catch((e) => console.warn(`Could not record failure for ${row.payment_id}: ${e?.message}`));
    throw error;
  }

  await deps.db.tx(async (tx) => {
    await tx.query(
      `update payments set provider_payment_id = $2, provider_redirect_url = $3, bank_id = coalesce($4, bank_id),
              provider_data = provider_data || $5::jsonb where id = $1`,
      [row.id, result.providerPaymentId ?? null, adapter.code === MOCK_PROVIDER ? null : (result.redirectUrl ?? null), opts.bankId ?? null, JSON.stringify(result.data)],
    );
    if (result.status !== 'PENDING') {
      await applyStatus(tx, deps.now(), row.id, result.status, { details: 'Status updated from provider' });
    }
  });
  return result.redirectUrl;
}

// ---------------------------------------------------------------------------
// Read, list, sync, cancel
// ---------------------------------------------------------------------------

/**
 * Bring a payment up to date with its provider. Calls the provider only after the approval check.
 * Strict callers (the explicit sync endpoint) see failures; the read path ignores them.
 */
export async function syncRow(deps: AppDeps, row: PaymentRow): Promise<PaymentRow> {
  if (isTerminal(row.status) || row.provider_code === MOCK_PROVIDER || !row.provider_payment_id) return row;
  await assertProviderAllowed(deps.db, row.organization_id, row.provider_code);
  const adapter = getPaymentAdapter(row.provider_code);
  if (!adapter?.getStatus) return row;
  adapter.assertConfigured(deps);

  const result = await adapter.getStatus(deps, row.provider_payment_id);
  if (result.status !== row.status) {
    await applyStatusAtomic(deps.db, deps.now(), row.id, result.status, {
      details: `Status synced from provider${result.data.providerStatus ? ` (${adapter.code}: ${result.data.providerStatus})` : ''}`,
      providerData: result.data,
    });
    return loadByUuid(deps.db, row.id);
  }
  return row;
}

export async function getPayment(deps: AppDeps, organizationId: string, paymentId: string, opts: { sync?: boolean } = {}) {
  let row = await refreshExpiry(deps, await loadPayment(deps.db, organizationId, paymentId));
  if (opts.sync !== false) {
    try {
      row = await syncRow(deps, row);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      console.warn(`Could not sync ${paymentId}: ${error.message}`);
    }
  }
  return row;
}

export async function getPaymentView(deps: AppDeps, organizationId: string, paymentId: string) {
  const row = await getPayment(deps, organizationId, paymentId);
  const history = (await historyFor(deps.db, [row.id])).get(row.id) ?? [];
  return publicView(row, history);
}

export async function listPayments(
  db: Db,
  organizationId: string,
  f: { status?: string; provider?: string; limit: number; offset: number },
) {
  const where = [`p.organization_id = $1`];
  const params: unknown[] = [organizationId];
  if (f.status) where.push(`p.status = $${params.push(f.status)}::payment_status`);
  if (f.provider) where.push(`p.provider_code = $${params.push(f.provider)}`);
  const clause = where.join(' and ');

  const [{ total }] = await db.query<{ total: number }>(`select count(*)::int as total from payments p where ${clause}`, params);
  const rows = await db.query<PaymentRow>(
    `select ${COLUMNS} ${FROM} where ${clause} order by p.created_at desc, p.id limit ${f.limit} offset ${f.offset}`,
    params,
  );
  const history = await historyFor(db, rows.map((r) => r.id));
  return { payments: rows.map((r) => publicView(r, history.get(r.id) ?? [])), total };
}

/** Explicit sync: the caller sees provider failures and the approval check. */
export async function syncPayment(deps: AppDeps, organizationId: string, paymentId: string) {
  const row = await refreshExpiry(deps, await loadPayment(deps.db, organizationId, paymentId));
  const synced = await syncRow(deps, row);
  const history = (await historyFor(deps.db, [synced.id])).get(synced.id) ?? [];
  return { row: synced, view: publicView(synced, history) };
}

export async function cancelPayment(deps: AppDeps, organizationId: string, paymentId: string) {
  let row = await refreshExpiry(deps, await loadPayment(deps.db, organizationId, paymentId));
  if (isTerminal(row.status)) {
    throw new ApiError(`Payment cannot be cancelled in ${row.status} status`, 409, 'PAYMENT_NOT_CANCELLABLE');
  }
  await assertProviderAllowed(deps.db, row.organization_id, row.provider_code);

  const adapter = getPaymentAdapter(row.provider_code);
  if (row.provider_payment_id && adapter?.cancel) {
    try {
      adapter.assertConfigured(deps);
      await adapter.cancel(deps, row.provider_payment_id);
    } catch (error: any) {
      // As before: the customer's cancel still stands even if the provider could not be told
      console.warn(`Provider cancellation failed for ${paymentId}: ${error?.message}`);
    }
  }

  const { changed } = await applyStatusAtomic(deps.db, deps.now(), row.id, 'CANCELLED', { details: 'Payment cancelled by client' });
  row = await loadByUuid(deps.db, row.id);
  if (!changed && row.status !== 'CANCELLED') {
    throw new ApiError(`Payment cannot be cancelled in ${row.status} status`, 409, 'PAYMENT_NOT_CANCELLABLE');
  }
  const history = (await historyFor(deps.db, [row.id])).get(row.id) ?? [];
  return { row, view: publicView(row, history) };
}

/** Hosted pages: the customer chose a bank. Starts the payment at the provider (or returns where it already is). */
export async function initiateHosted(deps: AppDeps, organizationId: string, input: z.infer<typeof initiateSchema>) {
  let row = await refreshExpiry(deps, await loadPayment(deps.db, organizationId, input.paymentId));
  if (isTerminal(row.status)) throw new ApiError(`Payment is already ${row.status}`, 409, 'PAYMENT_NOT_PENDING');

  const { adapter } = await resolveProvider(deps, row.organization_id, row.provider_code);

  let redirectUrl: string | undefined;
  if (row.provider_code === MOCK_PROVIDER) {
    redirectUrl = await mockBankUrl(deps, toAdapterPayment(row));
    // The customer has now chosen a bank: the payment moves on from PENDING (once, so a repeat call changes nothing)
    if (row.status === 'PENDING') {
      await deps.db.tx(async (tx) => {
        await tx.query(`update payments set bank_id = coalesce($2, bank_id) where id = $1::uuid`, [row.id, input.bankId]);
        await applyStatus(tx, deps.now(), row.id, 'AUTHORIZING', { details: 'Customer chose a bank on the hosted page' });
      });
    }
  } else if (row.provider_payment_id) {
    redirectUrl = row.provider_redirect_url ?? undefined;
  } else {
    redirectUrl = await startWithProvider(deps, row, adapter, {
      bankId: input.bankId,
      flow: input.flowType === 'HOSTED' ? 'FULL_HOSTED_PAGES' : 'API_ONLY',
    });
  }
  row = await loadByUuid(deps.db, row.id);
  return { paymentId: row.payment_id, status: row.status, redirectUrl: redirectUrl ?? null };
}

/** Hosted pages status poll: syncs with the provider when it can, then returns the page's view. */
export async function hostedSession(deps: AppDeps, organizationId: string, paymentId: string, opts: { sync: boolean }) {
  const row = await getPayment(deps, organizationId, paymentId, { sync: opts.sync });
  return hostedView(row);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminFilter {
  organizationId?: string;
  status?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
}

function adminWhere(f: AdminFilter) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.organizationId) where.push(`p.organization_id = $${params.push(f.organizationId)}::uuid`);
  if (f.status) where.push(`p.status = $${params.push(f.status)}::payment_status`);
  if (f.provider) where.push(`p.provider_code = $${params.push(f.provider)}`);
  if (f.startDate) where.push(`p.created_at >= $${params.push(f.startDate)}::timestamptz`);
  if (f.endDate) where.push(`p.created_at <= $${params.push(f.endDate)}::timestamptz`);
  return { clause: where.length ? `where ${where.join(' and ')}` : '', params };
}

export async function adminListPayments(db: Db, f: AdminFilter, page: { limit: number; offset: number }) {
  const { clause, params } = adminWhere(f);
  const [{ total }] = await db.query<{ total: number }>(`select count(*)::int as total from payments p ${clause}`, params);
  const rows = await db.query<PaymentRow>(
    `select ${COLUMNS} ${FROM} ${clause} order by p.created_at desc, p.id limit ${page.limit} offset ${page.offset}`,
    params,
  );
  const history = await historyFor(db, rows.map((r) => r.id));
  return { payments: rows.map((r) => adminView(r, history.get(r.id) ?? [])), total };
}

export async function adminGetPayment(db: Db, organizationId: string | null, paymentId: string) {
  const row = await loadPayment(db, organizationId, paymentId);
  const history = (await historyFor(db, [row.id])).get(row.id) ?? [];
  return adminView(row, history);
}

/** The four Mongo pipelines (by status, by provider, total volume, average) as SQL, plus the count and a per-currency split. */
export async function adminAnalytics(db: Db, f: AdminFilter) {
  const { clause, params } = adminWhere(f);
  const [totals, byStatus, byProvider, byCurrency] = await Promise.all([
    db.query<{ total: number; volume: string; average: string }>(
      `select count(*)::int as total, coalesce(sum(p.amount_value), 0)::text as volume, coalesce(round(avg(p.amount_value), 4), 0)::text as average
         from payments p ${clause}`,
      params,
    ),
    db.query<{ status: string; count: number; volume: string }>(
      `select p.status::text as status, count(*)::int as count, sum(p.amount_value)::text as volume
         from payments p ${clause} group by p.status order by count desc, status`,
      params,
    ),
    db.query<{ provider: string; count: number; volume: string }>(
      `select p.provider_code as provider, count(*)::int as count, sum(p.amount_value)::text as volume
         from payments p ${clause} group by p.provider_code order by count desc, p.provider_code`,
      params,
    ),
    db.query<{ currency: string; count: number; volume: string; average: string }>(
      `select p.currency::text as currency, count(*)::int as count, sum(p.amount_value)::text as volume, round(avg(p.amount_value), 4)::text as average
         from payments p ${clause} group by p.currency order by count desc, p.currency`,
      params,
    ),
  ]);
  const money = (t: string) => formatAmount(t.includes('.') ? t : `${t}.00`);
  const t = totals[0];
  return {
    summary: { totalPayments: t.total, totalVolume: money(t.volume), averageAmount: money(t.average) },
    breakdown: {
      byStatus: byStatus.map((r) => ({ status: r.status, count: r.count, volume: money(r.volume) })),
      byProvider: byProvider.map((r) => ({ provider: r.provider, count: r.count, volume: money(r.volume) })),
      byCurrency: byCurrency.map((r) => ({ currency: r.currency, count: r.count, volume: money(r.volume), average: money(r.average) })),
    },
  };
}
