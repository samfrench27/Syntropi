export type PaymentView = {
  paymentId: string;
  merchant: { name: string };
  organizationName: string;
  amount: { value: string; currency: string };
  currency: string;
  reference?: string;
  status: string;
  expiresAt: string | null;
};

export type Decision = 'approve' | 'reject';
export type DecisionResult = { status: string; redirectUrl: string | null };

/** Why a call failed, in terms the page can explain. */
export type FailKind = 'invalid-token' | 'expired' | 'not-found' | 'already-decided' | 'network' | 'server';
export type ApiResult<T> = { ok: true; data: T } | { ok: false; kind: FailKind };

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');

function kindOf(status: number): FailKind {
  if (status === 401 || status === 403) return 'invalid-token';
  if (status === 410) return 'expired';
  if (status === 404) return 'not-found';
  if (status === 409) return 'already-decided';
  return 'server';
}

async function call<T>(path: string, token: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    return { ok: false, kind: 'network' };
  }
  let body: { success?: boolean; data?: T } | null = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON: treated by status alone */
  }
  if (!res.ok || !body || body.success === false || body.data === undefined) return { ok: false, kind: res.ok ? 'server' : kindOf(res.status) };
  return { ok: true, data: body.data };
}

export const fetchPayment = (id: string, token: string) => call<PaymentView>(`/api/mock-bank/payments/${encodeURIComponent(id)}`, token);

export const sendDecision = (id: string, token: string, decision: Decision) =>
  call<DecisionResult>(`/api/mock-bank/payments/${encodeURIComponent(id)}/decision`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
