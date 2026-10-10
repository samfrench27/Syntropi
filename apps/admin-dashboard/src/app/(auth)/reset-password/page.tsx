'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '@/lib/supabase';
import { homeFor, useAuth } from '@/contexts/AuthContext';

type Phase = 'checking' | 'ready' | 'expired';

/**
 * Landing page for the links in password reset and invite emails. Supabase puts a session in
 * the URL; once it is picked up the person can choose a password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let settled = false;
    const ready = () => {
      settled = true;
      setPhase('ready');
    };

    const { data: listener } = supabaseAuth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') ready();
    });
    supabaseAuth.getSession().then(({ data }) => {
      if (data.session) ready();
    });
    // No session after a moment means the link was used already or has expired
    const timer = setTimeout(() => !settled && setPhase('expired'), 4000);

    return () => {
      clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError('The two passwords don’t match.');
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      return setError('Use at least 8 characters, with a lowercase letter, an uppercase letter and a number.');
    }

    setSaving(true);
    const { error: updateError } = await supabaseAuth.updateUser({ password });
    if (updateError) {
      setSaving(false);
      return setError(updateError.message);
    }
    const profile = await refreshUser().catch(() => undefined);
    router.push(profile ? homeFor(profile.role) : '/login');
  };

  if (phase === 'checking') {
    return (
      <p role="status" className="py-6 text-center text-sm" style={{ color: 'var(--d-ink-2)' }}>
        Checking your link...
      </p>
    );
  }

  if (phase === 'expired') {
    return (
      <div role="alert">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
          This link has expired
        </h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--d-ink-2)' }}>
          Reset links work once and stop working after an hour. Request a new one.
        </p>
        <Link href="/forgot-password" className="btn-primary w-full">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
        Choose a password
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--d-ink-2)' }}>
        At least 8 characters, with upper and lower case letters and a number.
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
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
          New password
        </label>
        <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="ctl-input mb-4" required />
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
          Confirm password
        </label>
        <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="ctl-input mb-5" required />
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving...' : 'Save password'}
        </button>
      </form>
    </div>
  );
}
