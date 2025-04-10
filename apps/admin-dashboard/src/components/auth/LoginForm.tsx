// apps/admin-dashboard/src/components/auth/LoginForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

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
      const errorMessage = err.response?.data?.error?.message || 'Login failed. Please check your credentials.';
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
    <div className="mt-8 w-full max-w-md">
      <div className="bg-surface p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-text-primary">Login</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-text-primary font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-syntropi-blue"
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-text-primary font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-syntropi-blue"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-syntropi-gradient text-white py-2 px-4 rounded-md hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-syntropi-purple focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <Link href="/forgot-password" className="text-syntropi-blue hover:text-syntropi-purple transition-colors">
            Forgot your password?
          </Link>
        </div>
      </div>
    </div>
  );
}