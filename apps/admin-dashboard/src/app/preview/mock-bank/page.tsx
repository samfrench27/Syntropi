'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FlaskConical, XCircle } from 'lucide-react';

type Step = 'login' | 'consent' | 'approved' | 'rejected';

/**
 * Preview of the hosted Mock bank (planned for bank.syntropi.co.uk): dummy login, payment request,
 * approve or reject. Static fixture data, no network calls.
 */
export default function MockBankPreviewPage() {
  const [step, setStep] = useState<Step>('login');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2" style={{ color: 'var(--d-ink)' }}>
          <FlaskConical size={22} aria-hidden />
          <p className="text-2xl font-semibold tracking-tight">Mock bank</p>
        </div>

        <div className="glass p-8" style={{ borderRadius: 'var(--d-r-sheet)' }}>
          <p
            className="mb-5 px-3 py-2 text-center text-xs"
            style={{ borderRadius: 'var(--d-r-ctl)', background: 'var(--d-accent-soft)', color: 'var(--d-ink)' }}
          >
            Practice bank. No real money moves.
          </p>

          {step === 'login' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep('consent');
              }}
            >
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
                Log in to your bank
              </h1>
              <p className="mb-5 mt-1 text-sm" style={{ color: 'var(--d-ink-2)' }}>
                Use the test details below.
              </p>
              <div className="mb-4">
                <label htmlFor="mb-user" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
                  Customer ID
                </label>
                <input id="mb-user" className="ctl-input mono" defaultValue="demo-customer" />
              </div>
              <div className="mb-5">
                <label htmlFor="mb-pass" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
                  Passcode
                </label>
                <input id="mb-pass" type="password" className="ctl-input mono" defaultValue="123456" />
              </div>
              <button type="submit" className="btn-primary w-full">
                Log in
              </button>
            </form>
          )}

          {step === 'consent' && (
            <div>
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
                Approve this payment?
              </h1>
              <dl className="panel mt-5 divide-y text-sm" style={{ ['--tw-divide-opacity' as string]: 1 }}>
                {[
                  ['Pay to', 'Acme Coffee Roasters'],
                  ['Reference', 'ORDER-10482'],
                  ['From', 'Mock current account'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between px-4 py-3" style={{ borderColor: 'var(--d-panel-edge)' }}>
                    <dt style={{ color: 'var(--d-ink-2)' }}>{k}</dt>
                    <dd className="font-medium" style={{ color: 'var(--d-ink)' }}>
                      {v}
                    </dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between px-4 py-4">
                  <dt style={{ color: 'var(--d-ink-2)' }}>Amount</dt>
                  <dd className="mono text-2xl font-semibold" style={{ color: 'var(--d-ink)' }}>
                    £42.50
                  </dd>
                </div>
              </dl>
              <div className="mt-5 flex gap-2">
                <button className="btn-primary flex-1" onClick={() => setStep('approved')}>
                  Approve payment
                </button>
                <button className="btn-quiet" onClick={() => setStep('rejected')}>
                  Reject
                </button>
              </div>
            </div>
          )}

          {(step === 'approved' || step === 'rejected') && (
            <div role="status" className="py-4 text-center">
              {step === 'approved' ? (
                <CheckCircle2 size={44} className="mx-auto" style={{ color: 'var(--d-ok)' }} aria-hidden />
              ) : (
                <XCircle size={44} className="mx-auto" style={{ color: 'var(--d-bad)' }} aria-hidden />
              )}
              <h1 className="mt-3 text-xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
                {step === 'approved' ? 'Payment approved' : 'Payment rejected'}
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--d-ink-2)' }}>
                You&apos;d be sent back to the merchant now.
              </p>
              <button className="btn-quiet mt-5" onClick={() => setStep('login')}>
                Start again
              </button>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-sm" style={{ color: 'var(--d-ink-2)' }}>
          <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--d-accent-ink)' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
