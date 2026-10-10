'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Info, RotateCcw, X } from 'lucide-react';
import StatusChip from '@/components/preview/StatusChip';
import { PROVIDERS, usePreviewAccess, type AccessStatus } from '@/components/preview/previewStore';

interface QueueRow {
  id: string;
  org: string;
  provider: string;
  providerCode: string;
  note: string;
  requested: string;
  live?: boolean;
}

// Fictional companies only. "mine:*" rows come from the Providers page in this browser.
const SEED: QueueRow[] = [
  { id: 'r1', org: 'Northwind Payments', provider: 'Token.io', providerCode: 'token', requested: '2 hours ago', note: 'Launching pay-by-bank on our marketplace checkout. About 2,000 payments a month in the first quarter.' },
  { id: 'r2', org: 'Harbor Ledger', provider: 'Yapily', providerCode: 'yapily', requested: 'Yesterday', note: 'Need account data and payments for our bookkeeping product.' },
  { id: 'r3', org: 'Lumen Retail', provider: 'Token.io', providerCode: 'token', requested: '3 days ago', note: 'Replacing card payments for subscription top-ups.' },
  { id: 'r4', org: 'Kestrel Finance', provider: 'TrueLayer', providerCode: 'truelayer', requested: 'Last week', note: 'Payouts to customers from our lending platform.' },
];

const TABS: { id: AccessStatus; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

export default function ProviderRequestsPage() {
  const { map, set, reset } = usePreviewAccess();
  const [tab, setTab] = useState<AccessStatus>('pending');
  const [openId, setOpenId] = useState<string | null>(null);

  const rows: QueueRow[] = useMemo(() => {
    const mine: QueueRow[] = PROVIDERS.filter((p) => (map[`mine:${p.code}`] || 'none') !== 'none').map((p) => ({
      id: `mine:${p.code}`,
      org: 'Your organization',
      provider: p.name,
      providerCode: p.code,
      requested: 'Just now',
      note: 'Requested from the Providers page in this browser.',
      live: true,
    }));
    return [...mine, ...SEED];
  }, [map]);

  const statusOf = (r: QueueRow): AccessStatus => map[r.id] || (r.live ? 'pending' : 'pending');
  const counts = (s: AccessStatus) => rows.filter((r) => statusOf(r) === s).length;
  const visible = rows.filter((r) => statusOf(r) === tab);
  const open = rows.find((r) => r.id === openId) || null;

  return (
    <div className="max-w-5xl space-y-5 p-6">
      <div
        className="flex items-start gap-3 px-4 py-3 text-sm"
        style={{ borderRadius: 'var(--d-r-ctl)', background: 'var(--d-accent-soft)', color: 'var(--d-ink)' }}
      >
        <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p className="flex-1">
          <strong>Preview on sample data.</strong> Organizations shown are fictional. Requests you make on the
          Providers page appear here as &quot;Your organization&quot;.
        </p>
        <button className="btn-quiet shrink-0" onClick={reset}>
          <RotateCcw size={14} aria-hidden /> Reset sample data
        </button>
      </div>

      <section className="panel overflow-hidden">
        <div role="tablist" aria-label="Request status" className="flex gap-1 p-2" style={{ borderBottom: '1px solid var(--d-panel-edge)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
              style={{
                borderRadius: 'var(--d-r-ctl)',
                background: tab === t.id ? 'var(--d-accent-soft)' : 'transparent',
                color: tab === t.id ? 'var(--d-accent-ink)' : 'var(--d-ink-2)',
              }}
            >
              {t.label}
              <span className="mono text-xs opacity-80">{counts(t.id)}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm" style={{ color: 'var(--d-ink-2)' }}>
            {tab === 'pending' ? 'No requests waiting. New ones appear here as vendors ask for access.' : `No ${tab} requests yet.`}
          </p>
        ) : (
          <ul>
            {visible.map((r) => (
              <li key={r.id} style={{ borderTop: '1px solid var(--d-panel-edge)' }}>
                <button
                  onClick={() => setOpenId(r.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--d-accent-soft)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold" style={{ color: 'var(--d-ink)' }}>
                      {r.org}
                      {r.live && (
                        <span className="chip ml-2" data-tone="idle">
                          You
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm" style={{ color: 'var(--d-ink-2)' }}>
                      Wants {r.provider} · {r.requested}
                    </p>
                  </div>
                  <StatusChip status={statusOf(r)} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {open && <DetailSheet row={open} status={statusOf(open)} onClose={() => setOpenId(null)} onDecide={(s) => set(open.id, s)} />}
    </div>
  );
}

function DetailSheet({
  row,
  status,
  onClose,
  onDecide,
}: {
  row: QueueRow;
  status: AccessStatus;
  onClose: () => void;
  onDecide: (s: AccessStatus) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end p-3">
      <button aria-label="Close details" className="absolute inset-0 bg-black/15" onClick={onClose} />
      <aside
        role="dialog"
        aria-label={`${row.org} request for ${row.provider}`}
        className="glass sheet-in relative flex w-full max-w-md flex-col overflow-y-auto p-6 pb-20"
        style={{ borderRadius: 'var(--d-r-sheet)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
              {row.org}
            </h2>
            <p className="text-sm" style={{ color: 'var(--d-ink-2)' }}>
              Requested {row.requested}
            </p>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-[var(--d-accent-soft)]" style={{ color: 'var(--d-ink)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Mini route: Mock bank is already live; the requested provider lights up on approval. */}
        <div className="panel mt-5 p-4">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3" style={{ color: 'var(--d-ink)' }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--d-accent)' }} aria-hidden />
              Mock bank
              <span className="chip ml-auto" data-tone="ok">Always on</span>
            </li>
            <li className="flex items-center gap-3" style={{ color: 'var(--d-ink)' }}>
              <span
                className="h-2.5 w-2.5 rounded-full transition-colors duration-500"
                style={{ background: status === 'approved' ? 'var(--d-accent)' : status === 'pending' ? 'var(--d-warn)' : 'var(--d-ink-3)' }}
                aria-hidden
              />
              {row.provider}
              <span className="ml-auto"><StatusChip status={status} /></span>
            </li>
          </ul>
        </div>

        <h3 className="mt-6 text-sm font-semibold" style={{ color: 'var(--d-ink)' }}>
          Why they need it
        </h3>
        <p className="mt-1 max-w-prose text-sm" style={{ color: 'var(--d-ink-2)' }}>
          {row.note}
        </p>

        <div className="mt-auto pt-8">
          {status === 'pending' && !rejecting && (
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={() => onDecide('approved')}>
                <Check size={16} aria-hidden /> Approve {row.provider}
              </button>
              <button className="btn-quiet" onClick={() => setRejecting(true)}>
                Reject
              </button>
            </div>
          )}
          {status === 'pending' && rejecting && (
            <div className="space-y-3 pop-in">
              <label htmlFor="reject-reason" className="block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
                Reason for rejecting
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="ctl-input"
                placeholder="They will see this on their Providers page."
              />
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={!reason.trim()} onClick={() => onDecide('rejected')}>
                  Reject request
                </button>
                <button className="btn-quiet" onClick={() => setRejecting(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {status !== 'pending' && (
            <button className="btn-quiet w-full" onClick={() => { setRejecting(false); onDecide('pending'); }}>
              <RotateCcw size={14} aria-hidden /> Move back to pending
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
