'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { supabaseAuth } from '@/lib/supabase';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabaseAuth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    // The same message either way, so this can't be used to find out who has an account
    if (resetError && /rate limit|too many/i.test(resetError.message)) {
      setError('Too many requests. Wait a few minutes and try again.');
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div role="status">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
          Check your email
        </h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--d-ink-2)' }}>
          If an account exists for {email}, we’ve sent a link to reset your password.
        </p>
        <Link href="/login" className="text-sm font-medium hover:underline" style={{ color: 'var(--d-accent-ink)' }}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
        Reset your password
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--d-ink-2)' }}>
        Enter your email and we’ll send you a link to choose a new one.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 px-4 py-3 text-sm"
          style={{
            borderRadius: 'var(--d-r-ctl)',
            background: 'color-mix(in srgb, var(--d-bad) 14%, transparent)',
            color: 'var(--d-bad-ink)',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
          Email
        </label>
        <input
          type="email"
          id="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="ctl-input mb-5"
          required
        />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <div className="mt-5 text-sm">
        <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--d-accent-ink)' }}>
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
