'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Check, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import StatusChip from '@/components/providers/StatusChip';
import {
  PROVIDER_REQUESTS_CHANGED,
  describeApiError,
  providerRequestsAPI,
  type ProviderRequest,
  type ProviderRequestCounts,
} from '@/lib/api';

type Tab = keyof ProviderRequestCounts;

const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: 'pending', label: 'Pending', empty: 'No requests waiting. New ones appear here as organizations ask for access.' },
  { id: 'approved', label: 'Approved', empty: 'Nothing approved yet.' },
  { id: 'rejected', label: 'Rejected', empty: 'No rejected requests.' },
  { id: 'revoked', label: 'Revoked', empty: 'No access has been revoked.' },
];
const PAGE_SIZE = 20;

const ago = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : formatDistanceToNow(d, { addSuffix: true });
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function ProviderRequestsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<ProviderRequest[] | null>(null);
  const [pages, setPages] = useState(1);
  const [counts, setCounts] = useState<ProviderRequestCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The sheet keeps its own copy of the row, so it stays open after a decision moves the request to another tab
  const [open, setOpen] = useState<ProviderRequest | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await providerRequestsAPI.list({ status: tab, page, limit: PAGE_SIZE });
      const d = res.data.data;
      // Deciding the last request on a page leaves that page empty: step back
      if (d.requests.length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }
      setRequests(d.requests);
      setPages(Math.max(1, d.pagination.pages));
      setCounts(d.counts);
      setError(null);
      window.dispatchEvent(new CustomEvent(PROVIDER_REQUESTS_CHANGED, { detail: { pending: d.counts.pending } }));
    } catch (e) {
      setError(describeApiError(e, 'We could not load the requests.'));
    }
  }, [tab, page]);

  useEffect(() => {
    setRequests(null);
    load();
  }, [load]);

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="max-w-5xl space-y-5 p-6">
      <section className="panel overflow-hidden">
        <div
          role="tablist"
          aria-label="Request status"
          className="flex gap-1 overflow-x-auto p-2"
          style={{ borderBottom: '1px solid var(--d-panel-edge)' }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="request-list"
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              className="flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
              style={{
                borderRadius: 'var(--d-r-ctl)',
                background: tab === t.id ? 'var(--d-accent-soft)' : 'transparent',
                color: tab === t.id ? 'var(--d-accent-ink)' : 'var(--d-ink-2)',
              }}
            >
              {t.label}
              <span className="mono text-xs opacity-80">{counts ? counts[t.id] : ''}</span>
            </button>
          ))}
        </div>

        <div id="request-list" role="tabpanel" aria-labelledby={`tab-${tab}`} aria-busy={requests === null && !error}>
          {error && (
            <div role="alert" className="flex flex-col items-start gap-3 px-6 py-8">
              <p className="flex items-start gap-2 text-sm" style={{ color: 'var(--d-bad-ink)' }}>
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                {error}
              </p>
              <button className="btn-quiet" onClick={load}>
                <RefreshCw size={14} aria-hidden /> Try again
              </button>
            </div>
          )}

          {!error && requests === null && (
            <ul aria-label="Loading requests">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderTop: i ? '1px solid var(--d-panel-edge)' : undefined }}>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 animate-pulse rounded-full" style={{ background: 'var(--d-accent-soft)' }} />
                    <div className="h-3 w-72 max-w-full animate-pulse rounded-full" style={{ background: 'var(--d-accent-soft)' }} />
                  </div>
                  <div className="h-6 w-24 animate-pulse rounded-full" style={{ background: 'var(--d-accent-soft)' }} />
                </li>
              ))}
            </ul>
          )}

          {!error && requests && requests.length === 0 && (
            <p className="px-6 py-14 text-center text-sm" style={{ color: 'var(--d-ink-2)' }}>
              {current.empty}
            </p>
          )}

          {!error && requests && requests.length > 0 && (
            <ul>
              {requests.map((r, i) => (
                <li key={r.id} style={{ borderTop: i ? '1px solid var(--d-panel-edge)' : undefined }}>
                  <button
                    onClick={(e) => {
                      opener.current = e.currentTarget;
                      setOpen(r);
                    }}
                    className="flex w-full flex-col items-start gap-2 px-5 py-4 text-left transition-colors hover:bg-[var(--d-accent-soft)] sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold sm:truncate" style={{ color: 'var(--d-ink)' }}>
                        {r.organizationName}
                      </p>
                      <p className="text-sm sm:truncate" style={{ color: 'var(--d-ink-2)' }}>
                        Wants {r.providerName}
                        {r.requestedBy?.name ? ` · ${r.requestedBy.name}` : ''} · {ago(r.requestedAt)}
                      </p>
                    </div>
                    <StatusChip status={r.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderTop: '1px solid var(--d-panel-edge)' }}>
              <button className="btn-quiet" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={16} aria-hidden /> Previous
              </button>
              <span className="text-sm" style={{ color: 'var(--d-ink-2)' }}>
                Page {page} of {pages}
              </span>
              <button className="btn-quiet" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next <ChevronRight size={16} aria-hidden />
              </button>
            </nav>
          )}
        </div>
      </section>

      {open && (
        <DetailSheet
          key={open.id}
          row={open}
          onClose={() => {
            setOpen(null);
            opener.current?.focus();
          }}
          onChanged={load}
        />
      )}
    </div>
  );
}

function DetailSheet({ row, onClose, onChanged }: { row: ProviderRequest; onClose: () => void; onChanged: () => void }) {
  // The sheet keeps its own copy: after a decision the request leaves the current tab but stays on screen.
  const [req, setReq] = useState(row);
  const [note, setNote] = useState('');
  const [needNote, setNeedNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const decide = async (verb: 'approve' | 'reject' | 'revoke') => {
    const text = note.trim();
    if (verb !== 'approve' && !text) {
      setNeedNote(true);
      noteRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setNeedNote(false);
    try {
      const res =
        verb === 'approve'
          ? await providerRequestsAPI.approve(req.id, text || undefined)
          : verb === 'reject'
            ? await providerRequestsAPI.reject(req.id, text)
            : await providerRequestsAPI.revoke(req.id, text);
      setReq(res.data.data.request);
      setNote('');
      setDone(
        verb === 'approve'
          ? `Approved. ${req.organizationName} can now use ${req.providerName}.`
          : verb === 'reject'
            ? `Rejected. ${req.organizationName} will see your reason on their Providers page.`
            : `Access revoked. ${req.organizationName} can no longer use ${req.providerName}.`,
      );
      onChanged();
    } catch (e: any) {
      if (e?.response?.status === 409 && e?.response?.data?.error?.code === 'INVALID_TRANSITION') {
        // Someone else decided first: show the request as it is now
        try {
          const latest = await providerRequestsAPI.get(req.id);
          setReq(latest.data.data.request);
          setError(`This request is already ${latest.data.data.request.status}, so it cannot be ${verb === 'approve' ? 'approved' : verb === 'reject' ? 'rejected' : 'revoked'}. We have refreshed it.`);
        } catch {
          setError('This request was already decided by someone else. We have refreshed the list.');
        }
        onChanged();
      } else {
        setError(describeApiError(e, 'We could not save your decision.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const status = req.status;
  const canApprove = status === 'pending' || status === 'rejected';
  const canReject = status === 'pending';
  const canRevoke = status === 'approved';
  const hasActions = canApprove || canReject || canRevoke;
  const noteLabel = canRevoke ? 'Reason for revoking' : canReject ? 'Note for the requester' : 'Note for the requester (optional)';

  return (
    <div className="fixed inset-0 z-50 flex justify-end p-3">
      <button aria-label="Close details" className="absolute inset-0 bg-black/15" onClick={onClose} tabIndex={-1} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${req.organizationName} request for ${req.providerName}`}
        className="glass sheet-in relative flex w-full max-w-md flex-col overflow-y-auto p-6"
        style={{ borderRadius: 'var(--d-r-sheet)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
              {req.organizationName}
            </h2>
            <p className="text-sm" style={{ color: 'var(--d-ink-2)' }}>
              Requested {ago(req.requestedAt)}
            </p>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-[var(--d-accent-soft)]" style={{ color: 'var(--d-ink)' }}>
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Mini route: Mock bank is always live; the requested provider lights up on approval. */}
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
              {req.providerName}
              <span className="ml-auto">
                <StatusChip status={status} />
              </span>
            </li>
          </ul>
        </div>

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="font-semibold" style={{ color: 'var(--d-ink)' }}>Requested by</dt>
            <dd style={{ color: 'var(--d-ink-2)' }}>
              {req.requestedBy ? (
                <>
                  {req.requestedBy.name || 'Unnamed user'}
                  {req.requestedBy.email && <span className="block break-all">{req.requestedBy.email}</span>}
                </>
              ) : (
                'Unknown'
              )}
              <span className="block">{when(req.requestedAt)}</span>
            </dd>
          </div>
          <div>
            <dt className="font-semibold" style={{ color: 'var(--d-ink)' }}>Why they need it</dt>
            <dd className="max-w-prose" style={{ color: 'var(--d-ink-2)' }}>
              {req.requestNote || 'They did not say.'}
            </dd>
          </div>
          {req.reviewedAt && (
            <div>
              <dt className="font-semibold" style={{ color: 'var(--d-ink)' }}>
                {status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Revoked'} by
              </dt>
              <dd style={{ color: 'var(--d-ink-2)' }}>
                {req.reviewedBy?.name || req.reviewedBy?.email || 'An admin'} · {when(req.reviewedAt)}
                {req.reviewNote && <span className="mt-1 block" style={{ color: 'var(--d-ink)' }}>&ldquo;{req.reviewNote}&rdquo;</span>}
              </dd>
            </div>
          )}
        </dl>

        <div role="status" aria-live="polite">
          {done && (
            <p
              className="mt-5 flex items-start gap-2 px-4 py-3 text-sm"
              style={{ borderRadius: 'var(--d-r-ctl)', background: 'color-mix(in srgb, var(--d-ok) 14%, transparent)', color: 'var(--d-ok-ink)' }}
            >
              <Check size={16} className="mt-0.5 shrink-0" aria-hidden />
              {done}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-5 flex items-start gap-2 text-sm" style={{ color: 'var(--d-bad-ink)' }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="mt-auto space-y-3 pt-8">
          {hasActions && (
            <>
              <label htmlFor="decision-note" className="block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
                {noteLabel}
              </label>
              <textarea
                id="decision-note"
                ref={noteRef}
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (e.target.value.trim()) setNeedNote(false);
                }}
                aria-invalid={needNote}
                aria-describedby="decision-note-hint"
                className="ctl-input"
                placeholder={canRevoke ? 'They will see this on their Providers page.' : 'Rejecting needs a reason. They will see it on their Providers page.'}
              />
              <p id="decision-note-hint" className="text-xs" style={{ color: needNote ? 'var(--d-bad-ink)' : 'var(--d-ink-2)' }}>
                {needNote
                  ? 'Add a reason so they know what to change.'
                  : canRevoke
                    ? 'A reason is required to revoke access.'
                    : 'Optional when approving, required when rejecting.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {canApprove && (
                  <button className="btn-primary flex-1" disabled={busy} onClick={() => decide('approve')}>
                    <Check size={16} aria-hidden /> {status === 'rejected' ? 'Approve instead' : `Approve ${req.providerName}`}
                  </button>
                )}
                {canReject && (
                  <button className="btn-quiet" disabled={busy} onClick={() => decide('reject')}>
                    Reject
                  </button>
                )}
                {canRevoke && (
                  <button className="btn-quiet flex-1" disabled={busy} onClick={() => decide('revoke')}>
                    Revoke access
                  </button>
                )}
              </div>
            </>
          )}
          {!hasActions && status === 'revoked' && (
            <p className="text-sm" style={{ color: 'var(--d-ink-2)' }}>
              Access was revoked. {req.organizationName} can request it again from their Providers page.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
