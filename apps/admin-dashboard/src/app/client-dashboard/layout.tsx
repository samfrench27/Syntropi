'use client';

import AppShell from '@/components/shell/AppShell';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell area="client" allowedRoles={['user', 'admin']}>
      {children}
    </AppShell>
  );
}
