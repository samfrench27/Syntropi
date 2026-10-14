'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, CheckCircle2, FlaskConical, Landmark, RefreshCw, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { clientProvidersAPI, describeApiError, type AccessStatus, type ClientProvider } from '@/lib/api';
import StatusChip from './StatusChip';

const HEAD_H = 96;
const TRUNK_X = 20;
const NOTE_MAX = 1000;

const ago = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : formatDistanceToNow(d, { addSuffix: true });
};

/** The curve from the account trunk out to one provider. The trunk itself is drawn by the row. */
function Branch({ status }: { status: AccessStatus }) {
  const mid = HEAD_H / 2;
  const live = status === 'approved';
  const pending = status === 'pending';
  return (
    <svg width="132" height={HEAD_H} viewBox={`0 0 132 ${HEAD_H}`} className="absolute left-0 top-0" aria-hidden>
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
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const orgName = currentOrganization?.name || 'Your organization';
  // The API only lets organization admins ask on the organization's behalf
  const canRequest = user?.role === 'admin' || user?.role === 'superadmin';

  const [providers, setProviders] = useState<ClientProvider[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [formFor, setFormFor] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ code: string; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    try {
      const res = await clientProvidersAPI.list();
      setProviders(res.data.data.providers);
      setLoadError(null);
    } catch (e) {
      setLoadError(describeApiError(e, 'We could not load your providers.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (code: string, note: string) => {
    setSending(code);
    setRowError(null);
    setNotice(null);
    try {
      const res = await clientProvidersAPI.request(code, note.trim() || undefined);
      const updated = res.data.data.provider;
      setProviders((list) => list?.map((p) => (p.code === code ? updated : p)) ?? list);
      setFormFor(null);
      setNotice(`Request sent for ${updated.name}. A Syntropi admin will review it.`);
    } catch (e: any) {
      const status = e?.response?.status;
      const apiCode = e?.response?.data?.error?.code;
      if (status === 403) {
        setRowError({ code, message: `Only organization admins can request access. Ask an admin in ${orgName} to do it.` });
      } else if (status === 409 || apiCode === 'ALREADY_APPROVED') {
        setRowError({ code, message: 'This provider is already approved. We have refreshed the list.' });
        setFormFor(null);
        load(true);
      } else {
        setRowError({ code, message: describeApiError(e, 'We could not send the request.') });
      }
    } finally {
      setSending(null);
    }
  };

  const others = providers?.filter((p) => !p.alwaysOn) ?? [];
  const alwaysOn = providers?.find((p) => p.alwaysOn);

  return (
    <div className="max-w-4xl space-y-5 p-6">
      <section className="panel p-6" aria-busy={providers === null && !loadError}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--d-ink)' }}>
              Where your payments can go
            </h2>
            <p className="mt-1 max-w-prose text-sm" style={{ color: 'var(--d-ink-2)' }}>
              {intro}
            </p>
          </div>
          {providers && (
            <button className="btn-quiet shrink-0" onClick={() => load(true)} disabled={refreshing} aria-label="Refresh providers">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden /> <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>

        {!canRequest && providers && (
          <p
            className="mt-4 flex items-start gap-2 px-4 py-3 text-sm"
            style={{ borderRadius: 'var(--d-r-ctl)', background: 'var(--d-accent-soft)', color: 'var(--d-ink)' }}
          >
            <Landmark size={16} className="mt-0.5 shrink-0" aria-hidden />
            Only organization admins can request a provider. If you need one, ask an admin in {orgName}.
          </p>
        )}

        <div role="status" aria-live="polite">
          {notice && (
            <p
              className="mt-4 flex items-start gap-2 px-4 py-3 text-sm"
              style={{ borderRadius: 'var(--d-r-ctl)', background: 'color-mix(in srgb, var(--d-ok) 14%, transparent)', color: 'var(--d-ok-ink)' }}
            >
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
              {notice}
            </p>
          )}
        </div>

        {providers === null && !loadError && <Skeleton />}

        {loadError && (
          <div className="mt-6 flex flex-col items-start gap-3" role="alert">
            <p className="flex items-start gap-2 text-sm" style={{ color: 'var(--d-bad-ink)' }}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
              {loadError}
            </p>
            <button className="btn-quiet" onClick={() => load(true)}>
              <RefreshCw size={14} aria-hidden /> Try again
            </button>
          </div>
        )}

        {providers && (
          <div className="mt-6">
            {/* Origin: the account */}
            <div className="flex items-center gap-4">
              <div className="relative hidden h-10 w-[132px] shrink-0 sm:block" aria-hidden>
                <span className="absolute bottom-0 w-[3px] rounded-full" style={{ left: TRUNK_X - 1.5, top: 20, background: 'var(--d-accent)' }} />
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

            <ul>
              {alwaysOn && (
                <ProviderRow
                  key={alwaysOn.code}
                  provider={alwaysOn}
                  last={others.length === 0}
                  icon={<FlaskConical size={18} aria-hidden />}
                  chip={
                    <span className="chip" data-tone="ok">
                      <CheckCircle2 size={13} aria-hidden />
                      Always on
                    </span>
                  }
                />
              )}
              {others.map((p, i) => (
                <ProviderRow
                  key={p.code}
                  provider={p}
                  last={i === others.length - 1}
                  chip={<StatusChip status={p.accessStatus} />}
                  canRequest={canRequest}
                  formOpen={formFor === p.code}
                  sending={sending === p.code}
                  error={rowError?.code === p.code ? rowError.message : null}
                  onOpenForm={() => {
                    setFormFor(p.code);
                    setRowError(null);
                    setNotice(null);
                  }}
                  onCloseForm={() => setFormFor(null)}
                  onSubmit={(note) => submit(p.code, note)}
                />
              ))}
            </ul>
            {others.length === 0 && (
              <p className="py-6 text-sm" style={{ color: 'var(--d-ink-2)' }}>
                No other providers are available yet. When Syntropi adds one, it will appear here.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-6 space-y-3" aria-label="Loading providers">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4" style={{ height: HEAD_H }}>
          <div className="hidden h-3 w-[132px] shrink-0 rounded-full sm:block" style={{ background: 'var(--d-accent-soft)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded-full" style={{ background: 'var(--d-accent-soft)' }} />
            <div className="h-3 w-64 max-w-full animate-pulse rounded-full" style={{ background: 'var(--d-accent-soft)' }} />
          </div>
          <div className="h-6 w-28 animate-pulse rounded-full" style={{ background: 'var(--d-accent-soft)' }} />
        </div>
      ))}
    </div>
  );
}

interface RowProps {
  provider: ClientProvider;
  last: boolean;
  chip: React.ReactNode;
  icon?: React.ReactNode;
  canRequest?: boolean;
  formOpen?: boolean;
  sending?: boolean;
  error?: string | null;
  onOpenForm?: () => void;
  onCloseForm?: () => void;
  onSubmit?: (note: string) => void;
}

function ProviderRow({ provider: p, last, chip, icon, canRequest, formOpen, sending, error, onOpenForm, onCloseForm, onSubmit }: RowProps) {
  const [note, setNote] = useState('');
  const status = p.accessStatus;
  const askable = !p.alwaysOn && (status === 'none' || status === 'rejected' || status === 'revoked');
  const inputId = `request-note-${p.code}`;

  return (
    <li className="flex gap-4">
      {/* The trunk runs the full height of the row; it stops at the last branch. */}
      <div className="relative hidden w-[132px] shrink-0 sm:block" aria-hidden>
        <span
          className="absolute w-[3px] rounded-full"
          style={{ left: TRUNK_X - 1.5, top: 0, bottom: last ? undefined : 0, height: last ? HEAD_H / 2 - 14 : undefined, background: 'var(--d-accent)' }}
        />
        <Branch status={status} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 sm:py-0" style={{ minHeight: HEAD_H }}>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold" style={{ color: 'var(--d-ink)' }}>
              {icon}
              {p.name}
              {p.status === 'maintenance' && (
                <span className="chip" data-tone="warn">
                  <Wrench size={12} aria-hidden /> Under maintenance
                </span>
              )}
            </p>
            <p className="text-sm" style={{ color: 'var(--d-ink-2)' }}>
              {p.description}
            </p>
          </div>
          {chip}
          {askable && canRequest && !formOpen && (
            <button className="btn-primary" onClick={onOpenForm} aria-label={`${status === 'none' ? 'Request access to' : 'Request again for'} ${p.name}`}>
              {status === 'none' ? 'Request access' : 'Request again'}
            </button>
          )}
        </div>

        {/* Context for where this request stands */}
        {status === 'pending' && (
          <p className="pb-4 text-sm" style={{ color: 'var(--d-ink-2)' }}>
            Requested {ago(p.requestedAt)}. A Syntropi admin is reviewing it.
            {p.requestNote ? <> Your note: &ldquo;{p.requestNote}&rdquo;</> : null}
          </p>
        )}
        {(status === 'rejected' || status === 'revoked') && (
          <div
            className="mb-4 px-4 py-3 text-sm"
            style={{ borderRadius: 'var(--d-r-ctl)', background: 'color-mix(in srgb, var(--d-bad) 10%, transparent)', color: 'var(--d-ink)' }}
          >
            <p className="font-semibold" style={{ color: 'var(--d-bad-ink)' }}>
              {status === 'rejected' ? 'Request rejected' : 'Access revoked'}
              {p.reviewedAt ? <span className="font-normal"> {ago(p.reviewedAt)}</span> : null}
            </p>
            <p className="mt-1">{p.reviewNote ? <>&ldquo;{p.reviewNote}&rdquo;</> : 'No reason was given.'}</p>
            {!canRequest && <p className="mt-1" style={{ color: 'var(--d-ink-2)' }}>An organization admin can request it again.</p>}
          </div>
        )}
        {status === 'approved' && !p.alwaysOn && p.reviewedAt && (
          <p className="pb-4 text-sm" style={{ color: 'var(--d-ink-2)' }}>
            Approved {ago(p.reviewedAt)}.
          </p>
        )}

        {formOpen && (
          <form
            className="pop-in mb-4 space-y-3 p-4"
            style={{ borderRadius: 'var(--d-r-ctl)', background: 'var(--d-accent-soft)' }}
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit?.(note);
            }}
          >
            <label htmlFor={inputId} className="block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
              What will you use {p.name} for? <span style={{ color: 'var(--d-ink-2)' }}>(optional)</span>
            </label>
            <textarea
              id={inputId}
              rows={3}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="ctl-input"
              placeholder="For example: pay-by-bank at checkout, about 2,000 payments a month."
              autoFocus
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={sending}>
                {sending ? 'Sending...' : 'Send request'}
              </button>
              <button type="button" className="btn-quiet" onClick={onCloseForm} disabled={sending}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="mb-4 flex items-start gap-2 text-sm" style={{ color: 'var(--d-bad-ink)' }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
