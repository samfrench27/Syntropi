// src/app/org-admin/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import Sidebar from '@/components/layout/OrgAdminSidebar';
import RoleBasedRoute from '@/components/auth/RoleBasedRoute';
import LoadingState from '@/components/admin/LoadingState';
import { debugLog } from '@/lib/debug';

export default function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { currentOrganization, loading: orgLoading, error: orgError, refreshOrganization } = useOrganization();
  
  // Ensure organization context is available across all org-admin pages
  useEffect(() => {
    // Skip if still loading auth or already loading organization
    if (authLoading || orgLoading) return;
    
    // If no organization and we're not already loading one, try to refresh
    if (!currentOrganization && !orgLoading && !orgError) {
      debugLog('OrgAdminLayout', 'No organization found, refreshing', {});
      refreshOrganization();
    }
    
    // Log organization context on page changes
    if (user) {
      debugLog('OrgAdminLayout', 'User info for organization context:', {
        userId: user.id,
        orgId: user.organizationId,
        hasOrgObject: !!user.organization,
        currentOrg: currentOrganization ? currentOrganization.name : 'None'
      });
    }
  }, [currentOrganization, authLoading, orgLoading, refreshOrganization, user]);
  
  // Show loading state when both auth and organization are loading
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <LoadingState message="Loading authentication..." />
      </div>
    );
  }
  
  // We'll show a loading state for the organization, but still render the layout
  // This way, the sidebar is visible while the organization data loads
  
  return (
    <RoleBasedRoute allowedRoles={['admin']}>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {orgLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingState message="Loading organization data..." />
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </RoleBasedRoute>
  );
}