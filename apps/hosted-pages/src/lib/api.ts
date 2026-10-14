import type { Bank, InitiateResult, PaymentSession } from '@/types/payment';
import { errorKind } from './logic.mjs';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
// Sample data is for local design work only. A production build can never use it, even if a stray
// .env.local on the build machine asks for it (this once shipped sample data to the live page).
export const USE_MOCK_DATA = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

const TIMEOUT_MS = 15000;

/** A failed API call, already classified for display. Never carries a raw server message to the screen. */
export class ApiFailure extends Error {
  kind: 'invalid' | 'network' | 'server';
  status: number;
  code?: string;
  constructor(kind: 'invalid' | 'network' | 'server', status = 0, code?: string) {
    super(`${kind} (${status}${code ? ` ${code}` : ''})`);
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, token: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new ApiFailure('network');
  } finally {
    clearTimeout(timer);
  }

  let json: { success?: boolean; data?: T; error?: { message?: string; code?: string } } | undefined;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }
  if (!res.ok || !json || json.success === false || json.data === undefined) {
    throw new ApiFailure(errorKind({ status: res.ok ? 502 : res.status }), res.status, json?.error?.code);
  }
  return json.data;
}

const enc = encodeURIComponent;

export async function getSession(paymentId: string, token: string): Promise<PaymentSession> {
  if (USE_MOCK_DATA) return (await import('./mockData')).mockApi.getSession();
  return request<PaymentSession>('GET', `/api/payments/${enc(paymentId)}/hosted`, token);
}

export async function getStatus(paymentId: string, token: string): Promise<PaymentSession> {
  if (USE_MOCK_DATA) return (await import('./mockData')).mockApi.getSession();
  return request<PaymentSession>('GET', `/api/payments/${enc(paymentId)}/status`, token);
}

/** Only the banks this payment's organization is approved for. Reads every page (100 per page). */
export async function getBanks(token: string): Promise<Bank[]> {
  if (USE_MOCK_DATA) return (await import('./mockData')).mockApi.getBanks();
  const all: Bank[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await request<{ banks: Bank[]; pagination?: { pages?: number } }>('GET', `/api/banks?limit=100&page=${page}`, token);
    all.push(...(data.banks || []));
    if (!data.pagination?.pages || page >= data.pagination.pages) break;
  }
  return all;
}

/** Choose the bank and start the provider flow. Safe to repeat. The merchant return URL is fixed when the payment is created. */
export async function initiate(paymentId: string, bankId: string, token: string): Promise<InitiateResult> {
  if (USE_MOCK_DATA) return (await import('./mockData')).mockApi.initiate();
  return request<InitiateResult>('POST', '/api/payments/initiate', token, { paymentId, bankId });
}

export async function cancel(paymentId: string, token: string): Promise<PaymentSession> {
  if (USE_MOCK_DATA) return (await import('./mockData')).mockApi.cancel();
  return request<PaymentSession>('POST', `/api/payments/${enc(paymentId)}/cancel`, token);
}
