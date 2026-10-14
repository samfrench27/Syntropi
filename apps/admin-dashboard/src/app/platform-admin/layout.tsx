// src/app/platform-admin/layout.tsx
'use client';

import AppShell from '@/components/shell/AppShell';

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell area="platform" allowedRoles={['superadmin']}>
      {children}
    </AppShell>
  );
}
