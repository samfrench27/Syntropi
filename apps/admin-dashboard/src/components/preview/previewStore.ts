'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Fixture-only store for the design preview. It lets the Providers page and the approval queue
 * react to each other (request on one, approve on the other) with no backend.
 * Replaced by real API calls once the design is chosen.
 */

export type AccessStatus = 'none' | 'pending' | 'approved' | 'rejected';

const KEY = 'syntropi_preview_access';
const EVENT = 'syntropi-preview-access';
let cache: { raw: string | null; value: Record<string, AccessStatus> } = { raw: null, value: {} };

function read(): Record<string, AccessStatus> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cache.raw) cache = { raw, value: raw ? JSON.parse(raw) : {} };
  } catch {
    /* storage unavailable: treat as empty */
  }
  return cache.value;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

const EMPTY: Record<string, AccessStatus> = {};

export function usePreviewAccess() {
  const map = useSyncExternalStore(subscribe, read, () => EMPTY);

  const set = useCallback((id: string, status: AccessStatus) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: status }));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { map, set, reset };
}

export const PROVIDERS = [
  { code: 'token', name: 'Token.io', blurb: 'Pay-by-bank across UK and EU banks' },
  { code: 'yapily', name: 'Yapily', blurb: 'Open banking payments and data' },
  { code: 'truelayer', name: 'TrueLayer', blurb: 'Instant bank payments and payouts' },
  { code: 'tink', name: 'Tink', blurb: 'Account aggregation and payments' },
] as const;
