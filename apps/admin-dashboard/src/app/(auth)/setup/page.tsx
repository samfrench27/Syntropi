'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FirstAdminSetupForm from '@/components/auth/FirstAdminSetupForm';
import { authAPI } from '@/lib/api';

export default function SetupPage() {
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        // Check if setup has been completed
        await authAPI.checkSetupStatus();
        
        // If request succeeds, setup is complete, redirect to login
        router.push('/login');
      } catch (err: any) {
        // If API returns 404 with specific message, setup is needed
        if (err.response?.status === 404 && 
            err.response?.data?.error?.message === 'Super admin not found') {
          setSetupNeeded(true);
        } else {
          // Some other error
          setError('Failed to check setup status. Please try again.');
          console.error('Error:', err);
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

  if (error) {
    return (
      <div className="mt-8 w-full max-w-md mx-auto">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return setupNeeded ? <FirstAdminSetupForm /> : null;
}