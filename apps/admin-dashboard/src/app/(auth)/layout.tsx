// src/app/(auth)/layout.tsx
import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p
          className="mb-6 text-center text-4xl font-semibold tracking-tight"
          style={{ color: 'var(--d-ink)' }}
        >
          Syntropi
        </p>
        <div
          className="glass auth-card p-8 sm:p-10"
          style={{ borderRadius: 'var(--d-r-sheet)' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
