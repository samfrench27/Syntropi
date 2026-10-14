// Pure helpers for the hosted payment page. No DOM, no network, so `node --test` can run them.

/**
 * The payment id is the last path segment of /sessions/<paymentId> (the page is one static file
 * served for every id, so it cannot come from the router).
 * @param {string} pathname
 * @returns {string | null}
 */
export function paymentIdFromPathname(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last || last === 'sessions' || last === 'index.html') return null;
  try {
    const id = decodeURIComponent(last);
    return /^[A-Za-z0-9_-]{1,100}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * The payment token from a query string, or null.
 * @param {string} search
 * @returns {string | null}
 */
export function tokenFromSearch(search) {
  const value = new URLSearchParams(search || '').get('token');
  return value && value.trim() ? value.trim() : null;
}

/**
 * Only follow http(s) URLs. Anything else (javascript:, data:, relative, garbage) is refused.
 * @param {unknown} value
 * @returns {string | null}
 */
export function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Which screen a payment status belongs to.
 * @param {string | undefined} status
 * @returns {'choose' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired'}
 */
export function screenForStatus(status) {
  switch (String(status || '').toUpperCase()) {
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    case 'EXPIRED':
      return 'expired';
    case 'AUTHORIZED':
    case 'SUBMITTED':
    case 'ACCEPTED':
      return 'processing';
    // PENDING, and AUTHORIZING (a Mock payment starts there): the customer can still choose a bank.
    default:
      return 'choose';
  }
}

/** @param {string | undefined} status */
export function isFinal(status) {
  const s = screenForStatus(status);
  return s === 'completed' || s === 'failed' || s === 'cancelled' || s === 'expired';
}

/**
 * A payment whose expiry time has passed but which the API has not marked yet.
 * @param {{ status?: string, expiresAt?: string | null }} session
 * @param {number} [now]
 */
export function isPastExpiry(session, now = Date.now()) {
  if (!session || isFinal(session.status) || !session.expiresAt) return false;
  const t = Date.parse(session.expiresAt);
  return Number.isFinite(t) && t <= now;
}

/**
 * How a failed API call should be shown.
 * @param {{ status?: number, networkError?: boolean }} failure
 * @returns {'invalid' | 'network' | 'server'}
 */
export function errorKind(failure) {
  if (failure.networkError) return 'network';
  const s = failure.status || 0;
  if (s === 401 || s === 403 || s === 404) return 'invalid';
  return 'server';
}

/**
 * "24.50" + "GBP" -> "£24.50". Falls back to "24.50 GBP" for unknown currency codes.
 * @param {string} value
 * @param {string} currency
 * @param {string} [locale]
 */
export function formatAmount(value, currency, locale = 'en-GB') {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${value} ${currency}`.trim();
  try {
    const digits = (String(value).split('.')[1] || '').length;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: Math.max(2, Math.min(digits, 4)),
      maximumFractionDigits: Math.max(2, Math.min(digits, 4)),
    }).format(n);
  } catch {
    return `${value} ${currency}`.trim();
  }
}

/** @param {{ name?: string, displayName?: string | null }} bank */
export function bankLabel(bank) {
  return (bank.displayName && bank.displayName.trim()) || (bank.name && bank.name.trim()) || 'Bank';
}

/** First letter for the logo fallback. @param {{ name?: string, displayName?: string | null }} bank */
export function bankInitial(bank) {
  const match = bankLabel(bank).match(/[A-Za-z0-9]/);
  return match ? match[0].toUpperCase() : '?';
}

/**
 * Case-insensitive filter on the bank name, ignoring extra spaces.
 * @template {{ name?: string, displayName?: string | null }} T
 * @param {T[]} banks
 * @param {string} query
 * @returns {T[]}
 */
export function filterBanks(banks, query) {
  const q = String(query || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return banks;
  return banks.filter((b) => `${b.name || ''} ${b.displayName || ''}`.toLowerCase().includes(q));
}

const KEY = 'syntropi.hosted.token.';

/**
 * Remember the token for this payment for the life of the tab (sessionStorage, never localStorage).
 * Storage can be unavailable (private windows), so every call is guarded.
 * @param {{ getItem(k: string): string | null, setItem(k: string, v: string): void } | undefined} storage
 * @param {string} paymentId
 * @param {string} token
 */
export function saveToken(storage, paymentId, token) {
  try {
    storage?.setItem(KEY + paymentId, token);
  } catch {
    /* ignore: the in-memory copy still works */
  }
}

/** @param {{ getItem(k: string): string | null } | undefined} storage @param {string} paymentId */
export function loadToken(storage, paymentId) {
  try {
    return storage?.getItem(KEY + paymentId) || null;
  } catch {
    return null;
  }
}
