// src/app/org-admin/layout.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import Sidebar from '@/components/layout/OrgAdminSidebar';
import RoleBasedRoute from '@/components/auth/RoleBasedRoute';
import LoadingState from '@/components/admin/LoadingState';

export default function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading: authLoading } = useAuth();
  const { loading: orgLoading, error } = useOrganization();
  
  // Show loading state when either auth or organization is loading
  if (authLoading || orgLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <LoadingState message="Loading organization..." />
      </div>
    );
  }
  
  // If there's an organization error, we should still allow access to the dashboard
  // as that component has error handling capabilities
  
  return (
    <RoleBasedRoute allowedRoles={['admin']}>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </RoleBasedRoute>
  );
}