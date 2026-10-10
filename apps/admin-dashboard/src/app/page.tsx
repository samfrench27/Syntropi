'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, homeFor } from '@/contexts/AuthContext';

/** Sends people to their home screen, or to sign in. */
export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? homeFor(user.role) : '/login');
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2" style={{ borderColor: 'var(--d-accent)' }} />
    </div>
  );
}
