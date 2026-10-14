'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { billingAPI, describeApiError } from '@/lib/api';

interface Metrics {
  month: string;
  organizations: { total: number; active: number; byPlan: Record<string, number> };
  subscriptions: { total: number; active: number; pastDue: number; canceled: number; planDistribution: Array<{ _id: string; count: number }> };
  usage: { payments: number; apiCalls: number; successfulPayments: number; failedPayments: number };
  payments: { total: number; successful: number; failed: number; successRate: number; volumeByCurrency: Array<{ currency: string; minor: number }> };
}

interface Revenue {
  totalRevenue: number;
  refunds: number;
  netRevenue: number;
  currency: string;
}

interface SubscriptionRow {
  _id: string;
  plan: string;
  status: string;
  currentPeriodEnd?: string | null;
  organizationId: { name: string; contactEmail: string; plan: string };
}

const PLAN_LABEL: Record<string, string> = { free: 'Free', starter: 'Starter', growth: 'Growth', enterprise: 'Enterprise' };
const STATUS_TONE: Record<string, string> = { active: 'ok', past_due: 'warn', incomplete: 'warn', canceled: 'bad', unpaid: 'bad' };

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100);
const number = (n: number) => new Intl.NumberFormat('en-GB').format(n);
const monthLabel = (m: string) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const dateLabel = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'Not set');

export default function PlatformBillingPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [revenueNote, setRevenueNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, s, r] = await Promise.allSettled([
      billingAPI.getMetrics(),
      billingAPI.getSubscriptions({ limit: 50 }),
      billingAPI.getRevenue(),
    ]);

    if (m.status === 'fulfilled') {
      setMetrics(m.value.data.data);
      setError(null);
    } else {
      setError(describeApiError(m.reason, 'We could not load billing figures.'));
    }
    if (s.status === 'fulfilled') setSubs(s.value.data.data.subscriptions ?? []);

    // Revenue comes from Stripe. Without Stripe set up, the rest of the page still works.
    if (r.status === 'fulfilled') {
      setRevenue(r.value.data.data.revenue);
      setRevenueNote(null);
    } else {
      setRevenue(null);
      setRevenueNote(
        (r.reason as any)?.response?.status === 503
          ? 'Revenue is read from Stripe, and Stripe is not set up for this environment.'
          : describeApiError(r.reason, 'We could not load revenue from Stripe.'),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !metrics) {
    return (
      <div className="max-w-6xl space-y-5 p-6" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="panel h-28 animate-pulse" />
          ))}
        </div>
        <div className="panel h-64 animate-pulse" />
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="max-w-6xl p-6">
        <div role="alert" className="panel flex flex-col items-start gap-3 p-6">
          <p className="flex items-start gap-2 text-sm" style={{ color: 'var(--d-bad-ink)' }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
          <button className="btn-quiet" onClick={load}>
            <RefreshCw size={14} aria-hidden /> Try again
          </button>
        </div>
      </div>
    );
  }

  const dist = metrics?.subscriptions.planDistribution ?? [];
  const maxDist = Math.max(1, ...dist.map((d) => d.count));
  const gbp = metrics?.payments.volumeByCurrency.find((v) => v.currency === 'GBP') ?? metrics?.payments.volumeByCurrency[0];

  return (
    <div className="max-w-6xl space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--d-ink-2)' }}>
          Figures for {metrics ? monthLabel(metrics.month) : 'this month'}, from our own records.
        </p>
        <button className="btn-quiet" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden /> Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Organizations" value={number(metrics?.organizations.total ?? 0)} hint={`${number(metrics?.organizations.active ?? 0)} active`} />
        <Tile label="Active subscriptions" value={number(metrics?.subscriptions.active ?? 0)} hint={`${number(metrics?.subscriptions.pastDue ?? 0)} past due`} />
        <Tile label="Payments this month" value={number(metrics?.payments.total ?? 0)} hint={`${metrics?.payments.successRate ?? 0}% succeeded`} />
        <Tile label="Completed volume" value={gbp ? money(gbp.minor, gbp.currency) : money(0, 'GBP')} hint={`${number(metrics?.usage.apiCalls ?? 0)} API calls`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-6" aria-labelledby="revenue-h">
          <h2 id="revenue-h" className="text-lg font-semibold" style={{ color: 'var(--d-ink)' }}>
            Subscription revenue
          </h2>
          {revenue ? (
            <dl className="mt-4 grid grid-cols-3 gap-4">
              <Fig label="Collected" value={money(revenue.totalRevenue * 100, revenue.currency)} />
              <Fig label="Refunded" value={money(revenue.refunds * 100, revenue.currency)} />
              <Fig label="Net" value={money(revenue.netRevenue * 100, revenue.currency)} />
            </dl>
          ) : (
            <p className="mt-3 text-sm" style={{ color: 'var(--d-ink-2)' }}>
              {revenueNote}
            </p>
          )}
        </section>

        <section className="panel p-6" aria-labelledby="dist-h">
          <h2 id="dist-h" className="text-lg font-semibold" style={{ color: 'var(--d-ink)' }}>
            Plans in use
          </h2>
          <ul className="mt-4 space-y-3">
            {(['free', 'starter', 'growth', 'enterprise'] as const).map((p) => {
              const orgs = metrics?.organizations.byPlan[p] ?? 0;
              const paid = dist.find((d) => d._id === p)?.count ?? 0;
              const total = metrics?.organizations.total || 1;
              return (
                <li key={p}>
                  <div className="flex justify-between text-sm" style={{ color: 'var(--d-ink)' }}>
                    <span>{PLAN_LABEL[p]}</span>
                    <span className="mono">
                      {orgs} {orgs === 1 ? 'organization' : 'organizations'}
                      {paid > 0 ? `, ${paid} subscribed` : ''}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: 'var(--d-accent-soft)' }} aria-hidden>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(orgs ? 4 : 0, (orgs / total) * 100)}%`, background: 'var(--d-accent)' }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="sr-only">Largest group has {maxDist} subscriptions</p>
        </section>
      </div>

      <section className="panel overflow-hidden" aria-labelledby="subs-h">
        <h2 id="subs-h" className="px-6 py-4 text-lg font-semibold" style={{ color: 'var(--d-ink)', borderBottom: '1px solid var(--d-panel-edge)' }}>
          Subscriptions
        </h2>
        {subs.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm" style={{ color: 'var(--d-ink-2)' }}>
            No organization has a paid subscription yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--d-ink-2)' }} className="text-left">
                  <th scope="col" className="px-6 py-3 font-medium">Organization</th>
                  <th scope="col" className="px-6 py-3 font-medium">Plan</th>
                  <th scope="col" className="px-6 py-3 font-medium">Status</th>
                  <th scope="col" className="px-6 py-3 font-medium">Next billing</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s._id} style={{ borderTop: '1px solid var(--d-panel-edge)' }}>
                    <td className="px-6 py-3">
                      <p className="font-medium" style={{ color: 'var(--d-ink)' }}>{s.organizationId.name}</p>
                      <p style={{ color: 'var(--d-ink-2)' }}>{s.organizationId.contactEmail}</p>
                    </td>
                    <td className="px-6 py-3" style={{ color: 'var(--d-ink)' }}>{PLAN_LABEL[s.plan] ?? s.plan}</td>
                    <td className="px-6 py-3">
                      <span className="chip" data-tone={STATUS_TONE[s.status] ?? 'idle'}>{s.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-6 py-3" style={{ color: 'var(--d-ink)' }}>{dateLabel(s.currentPeriodEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="panel p-5">
      <p className="text-sm" style={{ color: 'var(--d-ink-2)' }}>{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>{value}</p>
      <p className="mt-1 text-sm" style={{ color: 'var(--d-ink-2)' }}>{hint}</p>
    </div>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm" style={{ color: 'var(--d-ink-2)' }}>{label}</dt>
      <dd className="text-xl font-semibold" style={{ color: 'var(--d-ink)' }}>{value}</dd>
    </div>
  );
}
