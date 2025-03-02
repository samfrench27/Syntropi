'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        // Check if there's a logged-in user
        if (isAuthenticated()) {
          router.push('/dashboard');
          return;
        }

        // Check if setup has been completed
        await authAPI.checkSetupStatus();
        
        // If the request succeeds, setup is complete but user is not logged in
        router.push('/login');
      } catch (err: any) {
        // If API returns 404 with specific message, setup is needed
        if (err.response?.status === 404 && 
            err.response?.data?.error?.message === 'Super admin not found') {
          router.push('/setup');
        } else {
          // Some other error, default to login page
          console.error('Error checking setup status:', err);
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    checkSetupStatus();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return null; // This component just handles redirection
}