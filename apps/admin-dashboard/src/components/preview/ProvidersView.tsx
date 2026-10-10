'use client';

import React from 'react';
import { CheckCircle2, FlaskConical, Info } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import StatusChip from './StatusChip';
import { PROVIDERS, usePreviewAccess, type AccessStatus } from './previewStore';

const ROW_H = 96;
const TRUNK_X = 20;

/** One row of the route ribbon: a branch from the account trunk out to a provider. */
function Branch({ status, last }: { status: AccessStatus; last?: boolean }) {
  const mid = ROW_H / 2;
  const live = status === 'approved';
  const pending = status === 'pending';
  return (
    <svg width="132" height={ROW_H} viewBox={`0 0 132 ${ROW_H}`} className="hidden shrink-0 sm:block" aria-hidden>
      {/* trunk: the account's own connection, always live */}
      <line
        className="ribbon-line"
        data-live="true"
        x1={TRUNK_X}
        x2={TRUNK_X}
        y1={0}
        y2={last ? mid - 14 : ROW_H}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="ribbon-line"
        data-live={live}
        data-pending={pending}
        d={`M ${TRUNK_X} ${mid - 14} C ${TRUNK_X} ${mid + 8}, ${TRUNK_X + 18} ${mid}, ${TRUNK_X + 46} ${mid} L 126 ${mid}`}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        cx="126"
        cy={mid}
        r="5"
        fill={live ? 'var(--d-accent)' : pending ? 'var(--d-warn)' : 'var(--d-ink-3)'}
        opacity={live || pending ? 1 : 0.4}
      />
    </svg>
  );
}

interface ProvidersViewProps {
  /** Shown above the ribbon to set expectations for this audience. */
  intro: string;
}

export default function ProvidersView({ intro }: ProvidersViewProps) {
  const { currentOrganization } = useOrganization();
  const { map, set } = usePreviewAccess();
  const orgName = currentOrganization?.name || 'Your organization';
  const status = (code: string): AccessStatus => map[`mine:${code}`] || 'none';
  const total = PROVIDERS.length + 1;

  return (
    <div className="max-w-4xl space-y-5 p-6">
      <div
        className="flex items-start gap-3 px-4 py-3 text-sm"
        style={{ borderRadius: 'var(--d-r-ctl)', background: 'var(--d-accent-soft)', color: 'var(--d-ink)' }}
      >
        <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          <strong>Preview on sample data.</strong> Requests here don&apos;t touch the API yet. Request a provider, then
          approve it in the Approval queue (platform admin) to see this page update.
        </p>
      </div>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--d-ink)' }}>
          Where your payments can go
        </h2>
        <p className="mt-1 max-w-prose text-sm" style={{ color: 'var(--d-ink-2)' }}>
          {intro}
        </p>

        <div className="mt-6">
          {/* Origin: the account */}
          <div className="flex items-center gap-4">
            <div className="relative hidden h-10 w-[132px] shrink-0 sm:block" aria-hidden>
              {/* trunk continues from the origin down into the first branch */}
              <span
                className="absolute bottom-0 w-[3px] rounded-full"
                style={{ left: TRUNK_X - 1.5, top: 20, background: 'var(--d-accent)' }}
              />
              <span
                className="absolute top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                style={{ left: TRUNK_X - 14, background: 'var(--d-accent)', color: 'var(--d-on-accent)' }}
              >
                {orgName[0]?.toUpperCase()}
              </span>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--d-ink)' }}>
              {orgName}
            </p>
          </div>

          {/* Mock bank: always live */}
          <div className="flex items-center gap-4">
            <Branch status="approved" />
            <ProviderRow
              name="Mock bank"
              blurb="Practice payments with test banks. No real money moves."
              icon={<FlaskConical size={18} aria-hidden />}
              chip={
                <span className="chip" data-tone="ok">
                  <CheckCircle2 size={13} aria-hidden />
                  Always on
                </span>
              }
            />
          </div>

          {PROVIDERS.map((p, i) => {
            const s = status(p.code);
            return (
              <div key={p.code} className="flex items-center gap-4">
                <Branch status={s} last={i === PROVIDERS.length - 1} />
                <ProviderRow
                  name={p.name}
                  blurb={p.blurb}
                  chip={<StatusChip status={s} />}
                  action={
                    s === 'none' || s === 'rejected' ? (
                      <button className="btn-primary" onClick={() => set(`mine:${p.code}`, 'pending')}>
                        {s === 'rejected' ? 'Request again' : 'Request access'}
                      </button>
                    ) : s === 'pending' ? (
                      <button className="btn-quiet" onClick={() => set(`mine:${p.code}`, 'none')}>
                        Withdraw request
                      </button>
                    ) : null
                  }
                />
              </div>
            );
          })}
        </div>
        <p className="sr-only">{total} routes listed</p>
      </section>
    </div>
  );
}

function ProviderRow({
  name,
  blurb,
  chip,
  action,
  icon,
}: {
  name: string;
  blurb: string;
  chip: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 py-4 sm:py-0" style={{ minHeight: ROW_H }}>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold" style={{ color: 'var(--d-ink)' }}>
          {icon}
          {name}
        </p>
        <p className="text-sm" style={{ color: 'var(--d-ink-2)' }}>
          {blurb}
        </p>
      </div>
      {chip}
      {action}
    </div>
  );
}
