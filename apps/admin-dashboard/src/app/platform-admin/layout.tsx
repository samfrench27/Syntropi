// src/app/platform-admin/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/layout/PlatformAdminSidebar';
import Header from '@/components/layout/Header';
import RoleBasedRoute from '@/components/auth/RoleBasedRoute';

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Get the current page title based on the path
  const getPageTitle = () => {
    if (!pathname) return 'Dashboard';
    
    // For dashboard, use a specific title
    if (pathname === '/platform-admin' || pathname === '/platform-admin/dashboard') {
      return 'Dashboard';
    }
    
    // Handle payment detail pages
    if (pathname.includes('/analytics/payments/') && pathname.split('/').length > 4) {
      return 'Payment Details';
    }
    
    // Get the last meaningful part of the path (not dynamic IDs)
    const parts = pathname.split('/').filter(part => part);
    let lastPart = parts[parts.length - 1];
    
    // Skip dynamic route parameters (payment IDs, user IDs, etc.)
    if (lastPart && (lastPart.startsWith('pay_') || lastPart.length > 20)) {
      lastPart = parts[parts.length - 2] || 'Details';
    }
    
    // Handle special cases
    if (lastPart === 'api-keys') return 'API Keys';
    
    // Convert slug to title case (e.g., "user-management" -> "User Management")
    return lastPart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <RoleBasedRoute allowedRoles={['superadmin']}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'linear-gradient(to bottom right, rgba(79, 140, 255, 0.03), rgba(159, 92, 255, 0.03))'
      }}>
        {/* Header contains the logo and user profile */}
        <Header title={getPageTitle()} />
        
        {/* Main content area with sidebar */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </RoleBasedRoute>
  );
}