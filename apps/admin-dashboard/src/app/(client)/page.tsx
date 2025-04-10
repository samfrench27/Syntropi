'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoadingState from '@/components/admin/LoadingState';

export default function ClientIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      router.push('/dashboard');
    }
  }, [loading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <LoadingState message="Redirecting to dashboard..." />
    </div>
  );
} 