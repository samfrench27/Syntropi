import React from 'react';
import { Ban, CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
import type { AccessStatus } from '@/lib/api';

const META: Record<AccessStatus, { label: string; tone: string; icon: typeof Circle }> = {
  none: { label: 'Not requested', tone: 'idle', icon: Circle },
  pending: { label: 'Pending review', tone: 'warn', icon: Clock },
  approved: { label: 'Approved', tone: 'ok', icon: CheckCircle2 },
  rejected: { label: 'Rejected', tone: 'bad', icon: XCircle },
  revoked: { label: 'Access revoked', tone: 'bad', icon: Ban },
};

/** Status is always icon + label, never colour alone. */
export default function StatusChip({ status }: { status: AccessStatus }) {
  const { label, tone, icon: Icon } = META[status];
  return (
    <span className="chip" data-tone={tone}>
      <Icon size={13} aria-hidden />
      {label}
    </span>
  );
}
