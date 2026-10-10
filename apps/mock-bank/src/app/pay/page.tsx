'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Info, Loader2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { fetchPayment, sendDecision, type Decision, type FailKind, type PaymentView } from '@/lib/api';
import { formatCountdown, formatMoney, parsePaymentId, readToken, safeRedirectUrl, scrubbedUrl, secondsLeft } from '@/lib/helpers.mjs';

type ErrorKind = FailKind | 'missing-token' | 'missing-id';
type Outcome = { approved: boolean; redirectUrl: string | null; earlier: boolean };

type View =
  | { step: 'loading' }
  | { step: 'error'; kind: ErrorKind }
  | { step: 'login'; payment: PaymentView }
  | { step: 'request'; payment: PaymentView }
  | { step: 'result'; payment: PaymentView; outcome: Outcome };

const ERRORS: Record<ErrorKind, { title: string; text: string; retry?: boolean }> = {
  'missing-token': { title: 'Security token missing', text: 'This link is missing its security token. Go back to the merchant and try again.' },
  'missing-id': { title: 'Payment link incomplete', text: 'This link does not say which payment it is for. Go back to the merchant and try again.' },
  'invalid-token': { title: 'This link is not valid', text: 'This payment link is not valid, or it belongs to a different payment. Go back to the merchant and start the payment again.' },
  expired: { title: 'This payment has expired', text: 'The time to approve this payment has run out. Go back to the merchant and start a new payment.' },
  'not-found': { title: 'Payment not found', text: 'We could not find this payment, or it was not made with the Mock bank. Go back to the merchant and try again.' },
  'already-decided': { title: 'Already decided', text: 'This payment has already been decided. Go back to the merchant to see what happened.' },
  network: { title: 'Cannot reach the Mock bank', text: 'We could not connect. Check your internet connection and try again.', retry: true },
  server: { title: 'Something went wrong', text: 'The Mock bank had a problem. Please try again in a moment.', retry: true },
};

function outcomeFromStatus(status: string): Outcome | null {
  if (status === 'COMPLETED') return { approved: true, redirectUrl: null, earlier: true };
  if (status === 'FAILED') return { approved: false, redirectUrl: null, earlier: true };
  return null;
}
const isPending = (status: string) => status === 'AUTHORIZING' || status === 'AUTHORIZED';

export default function PayPage() {
  const [view, setView] = useState<View>({ step: 'loading' });
  // The token lives only in memory. It is read once from the address bar, then removed from it.
  const token = useRef<string | null>(null);
  const paymentId = useRef<string | null>(null);
  const started = useRef(false);

  const load = useCallback(async () => {
    if (!paymentId.current) return setView({ step: 'error', kind: 'missing-id' });
    if (!token.current) return setView({ step: 'error', kind: 'missing-token' });
    setView({ step: 'loading' });
    const res = await fetchPayment(paymentId.current, token.current);
    if (!res.ok) return setView({ step: 'error', kind: res.kind });
    const payment = res.data;
    if (isPending(payment.status)) return setView({ step: 'login', payment });
    const earlier = outcomeFromStatus(payment.status);
    if (earlier) return setView({ step: 'result', payment, outcome: earlier });
    setView({ step: 'error', kind: 'already-decided' });
  }, []);

  useEffect(() => {
    // Strict Mode runs effects twice in development; the token is only in the address bar the first time.
    if (started.current) return;
    started.current = true;
    const { pathname, search, hash } = window.location;
    paymentId.current = parsePaymentId(pathname, search);
    token.current = readToken(search);
    try {
      window.history.replaceState(window.history.state, '', scrubbedUrl(pathname, search, hash));
    } catch {
      /* some embedded browsers block this: the token is still never stored */
    }
    void load();
  }, [load]);

  const decide = useCallback(async (payment: PaymentView, decision: Decision): Promise<'network' | 'server' | null> => {
    if (!paymentId.current || !token.current) {
      setView({ step: 'error', kind: 'missing-token' });
      return null;
    }
    const res = await sendDecision(paymentId.current, token.current, decision);
    if (res.ok) {
      const approved = res.data.status === 'COMPLETED';
      setView({ step: 'result', payment, outcome: { approved, redirectUrl: safeRedirectUrl(res.data.redirectUrl), earlier: false } });
      return null;
    }
    if (res.kind === 'network' || res.kind === 'server') return res.kind;
    if (res.kind === 'already-decided') {
      // Someone (or another tab) decided first: show what happened.
      const now = await fetchPayment(paymentId.current, token.current);
      const earlier = now.ok ? outcomeFromStatus(now.data.status) : null;
      if (now.ok && earlier) setView({ step: 'result', payment: now.data, outcome: earlier });
      else setView({ step: 'error', kind: 'already-decided' });
      return null;
    }
    setView({ step: 'error', kind: res.kind });
    return null;
  }, []);

  const busy = view.step === 'loading';

  return (
    <Shell busy={busy}>
      {view.step === 'loading' && <Loading />}
      {view.step === 'error' && <ErrorPanel kind={view.kind} onRetry={load} />}
      {view.step === 'login' && <LoginStep onContinue={() => setView({ step: 'request', payment: view.payment })} />}
      {view.step === 'request' && <RequestStep payment={view.payment} onDecide={(d) => decide(view.payment, d)} onExpired={() => setView({ step: 'error', kind: 'expired' })} />}
      {view.step === 'result' && <ResultStep payment={view.payment} outcome={view.outcome} />}
    </Shell>
  );
}

const ink = { color: 'var(--d-ink)' } as const;
const ink2 = { color: 'var(--d-ink-2)' } as const;

function Loading() {
  return (
    <div role="status" className="py-8 text-center">
      <Loader2 size={32} className="mx-auto animate-spin" style={{ color: 'var(--d-accent-ink)' }} aria-hidden />
      <p className="mt-3 text-sm" style={ink2}>Loading your payment...</p>
    </div>
  );
}

function ErrorPanel({ kind, onRetry }: { kind: ErrorKind; onRetry: () => void }) {
  const e = ERRORS[kind];
  const Icon = kind === 'expired' ? Clock : kind === 'invalid-token' || kind === 'missing-token' ? ShieldAlert : AlertTriangle;
  return (
    <div role="alert" className="py-2 text-center">
      <Icon size={40} className="mx-auto" style={{ color: 'var(--d-warn-ink)' }} aria-hidden />
      <h1 className="mt-3 text-xl font-semibold tracking-tight" style={ink}>{e.title}</h1>
      <p className="mt-1 text-sm" style={ink2}>{e.text}</p>
      {e.retry && (
        <button className="btn-primary mt-5" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

function LoginStep({ onContinue }: { onContinue: () => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onContinue();
      }}
    >
      <h1 className="text-xl font-semibold tracking-tight" style={ink}>Log in to your bank</h1>
      <p className="mb-4 mt-1 text-sm" style={ink2}>Use the test details below. Any details will work.</p>
      <div className="panel mb-4 flex gap-2.5 px-4 py-3 text-sm" style={ink}>
        <Info size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--d-accent-ink)' }} aria-hidden />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt style={ink2}>Customer ID</dt>
          <dd className="mono font-medium">demo-customer</dd>
          <dt style={ink2}>Passcode</dt>
          <dd className="mono font-medium">123456</dd>
        </dl>
      </div>
      <div className="mb-4">
        <label htmlFor="mb-user" className="mb-1.5 block text-sm font-medium" style={ink}>Customer ID</label>
        <input id="mb-user" name="customer" className="ctl-input mono" defaultValue="demo-customer" autoComplete="off" spellCheck={false} />
      </div>
      <div className="mb-5">
        <label htmlFor="mb-pass" className="mb-1.5 block text-sm font-medium" style={ink}>Passcode</label>
        <input id="mb-pass" name="passcode" type="password" className="ctl-input mono" defaultValue="123456" autoComplete="off" />
      </div>
      <button type="submit" className="btn-primary w-full">Log in</button>
    </form>
  );
}

function RequestStep({ payment, onDecide, onExpired }: { payment: PaymentView; onDecide: (d: Decision) => Promise<'network' | 'server' | null>; onExpired: () => void }) {
  const [pending, setPending] = useState<Decision | null>(null);
  const [problem, setProblem] = useState<'network' | 'server' | null>(null);
  const lock = useRef(false);
  const [left, setLeft] = useState<number | null>(() => secondsLeft(payment.expiresAt, Date.now()));

  useEffect(() => {
    const tick = () => setLeft(secondsLeft(payment.expiresAt, Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [payment.expiresAt]);
  useEffect(() => {
    if (left === 0) onExpired();
  }, [left, onExpired]);

  const act = async (d: Decision) => {
    if (lock.current) return; // double-click protection: a second click does nothing
    lock.current = true;
    setPending(d);
    setProblem(null);
    const failed = await onDecide(d);
    if (failed) {
      setProblem(failed);
      setPending(null);
      lock.current = false;
    }
  };

  const merchant = payment.merchant?.name || payment.organizationName;
  const rows: [string, string][] = [
    ['Pay to', merchant],
    ...(payment.reference ? ([['Reference', payment.reference]] as [string, string][]) : []),
    ['From', 'Mock current account'],
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight" style={ink}>Approve this payment?</h1>
      <dl className="panel mt-5 divide-y text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3" style={{ borderColor: 'var(--d-panel-edge)' }}>
            <dt style={ink2}>{k}</dt>
            <dd className="min-w-0 break-words text-right font-medium" style={ink}>{v}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 px-4 py-4" style={{ borderColor: 'var(--d-panel-edge)' }}>
          <dt style={ink2}>Amount</dt>
          <dd className="mono text-2xl font-semibold" style={ink} data-testid="amount">{formatMoney(payment.amount.value, payment.amount.currency)}</dd>
        </div>
      </dl>
      {left !== null && (
        <p className="mt-3 flex items-center gap-1.5 text-sm" style={ink2}>
          <Clock size={14} aria-hidden /> Time left to approve: <span className="mono font-medium" style={ink}>{formatCountdown(left)}</span>
        </p>
      )}
      {problem && (
        <p role="alert" className="mt-4 flex gap-2 text-sm" style={{ color: 'var(--d-bad-ink)' }}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {problem === 'network' ? 'We could not reach the Mock bank. Check your connection and try again.' : 'The Mock bank had a problem. Please try again.'}
        </p>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button className="btn-primary sm:flex-1" disabled={pending !== null} aria-busy={pending === 'approve'} onClick={() => act('approve')}>
          {pending === 'approve' && <Loader2 size={16} className="animate-spin" aria-hidden />}
          {pending === 'approve' ? 'Approving...' : 'Approve payment'}
        </button>
        <button className="btn-quiet" disabled={pending !== null} aria-busy={pending === 'reject'} onClick={() => act('reject')}>
          {pending === 'reject' && <Loader2 size={16} className="animate-spin" aria-hidden />}
          {pending === 'reject' ? 'Rejecting...' : 'Reject'}
        </button>
      </div>
    </div>
  );
}

function ResultStep({ payment, outcome }: { payment: PaymentView; outcome: Outcome }) {
  const { approved, redirectUrl, earlier } = outcome;
  const [secs, setSecs] = useState(2);

  useEffect(() => {
    if (!redirectUrl) return;
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [redirectUrl]);
  useEffect(() => {
    if (redirectUrl && secs === 0) window.location.assign(redirectUrl);
  }, [redirectUrl, secs]);

  const merchant = payment.merchant?.name || payment.organizationName;
  return (
    <div role="status" className="py-2 text-center">
      {approved ? (
        <CheckCircle2 size={44} className="mx-auto" style={{ color: 'var(--d-ok)' }} aria-hidden />
      ) : (
        <XCircle size={44} className="mx-auto" style={{ color: 'var(--d-bad)' }} aria-hidden />
      )}
      <h1 className="mt-3 text-xl font-semibold tracking-tight" style={ink}>{approved ? 'Payment approved' : 'Payment rejected'}</h1>
      <p className="mt-1 text-sm" style={ink2}>
        {earlier ? 'This payment was already decided. ' : ''}
        {approved
          ? `${formatMoney(payment.amount.value, payment.amount.currency)} to ${merchant} was approved. No real money moved.`
          : `The payment to ${merchant} was rejected. No money moved.`}
      </p>
      {redirectUrl && (
        <div className="mt-5">
          <p className="text-sm" style={ink2}>Taking you back to the merchant in {secs}...</p>
          <a href={redirectUrl} rel="noreferrer noopener" className="btn-quiet mt-3">Return to merchant now</a>
        </div>
      )}
      {!redirectUrl && <p className="mt-5 text-sm" style={ink2}>You can close this page and go back to the merchant.</p>}
    </div>
  );
}
