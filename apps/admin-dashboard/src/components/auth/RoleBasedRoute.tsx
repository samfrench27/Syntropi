// src/components/auth/RoleBasedRoute.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type RoleType = 'superadmin' | 'admin' | 'user';

interface RoleBasedRouteProps {
  allowedRoles: RoleType[];
  children: React.ReactNode;
  redirectPath?: string;
}

export default function RoleBasedRoute({ 
  allowedRoles, 
  children, 
  redirectPath = '/login'
}: RoleBasedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const hasRequiredRole = allowedRoles.includes(user.role as RoleType);
    if (!hasRequiredRole) {
      // Redirect based on role
      if (user.role === 'superadmin') {
        router.push('/dashboard');
      } else if (user.role === 'admin') {
        router.push('/org/dashboard');  
      } else {
        router.push('/client/dashboard');
      }
    }
  }, [user, loading, router, allowedRoles, redirectPath]);

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const hasRequiredRole = allowedRoles.includes(user.role as RoleType);
  return hasRequiredRole ? <>{children}</> : null;
}