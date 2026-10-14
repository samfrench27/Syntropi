import { Hono } from 'hono';
import Stripe from 'stripe';
import { ApiError, ok } from '../http';
import { logActivity } from '../lib/activity';
import type { Db } from '../db';
import type { AppDeps, AppEnv } from '../types';
import { customerId, isPlanKey, isUuid, syncSubscription, type PlanKey, type StripeSubscriptionLike } from '../services/billing';
import { callStripe, NOT_CONFIGURED, stripeClient } from '../services/stripe';

// Stripe's own webhook: verified with the signing secret over the raw body. Mounted at /api/webhooks/stripe.
export const stripeWebhookRoutes = new Hono<AppEnv>();

const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]);

/** Which organization a subscription belongs to: our own tag first, then the Stripe customer. */
async function organizationFor(db: Db, sub: StripeSubscriptionLike): Promise<string | undefined> {
  const tagged = sub.metadata?.organizationId;
  if (isUuid(tagged)) {
    const [org] = await db.query<{ id: string }>(`select id from organizations where id = $1`, [tagged]);
    if (org) return org.id;
  }
  const [byCustomer] = await db.query<{ id: string }>(`select id from organizations where stripe_customer_id = $1`, [customerId(sub)]);
  if (byCustomer) return byCustomer.id;
  const [bySub] = await db.query<{ organization_id: string }>(`select organization_id from subscriptions where stripe_subscription_id = $1`, [sub.id]);
  return bySub?.organization_id;
}

const invoiceSubscriptionId = (invoice: any): string | undefined => {
  const s = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  return typeof s === 'string' ? s : s?.id;
};

stripeWebhookRoutes.post('/', async (c) => {
  const deps = c.get('deps');
  const secret = deps.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(NOT_CONFIGURED, 503);

  const signature = c.req.header('stripe-signature');
  if (!signature) throw new ApiError('Missing Stripe signature', 400);

  // The signature covers the exact bytes Stripe sent, so read the raw text, not parsed JSON
  const raw = await c.req.text();
  let event: Stripe.Event;
  try {
    event = await Stripe.webhooks.constructEventAsync(raw, signature, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    throw new ApiError('Invalid Stripe signature', 400);
  }

  if (!HANDLED.has(event.type)) return ok(c, { received: true, ignored: true });

  // Cheap replay check before doing any work. The insert below is the authority.
  const [seen] = await deps.db.query(`select 1 from stripe_events where id = $1`, [event.id]);
  if (seen) return ok(c, { received: true, duplicate: true });

  const eventAt = new Date(event.created * 1000);
  const object = event.data.object as any;

  // Anything that needs Stripe is fetched before the transaction opens
  let fetchedSub: StripeSubscriptionLike | undefined;
  if (event.type === 'checkout.session.completed' && object.mode === 'subscription' && object.subscription) {
    const id = typeof object.subscription === 'string' ? object.subscription : object.subscription.id;
    const stripe = stripeClient(deps);
    fetchedSub = (await callStripe(() => stripe.subscriptions.retrieve(id))) as unknown as StripeSubscriptionLike;
  }

  const outcome = await deps.db.tx(async (tx) => {
    // Recording and applying are one transaction: a failure leaves the event unrecorded so Stripe's retry applies it
    const inserted = await tx.query(`insert into stripe_events (id, type) values ($1, $2) on conflict (id) do nothing returning id`, [event.id, event.type]);
    if (inserted.length === 0) return { duplicate: true as const };
    return { duplicate: false as const, ...(await apply(tx, deps, event, object, eventAt, fetchedSub)) };
  });

  if (!outcome.duplicate && outcome.activity) await logActivity(c, outcome.activity);
  return ok(c, { received: true, duplicate: outcome.duplicate });
});

type Activity = { organizationId: string; action: string; details?: unknown };

async function apply(
  db: Db,
  deps: Pick<AppDeps, 'env' | 'now'>,
  event: Stripe.Event,
  object: any,
  eventAt: Date,
  fetchedSub?: StripeSubscriptionLike,
): Promise<{ activity?: Activity }> {
  switch (event.type) {
    case 'checkout.session.completed': {
      // Same work as POST /client/billing/checkout/success; applying it twice is harmless
      if (!fetchedSub) return {};
      const orgId = object.metadata?.organizationId;
      if (!isUuid(orgId)) return {};
      const plan: PlanKey | undefined = isPlanKey(object.metadata?.plan) ? object.metadata.plan : undefined;
      const result = await syncSubscription(db, deps, { organizationId: orgId, sub: fetchedSub, plan, eventAt });
      return result.applied
        ? { activity: { organizationId: orgId, action: 'billing.subscription.sync', details: { event: event.type, subscriptionId: fetchedSub.id } } }
        : {};
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = object as StripeSubscriptionLike;
      const orgId = await organizationFor(db, sub);
      if (!orgId) return {};
      const result = await syncSubscription(db, deps, { organizationId: orgId, sub, eventAt });
      return result.applied
        ? { activity: { organizationId: orgId, action: 'billing.subscription.sync', details: { event: event.type, subscriptionId: sub.id, status: sub.status } } }
        : {};
    }
    case 'invoice.payment_failed': {
      const subId = invoiceSubscriptionId(object);
      if (!subId) return {};
      // Only a live subscription goes past due; an ended one stays ended. The organization keeps its plan while Stripe retries.
      const [row] = await db.query<{ organization_id: string }>(
        `update subscriptions set status = 'past_due' where stripe_subscription_id = $1 and status = 'active' returning organization_id`,
        [subId],
      );
      return row ? { activity: { organizationId: row.organization_id, action: 'billing.payment_failed', details: { invoiceId: object.id, subscriptionId: subId } } } : {};
    }
    default:
      return {};
  }
}
