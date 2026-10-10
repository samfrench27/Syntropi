'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';

/** Static look-and-feel preview. Submitting does nothing until signup exists in the API. */
export default function SignupPreviewPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-4xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
          Syntropi
        </p>
        <div className="glass p-8 sm:p-10" style={{ borderRadius: 'var(--d-r-sheet)' }}>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
            Create your account
          </h1>
          <p className="mb-5 text-sm" style={{ color: 'var(--d-ink-2)' }}>
            You&apos;ll start on the Mock bank, so you can build and test straight away.
          </p>

          <div
            className="mb-5 flex items-start gap-2 px-3 py-2.5 text-xs"
            style={{ borderRadius: 'var(--d-r-ctl)', background: 'var(--d-accent-soft)', color: 'var(--d-ink)' }}
          >
            <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
            Preview only. Nothing is saved yet.
          </div>

          {sent ? (
            <div role="status" className="py-4 text-center">
              <p className="font-semibold" style={{ color: 'var(--d-ink)' }}>
                That&apos;s how signup will look.
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--d-ink-2)' }}>
                Real accounts arrive with the backend work.
              </p>
              <button className="btn-quiet mt-4" onClick={() => setSent(false)}>
                Back to the form
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
            >
              {[
                ['company', 'Company name', 'text', 'organization'],
                ['email', 'Work email', 'email', 'email'],
                ['password', 'Password', 'password', 'new-password'],
              ].map(([id, label, type, ac]) => (
                <div className="mb-4" key={id}>
                  <label htmlFor={id} className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
                    {label}
                  </label>
                  <input id={id} type={type} autoComplete={ac} required className="ctl-input" />
                </div>
              ))}
              <button type="submit" className="btn-primary mt-2 w-full">
                Create account
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-sm" style={{ color: 'var(--d-ink-2)' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--d-accent-ink)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
