import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  Inbox,
  Key,
  Landmark,
  Network,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type Area = 'platform' | 'org' | 'client';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** A live count shown beside the label. */
  badge?: 'pendingRequests';
}

export const AREA_META: Record<Area, { label: string; items: NavItem[] }> = {
  platform: {
    label: 'Platform admin',
    items: [
      { href: '/platform-admin/dashboard', label: 'Dashboard', icon: BarChart3 },
      { href: '/platform-admin/provider-requests', label: 'Approval queue', icon: Inbox, badge: 'pendingRequests' },
      { href: '/platform-admin/organizations', label: 'Organizations', icon: Building2 },
      { href: '/platform-admin/users', label: 'Users', icon: Users },
      { href: '/platform-admin/providers', label: 'Providers', icon: Network },
      { href: '/platform-admin/api-keys', label: 'API keys', icon: Key },
      { href: '/platform-admin/analytics', label: 'Analytics', icon: TrendingUp },
      { href: '/platform-admin/billing', label: 'Billing', icon: CreditCard },
      { href: '/platform-admin/activities', label: 'Activity', icon: Activity },
    ],
  },
  org: {
    label: 'Organization',
    items: [
      { href: '/org-admin/dashboard', label: 'Dashboard', icon: BarChart3 },
      { href: '/org-admin/providers', label: 'Providers', icon: Landmark },
      { href: '/org-admin/analytics', label: 'Analytics', icon: TrendingUp },
      { href: '/org-admin/organization', label: 'Organization', icon: Building2 },
      { href: '/org-admin/users', label: 'Users', icon: Users },
      { href: '/org-admin/api-keys', label: 'API keys', icon: Key },
      { href: '/org-admin/billing', label: 'Billing', icon: CreditCard },
      { href: '/org-admin/activities', label: 'Activity', icon: Activity },
    ],
  },
  client: {
    label: 'Developer',
    items: [
      { href: '/client-dashboard/dashboard', label: 'Dashboard', icon: BarChart3 },
      { href: '/client-dashboard/providers', label: 'Providers', icon: Landmark },
      { href: '/client-dashboard/api-keys', label: 'API keys', icon: Key },
      { href: '/client-dashboard/activities', label: 'Activity', icon: Activity },
    ],
  },
};

/** Index of the nav item whose path is the longest prefix of the current path. */
export function activeIndex(items: NavItem[], pathname: string | null): number {
  if (!pathname) return -1;
  let best = -1;
  let bestLen = 0;
  items.forEach((item, i) => {
    const hit = pathname === item.href || pathname.startsWith(item.href + '/');
    if (hit && item.href.length > bestLen) {
      best = i;
      bestLen = item.href.length;
    }
  });
  return best;
}

/** Page title: the matching nav label, else a tidy version of the last non-id path segment. */
export function pageTitle(items: NavItem[], pathname: string | null): string {
  const idx = activeIndex(items, pathname);
  if (pathname && idx >= 0 && pathname !== items[idx].href) {
    // A detail page under a section, e.g. /analytics/payments/pay_123
    if (pathname.includes('/payments/')) return 'Payment details';
    if (pathname.endsWith('/create')) return `New ${items[idx].label.toLowerCase().replace(/s$/, '').replace(/^api/, 'API')}`;
    return `${items[idx].label} details`;
  }
  if (idx >= 0) return items[idx].label;
  const last = (pathname || '').split('/').filter(Boolean).pop() || 'Dashboard';
  const words = last.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
