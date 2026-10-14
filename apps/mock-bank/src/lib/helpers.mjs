// Pure helpers. Plain ESM (typed with JSDoc) so `node --test` can run them without a build step.

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * The payment id: the last path segment of /pay/<id>, or ?paymentId= when the path has none
 * (for example when the page is opened as /pay/).
 * @param {string} pathname
 * @param {string} search
 * @returns {string | null}
 */
export function parsePaymentId(pathname, search = '') {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && last !== 'pay' && last !== 'index.html') {
    let decoded = last;
    try {
      decoded = decodeURIComponent(last);
    } catch {
      return null;
    }
    return ID_PATTERN.test(decoded) ? decoded : null;
  }
  const fromQuery = new URLSearchParams(search).get('paymentId');
  return fromQuery && ID_PATTERN.test(fromQuery) ? fromQuery : null;
}

/**
 * @param {string} search
 * @returns {string | null}
 */
export function readToken(search) {
  const token = new URLSearchParams(search).get('token');
  return token && token.trim() ? token.trim() : null;
}

/**
 * The address bar without the token (and without a duplicate paymentId), keeping any other query.
 * @param {string} pathname
 * @param {string} search
 * @param {string} hash
 * @returns {string}
 */
export function scrubbedUrl(pathname, search, hash = '') {
  const params = new URLSearchParams(search);
  params.delete('token');
  const rest = params.toString();
  return `${pathname}${rest ? `?${rest}` : ''}${hash}`;
}

/**
 * The return link comes from the API, which got it from the merchant: only follow http(s) links.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function safeRedirectUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Display only. The API sends an exact decimal string; Intl takes strings without going through a float.
 * @param {string} value
 * @param {string} currency
 * @param {string} [locale]
 * @returns {string}
 */
export function formatMoney(value, currency, locale = 'en-GB') {
  const text = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return `${value} ${currency}`;
  try {
    const nf = new Intl.NumberFormat(locale, { style: 'currency', currency });
    return nf.format(/** @type {any} */ (text));
  } catch {
    return `${value} ${currency}`;
  }
}

/**
 * @param {string | null | undefined} expiresAt ISO timestamp
 * @param {number} nowMs
 * @returns {number | null} whole seconds left (never negative), or null when unknown
 */
export function secondsLeft(expiresAt, nowMs) {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - nowMs) / 1000));
}

/**
 * @param {number} seconds
 * @returns {string} m:ss, or h:mm:ss from an hour up
 */
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
