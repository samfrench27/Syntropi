import type { AppDeps } from '../../types';

/** A bank as a provider reports it, in Syntropi's shape. Always GB for now. */
export interface ProviderBank {
  /** Friendly id, e.g. gb-monzo. */
  id: string;
  /** The bank's id in the provider's system. */
  originalId: string;
  name: string;
  country: string;
  logoUrl?: string;
  supportedPaymentMethods: string[];
  metadata: Record<string, unknown>;
}

/** Fetches a provider's bank list. Never reads global env or global fetch: everything comes from deps. */
export interface BankListAdapter {
  code: string;
  /** Why this provider cannot be synced right now (missing credentials, not built yet), or null if it can. */
  unavailableReason(env: AppDeps['env']): string | null;
  /** Throws on any HTTP or parsing failure, so a failed fetch is never mistaken for "the provider has no banks". */
  getBanks(deps: AppDeps): Promise<ProviderBank[]>;
}

export const FETCH_TIMEOUT_MS = 15_000;

export function cleanBankName(name: string | undefined | null): string {
  if (!name) return '';
  return String(name).replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
}

export function slugify(name: string): string {
  return cleanBankName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** GET JSON with a timeout. The error message never includes headers or credentials. */
export async function getJson<T>(deps: AppDeps, url: string, headers: Record<string, string>, label: string): Promise<T> {
  const res = await deps.fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${label} returned HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`${label} returned an unreadable response`);
  }
}
