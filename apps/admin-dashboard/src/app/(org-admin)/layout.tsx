// src/app/(org-admin)/layout.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/layout/OrgAdminSidebar';
import RoleBasedRoute from '@/components/auth/RoleBasedRoute';

export default function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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