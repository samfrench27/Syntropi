'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import { describeFailures, evaluatePassword } from '@repo/password-policy';
import PasswordInput from '@/components/auth/PasswordInput';
import PasswordStrength from '@/components/auth/PasswordStrength';

export default function SignupPage() {
  const [form, setForm] = useState({ firstName: '', lastName: '', companyName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // The same rules the API enforces, shown as the person types
  const policy = evaluatePassword(form.password, { email: form.email, names: [form.firstName, form.lastName] });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy.acceptable) {
      return setError(describeFailures(policy) || 'Choose a stronger password.');
    }
    setLoading(true);
    try {
      await authAPI.signup(form);
      setSentTo(form.email);
    } catch (err: any) {
      const status = err.response?.status;
      setError(
        status === 429
          ? 'Too many signup attempts. Try again in a while.'
          : status === 400
            ? err.response?.data?.error?.message === 'Validation failed'
              ? 'Check the details and try again.'
              : err.response?.data?.error?.message
            : 'We couldn’t create your account. Try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div role="status">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
          Check your email
        </h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--d-ink-2)' }}>
          We’ve sent a link to {sentTo}. Open it to confirm your account, then sign in. You’ll start on the Mock bank.
        </p>
        <Link href="/login" className="text-sm font-medium hover:underline" style={{ color: 'var(--d-accent-ink)' }}>
          Go to sign in
        </Link>
      </div>
    );
  }

  const field = (id: keyof typeof form, label: string, type = 'text', autoComplete?: string) => (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
        {label}
      </label>
      <input id={id} type={type} autoComplete={autoComplete} value={form[id]} onChange={set(id)} className="ctl-input" required />
    </div>
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
        Create your account
      </h1>
      <p className="mb-5 text-sm" style={{ color: 'var(--d-ink-2)' }}>
        You’ll start on the Mock bank, so you can build and test straight away.
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
        <div className="grid grid-cols-2 gap-3">
          {field('firstName', 'First name', 'text', 'given-name')}
          {field('lastName', 'Last name', 'text', 'family-name')}
        </div>
        {field('companyName', 'Company name', 'text', 'organization')}
        {field('email', 'Work email', 'email', 'email')}
        <div className="mb-4">
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
            Password
          </label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            className="ctl-input"
            aria-describedby="password-guidance"
            required
          />
          <PasswordStrength id="password-guidance" password={form.password} email={form.email} names={[form.firstName, form.lastName]} />
        </div>
        <button type="submit" disabled={loading || !policy.acceptable} className="btn-primary mt-1 w-full">
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: 'var(--d-ink-2)' }}>
        Already have an account?{' '}
        <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--d-accent-ink)' }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
