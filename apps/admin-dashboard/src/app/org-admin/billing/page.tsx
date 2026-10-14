'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingAPI, describeApiError } from '@/lib/api';

interface Subscription {
  id: string;
  plan: string;
  status: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}

interface Plan {
  name: string;
  price: number;
  interval: string;
  features: string[];
}

// Prices live in Stripe; what each plan includes is shown here.
const PLANS: Record<string, Plan> = {
  starter: {
    name: 'Starter',
    price: 10,
    interval: 'month',
    features: ['Up to 100 payments per month', 'Basic API access', 'Email support', 'Standard reporting'],
  },
  growth: {
    name: 'Growth',
    price: 50,
    interval: 'month',
    features: ['Up to 1,000 payments per month', 'Advanced API features', 'Priority support', 'Advanced reporting', 'Webhooks'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 150,
    interval: 'month',
    features: ['Unlimited payments', 'Full API access', 'Dedicated support', 'Custom reporting', 'Advanced webhooks', 'SLA guarantee'],
  },
};

const STATUS_TONE: Record<string, string> = { active: 'ok', trialing: 'ok', past_due: 'warn', incomplete: 'warn', canceled: 'bad', unpaid: 'bad' };
const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const formatDate = (iso?: string | null) => {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Not set' : d.toLocaleDateString('en-GB', { dateStyle: 'medium' });
};

function describeBillingError(error: any, fallback: string): string {
  if (error?.response?.status === 503) return 'Billing is not set up for this environment yet, so plans cannot be changed here.';
  return describeApiError(error, fallback);
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      const response = await billingAPI.getSubscription();
      // The subscription is `data.subscription`, and null until the organization has one
      const sub = response.data?.data?.subscription;
      setSubscription(sub && typeof sub === 'object' && sub.plan ? (sub as Subscription) : null);
      setLoadError(null);
    } catch (error) {
      setLoadError(describeBillingError(error, 'We could not load your subscription.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCheckoutSuccess = useCallback(
    async (sessionId: string) => {
      try {
        await billingAPI.handleCheckoutSuccess({ sessionId });
        toast.success('Subscription activated');
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchSubscription();
      } catch (error) {
        toast.error(describeBillingError(error, 'We could not confirm your payment. If you were charged, it will appear shortly.'));
      }
    },
    [fetchSubscription],
  );

  useEffect(() => {
    fetchSubscription();
    // Returning from Stripe Checkout
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('success') === 'true' && sessionId) handleCheckoutSuccess(sessionId);
  }, [fetchSubscription, handleCheckoutSuccess]);

  const handlePlanSelect = async (planKey: string) => {
    if (subscription?.plan === planKey && subscription.status !== 'incomplete') return;
    setBusyPlan(planKey);
    try {
      const response = subscription
        ? await billingAPI.updateSubscription({ plan: planKey })
        : await billingAPI.createSubscription({ plan: planKey });
      const data = response.data?.data;
      if (data?.checkoutUrl) {
        toast.success('Taking you to checkout');
        window.location.href = data.checkoutUrl;
      } else {
        toast.success('Plan updated');
        fetchSubscription();
      }
    } catch (error) {
      toast.error(describeBillingError(error, 'We could not change your plan.'));
    } finally {
      setBusyPlan(null);
    }
  };

  const handleCancel = async () => {
    if (!subscription) return;
    if (!confirm('Cancel your subscription? It stays active until the end of your billing period.')) return;
    try {
      await billingAPI.cancelSubscription();
      toast.success('Subscription cancelled. It stays active until the end of the period.');
      fetchSubscription();
    } catch (error) {
      toast.error(describeBillingError(error, 'We could not cancel your subscription.'));
    }
  };

  const openPortal = async () => {
    try {
      const response = await billingAPI.createBillingPortalSession();
      window.location.href = response.data.data.url;
    } catch (error) {
      toast.error(describeBillingError(error, 'We could not open the billing portal.'));
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl space-y-5 p-6" aria-busy="true">
        <div className="panel h-40 animate-pulse" />
        <div className="panel h-72 animate-pulse" />
      </div>
    );
  }

  const incomplete = subscription?.status === 'incomplete';

  return (
    <div className="max-w-5xl space-y-5 p-6">
      {loadError && (
        <div role="alert" className="panel flex flex-col items-start gap-3 p-6">
          <p className="flex items-start gap-2 text-sm" style={{ color: 'var(--d-bad-ink)' }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {loadError}
          </p>
          <button className="btn-quiet" onClick={fetchSubscription}>
            <RefreshCw size={14} aria-hidden /> Try again
          </button>
        </div>
      )}

      {subscription && (
        <section className="panel p-6" aria-labelledby="current-sub">
          <h2 id="current-sub" className="text-lg font-semibold" style={{ color: 'var(--d-ink)' }}>
            Current subscription
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm" style={{ color: 'var(--d-ink-2)' }}>Plan</dt>
              <dd className="font-semibold" style={{ color: 'var(--d-ink)' }}>{PLANS[subscription.plan]?.name ?? subscription.plan}</dd>
            </div>
            <div>
              <dt className="text-sm" style={{ color: 'var(--d-ink-2)' }}>Status</dt>
              <dd>
                <span className="chip" data-tone={STATUS_TONE[subscription.status] ?? 'idle'}>
                  {subscription.status === 'active' ? <CheckCircle2 size={13} aria-hidden /> : <Clock size={13} aria-hidden />}
                  {statusLabel(subscription.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm" style={{ color: 'var(--d-ink-2)' }}>{subscription.cancelAtPeriodEnd ? 'Ends on' : 'Next billing date'}</dt>
              <dd className="font-semibold" style={{ color: 'var(--d-ink)' }}>{formatDate(subscription.currentPeriodEnd)}</dd>
            </div>
            <div>
              <dt className="text-sm" style={{ color: 'var(--d-ink-2)' }}>Renewal</dt>
              <dd className="font-semibold" style={{ color: 'var(--d-ink)' }}>{subscription.cancelAtPeriodEnd ? 'Cancelled' : 'Automatic'}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {incomplete ? (
              <>
                <p className="w-full text-sm" style={{ color: 'var(--d-warn-ink)' }}>Payment is needed to activate this subscription.</p>
                <button className="btn-primary" disabled={busyPlan !== null} onClick={() => handlePlanSelect(subscription.plan)}>
                  {busyPlan ? 'Working...' : 'Complete payment'}
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={openPortal}>Manage billing</button>
            )}
            {!subscription.cancelAtPeriodEnd && !incomplete && (
              <button className="btn-quiet" onClick={handleCancel}>Cancel subscription</button>
            )}
          </div>
        </section>
      )}

      <section className="panel p-6" aria-labelledby="plans">
        <h2 id="plans" className="text-lg font-semibold" style={{ color: 'var(--d-ink)' }}>
          {subscription ? 'Change plan' : 'Choose a plan'}
        </h2>
        {!subscription && !loadError && (
          <p className="mt-1 text-sm" style={{ color: 'var(--d-ink-2)' }}>
            Your organization is on the free plan. Pick a plan to raise your limits.
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {Object.entries(PLANS).map(([key, plan]) => {
            const current = subscription?.plan === key;
            return (
              <div
                key={key}
                className="flex flex-col p-5"
                style={{
                  borderRadius: 'var(--d-r-panel)',
                  border: `1px solid ${current ? 'var(--d-accent)' : 'var(--d-panel-edge)'}`,
                  background: current ? 'var(--d-accent-soft)' : 'transparent',
                }}
              >
                <h3 className="text-lg font-semibold" style={{ color: 'var(--d-ink)' }}>{plan.name}</h3>
                <p className="mt-1">
                  <span className="text-3xl font-semibold" style={{ color: 'var(--d-ink)' }}>£{plan.price}</span>
                  <span className="text-sm" style={{ color: 'var(--d-ink-2)' }}> a {plan.interval}</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: 'var(--d-ink-2)' }}>
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--d-ok-ink)' }} aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handlePlanSelect(key)}
                  disabled={(current && !incomplete) || busyPlan !== null}
                  className={current ? 'btn-quiet mt-5 w-full' : 'btn-primary mt-5 w-full'}
                >
                  {current ? 'Current plan' : busyPlan === key ? 'Working...' : subscription ? 'Switch to this plan' : 'Choose plan'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
