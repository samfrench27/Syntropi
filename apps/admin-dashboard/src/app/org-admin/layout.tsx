// src/app/org-admin/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import Sidebar from '@/components/layout/OrgAdminSidebar';
import OrgAdminHeader from '@/components/layout/OrgAdminHeader';
import RoleBasedRoute from '@/components/auth/RoleBasedRoute';
import LoadingState from '@/components/admin/LoadingState';
import { debugLog } from '@/lib/debug';

export default function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
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
  
  // Get the current page title based on the path
  const getPageTitle = () => {
    if (!pathname) return 'Dashboard';
    
    // For dashboard or organization path
    if (pathname === '/org-admin' || pathname === '/org-admin/dashboard') {
      return 'Dashboard';
    }
    
    // Get the last part of the path
    const parts = pathname.split('/');
    const lastPart = parts[parts.length - 1];
    
    // Handle special cases
    if (lastPart === 'api-keys') return 'API Keys';
    if (lastPart === 'organization') return 'Organization Settings';
    
    // Convert slug to title case (e.g., "user-management" -> "User Management")
    return lastPart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Show loading state when both auth and organization are loading
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <LoadingState message="Loading authentication..." />
      </div>
    );
  }

  return (
    <RoleBasedRoute allowedRoles={['admin']}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'linear-gradient(to bottom right, rgba(79, 140, 255, 0.03), rgba(159, 92, 255, 0.03))'
      }}>
        {/* Use the specialized OrgAdminHeader that displays organization name */}
        <OrgAdminHeader title={getPageTitle()} />
        
        {/* Main content area with sidebar */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            {orgLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <LoadingState message="Loading organization data..." />
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </RoleBasedRoute>
  );
}