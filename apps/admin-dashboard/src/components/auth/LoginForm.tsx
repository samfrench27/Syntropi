// apps/admin-dashboard/src/components/auth/LoginForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import PasswordInput from '@/components/auth/PasswordInput';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // On component mount, check for error in session storage
  useEffect(() => {
    const storedError = sessionStorage.getItem('loginError');
    if (storedError) {
      setError(storedError);
      // Clear the error from session storage after retrieving it
      sessionStorage.removeItem('loginError');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    sessionStorage.removeItem('loginError'); // Clear any previous error

    try {
      await login(email, password);
      // Successful login is handled by the login function (redirect to dashboard)
    } catch (err: any) {
      const errorMessage = err?.message || 'Sign in failed. Check your email and password.';
      // Store error in session storage to persist across potential reloads
      sessionStorage.setItem('loginError', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Clear error when user starts typing again
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) {
      setError(null);
      sessionStorage.removeItem('loginError');
    }

    const { name, value } = e.target;
    if (name === 'email') setEmail(value);
    if (name === 'password') setPassword(value);
  };

  return (
    <div className="w-full">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
        Sign in
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--d-ink-2)' }}>
        Use your Syntropi account to continue.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 px-4 py-3 text-sm"
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
        <div className="mb-4">
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={handleInputChange}
            className="ctl-input"
            required
          />
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
            Password
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={handleInputChange}
            className="ctl-input"
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="font-medium hover:underline" style={{ color: 'var(--d-accent-ink)' }}>
          Forgot password?
        </Link>
        <Link href="/signup" className="font-medium hover:underline" style={{ color: 'var(--d-accent-ink)' }}>
          Create an account
        </Link>
      </div>
    </div>
  );
}
