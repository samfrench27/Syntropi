import Stripe from 'stripe';
import { ApiError } from '../http';
import type { AppDeps } from '../types';
import { planConfigs, type PlanKey } from './billing';

export const NOT_CONFIGURED = 'Billing is not configured';

/**
 * A Stripe client that talks through deps.fetch (so tests can fake it) and takes its key only
 * from the environment. No key means billing is switched off: 503, never a crash and never a
 * fallback key.
 */
export function stripeClient(deps: Pick<AppDeps, 'env' | 'fetch'>): Stripe {
  const key = deps.env.STRIPE_SECRET_KEY;
  if (!key) throw new ApiError(NOT_CONFIGURED, 503);
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient(deps.fetch), maxNetworkRetries: 0 });
}

/** The price id for a plan, or 503 when the plan is not set up in this environment. */
export function priceIdFor(deps: Pick<AppDeps, 'env'>, plan: PlanKey): string {
  const priceId = planConfigs(deps)[plan].priceId;
  if (!priceId) throw new ApiError(NOT_CONFIGURED, 503);
  return priceId;
}

/**
 * Run a Stripe call. Stripe's own errors are translated so their detail (which can include
 * request ids and account data) never reaches the caller; ApiErrors pass through.
 */
export async function callStripe<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    const status = e?.statusCode;
    if (status === 404 || (status === 400 && e?.code === 'resource_missing')) throw new ApiError('Not found at the billing provider', 404);
    if (typeof status === 'number') console.error(`Stripe error ${status}: ${e?.type} ${e?.code ?? ''}`);
    else console.error(`Stripe request failed: ${e?.message}`);
    throw new ApiError('The billing provider could not complete the request', 502);
  }
}

/** Find or create the Stripe customer for an organization and remember its id. */
export async function ensureCustomer(
  deps: Pick<AppDeps, 'env' | 'fetch' | 'db'>,
  org: { id: string; name: string; contact_email: string; billing_email: string | null; stripe_customer_id: string | null },
): Promise<string> {
  if (org.stripe_customer_id) return org.stripe_customer_id;
  const stripe = stripeClient(deps);
  const customer = await callStripe(() =>
    stripe.customers.create(
      { email: org.billing_email || org.contact_email, name: org.name, metadata: { organizationId: org.id } },
      // Two simultaneous requests for the same organization get the same customer
      { idempotencyKey: `syntropi-customer-${org.id}` },
    ),
  );
  // First writer wins; if another request got there first, use its id
  const [row] = await deps.db.query<{ stripe_customer_id: string }>(
    `update organizations set stripe_customer_id = coalesce(stripe_customer_id, $2) where id = $1 returning stripe_customer_id`,
    [org.id, customer.id],
  );
  return row.stripe_customer_id;
}
