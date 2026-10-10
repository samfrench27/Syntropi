// src/app/org-admin/layout.tsx
'use client';

import AppShell from '@/components/shell/AppShell';

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell area="org" allowedRoles={['admin']}>
      {children}
    </AppShell>
  );
}
