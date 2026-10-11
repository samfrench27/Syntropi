'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, Moon, Sun, SunMoon } from 'lucide-react';
import RoleBasedRoute from '@/components/auth/RoleBasedRoute';
import LoadingState from '@/components/admin/LoadingState';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme, type Mode } from '@/design/ThemeProvider';
import { PROVIDER_REQUESTS_CHANGED, providerRequestsAPI } from '@/lib/api';
import { activeIndex, AREA_META, pageTitle, type Area } from './navConfig';

type Role = 'superadmin' | 'admin' | 'user';

const MODES: { id: Mode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'Auto', icon: SunMoon },
];

interface AppShellProps {
  area: Area;
  allowedRoles: Role[];
  children: React.ReactNode;
}

export default function AppShell({ area, allowedRoles, children }: AppShellProps) {
  const pathname = usePathname();
  const { label, items } = AREA_META[area];
  const [mobileOpen, setMobileOpen] = useState(false);
  const { loading: authLoading } = useAuth();
  const { currentOrganization, loading: orgLoading, error: orgError, refreshOrganization } = useOrganization();
  const needsOrg = area !== 'platform';

  // Close the mobile sheet whenever the route changes.
  useEffect(() => setMobileOpen(false), [pathname]);

  // Org and client areas need the organization in context on every page.
  useEffect(() => {
    if (!needsOrg || authLoading || orgLoading) return;
    if (!currentOrganization && !orgError) refreshOrganization();
  }, [needsOrg, authLoading, orgLoading, currentOrganization, orgError, refreshOrganization]);

  const subtitle = needsOrg && currentOrganization?.name ? currentOrganization.name : label;

  return (
    <RoleBasedRoute allowedRoles={allowedRoles}>
      <div className="flex min-h-screen gap-3 p-3">
        {mobileOpen && (
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
        {/* No top bar: on small screens a floating button opens the sidebar. */}
        <button
          aria-label="Open menu"
          className="glass fixed left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full lg:hidden"
          style={{ color: 'var(--d-ink)' }}
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} aria-hidden />
        </button>
        <aside
          className={`glass fixed bottom-3 left-3 top-3 z-40 flex w-64 flex-col transition-transform duration-300 lg:sticky lg:top-3 lg:h-[calc(100vh-1.5rem)] lg:translate-x-0 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-[110%]'
          }`}
          style={{ borderRadius: 'var(--d-r-sheet)', transitionTimingFunction: 'var(--d-spring)' }}
        >
          <Sidebar area={area} label={subtitle} areaLabel={label} pathname={pathname} />
        </aside>

        <main className="min-w-0 flex-1 pb-6 pt-4 lg:pt-6">
          {/* Pages bring their own p-6, so the title uses the same inset to line up with them. */}
          <h1
            className="flex min-h-11 items-center pl-16 pr-6 text-3xl font-semibold tracking-tight lg:pl-6"
            style={{ color: 'var(--d-ink)' }}
          >
            {pageTitle(items, pathname)}
          </h1>
          <div className="shell-content px-6 pt-3">
            {needsOrg && orgLoading ? (
              <LoadingState message="Loading organization data..." />
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </RoleBasedRoute>
  );
}

/** Number of provider requests waiting for review. Refreshed on navigation and after a decision. */
function usePendingRequests(enabled: boolean, pathname: string | null): number {
  const [count, setCount] = useState(0);
  const refresh = React.useCallback(async () => {
    try {
      const res = await providerRequestsAPI.list({ status: 'pending', limit: 1 });
      setCount(res.data.data.counts.pending);
    } catch {
      /* the badge is a convenience: keep the last number */
    }
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, pathname, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ pending?: number }>).detail;
      if (typeof detail?.pending === 'number') setCount(detail.pending);
      else refresh();
    };
    window.addEventListener(PROVIDER_REQUESTS_CHANGED, onChange);
    return () => window.removeEventListener(PROVIDER_REQUESTS_CHANGED, onChange);
  }, [enabled, refresh]);

  return count;
}

function Sidebar({
  area,
  label,
  areaLabel,
  pathname,
}: {
  area: Area;
  label: string;
  areaLabel: string;
  pathname: string | null;
}) {
  const { items } = AREA_META[area];
  const active = activeIndex(items, pathname);
  const listRef = useRef<HTMLUListElement>(null);
  const [lens, setLens] = useState<{ top: number; height: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const pending = usePendingRequests(items.some((i) => i.badge === 'pendingRequests'), pathname);

  // The selection lens glides between items. The first placement must not animate.
  useLayoutEffect(() => {
    // Look the item up by index: the lens <li> is also a child of the list, so children[active] is off by one
    const el = listRef.current?.querySelector<HTMLElement>(`[data-nav-index="${active}"]`);
    if (!el) {
      setLens(null);
      return;
    }
    setLens({ top: el.offsetTop, height: el.offsetHeight });
    const t = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(t);
  }, [active]);

  return (
    <>
      <div className="px-6 pb-3 pt-6">
        <p className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
          Syntropi
        </p>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--d-ink-2)' }}>
          {label}
        </p>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-3">
        <ul ref={listRef} className="relative space-y-0.5">
          {lens && (
            <li
              aria-hidden
              className="pointer-events-none absolute inset-x-0 left-0"
              style={{
                top: 0,
                height: lens.height,
                transform: `translateY(${lens.top}px)`,
                transition: animate ? 'transform 0.45s var(--d-spring), height 0.3s' : 'none',
                borderRadius: 'var(--d-r-ctl)',
                background: 'var(--d-accent-soft)',
                boxShadow: 'inset 0 1px 0 var(--d-glass-hi), 0 0 0 1px var(--d-glass-edge)',
              }}
            />
          )}
          {items.map((item, i) => {
            const Icon = item.icon;
            const isActive = i === active;
            return (
              <li key={item.href} data-nav-index={i} className="relative">
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className="flex items-center gap-3 px-3 py-2.5 text-[15px] font-medium transition-colors"
                  style={{
                    borderRadius: 'var(--d-r-ctl)',
                    color: isActive ? 'var(--d-accent-ink)' : 'var(--d-ink-2)',
                  }}
                >
                  <Icon size={19} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {item.badge === 'pendingRequests' && pending > 0 && (
                    <span
                      className="mono min-w-[1.4rem] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold"
                      style={{ background: 'var(--d-accent)', color: 'var(--d-on-accent)' }}
                    >
                      <span className="sr-only">{pending} waiting: </span>
                      <span aria-hidden>{pending > 99 ? '99+' : pending}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3">
        <UserMenu areaLabel={areaLabel} />
      </div>
    </>
  );
}

/** Account chip pinned to the sidebar footer. The popover opens upwards. */
function UserMenu({ areaLabel }: { areaLabel: string }) {
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Account';
  const initials = (user?.firstName?.[0] || user?.email?.[0] || '?').toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      {open && (
        <div
          role="menu"
          className="glass pop-in absolute bottom-full left-0 right-0 mb-2 p-2"
          style={{ borderRadius: 'var(--d-r-panel)' }}
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold" style={{ color: 'var(--d-ink)' }}>
              {name}
            </p>
            <p className="truncate text-xs" style={{ color: 'var(--d-ink-2)' }}>
              {user?.email}
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label="Appearance"
            className="mx-1 mb-1 flex gap-1 rounded-xl p-1"
            style={{ background: 'var(--d-accent-soft)' }}
          >
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="radio"
                aria-checked={mode === id}
                onClick={() => setMode(id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all"
                style={{
                  background: mode === id ? 'var(--d-panel)' : 'transparent',
                  color: 'var(--d-ink)',
                  boxShadow: mode === id ? 'var(--d-panel-shadow)' : 'none',
                }}
              >
                <Icon size={14} aria-hidden /> {label}
              </button>
            ))}
          </div>
          <button
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--d-accent-soft)]"
            style={{ color: 'var(--d-ink)' }}
          >
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-[var(--d-accent-soft)]"
        style={{ background: open ? 'var(--d-accent-soft)' : undefined }}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          style={{ background: 'var(--d-accent)', color: 'var(--d-on-accent)' }}
          aria-hidden
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold" style={{ color: 'var(--d-ink)' }}>
            {name}
          </span>
          <span className="block truncate text-xs" style={{ color: 'var(--d-ink-2)' }}>
            {areaLabel}
          </span>
        </span>
      </button>
    </div>
  );
}
