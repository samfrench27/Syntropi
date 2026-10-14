import { COMMON, ROOTS } from './common-passwords.mjs';

/**
 * The password rules. One source of truth: the dashboard shows these checks as people type, and the
 * API enforces the same ones, so the two can never disagree.
 *
 * Length is what matters most (NIST SP 800-63B), so the minimum is 12, with no forced symbol (which only
 * pushes people to predictable swaps like P@ssw0rd). 72 is the ceiling: the Supabase sign-in system hashes
 * with bcrypt, which ignores anything past 72 bytes.
 */
export const MIN_LENGTH = 12;
export const MAX_LENGTH = 72;

const LEET = { '@': 'a', 4: 'a', 3: 'e', 0: 'o', $: 's', 5: 's', 7: 't', '!': 'i', 1: 'i' };
const WALKS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'qazwsxedcrfv', '1qaz2wsx3edc', '1234567890', '0987654321', 'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba'];

/** Lower-case, undo common letter-for-symbol swaps, and drop everything that is not a letter. */
function normalise(password, oneAs = 'i') {
  let out = '';
  for (const ch of password.toLowerCase()) {
    const swapped = ch === '1' ? (oneAs === 'l' ? 'l' : 'i') : (LEET[ch] ?? ch);
    if (/[a-z]/.test(swapped)) out += swapped;
  }
  return out;
}

/**
 * Mostly a repeating unit (aaaaaaaa, abababab, 123123123), or mostly straight runs and keyboard walks
 * (abcdefgh, qwertyuiop, zxcvbnm123456). "Mostly" is 75% of the characters, so a real password with a
 * short run in it (Harbor-Lamps-1234) is left alone.
 */
function isPattern(password) {
  const p = password.toLowerCase();
  if (p.length === 0) return false;

  // repeating unit of 1 to 8 characters
  for (let unit = 1; unit <= 8; unit++) {
    let same = 0;
    for (let i = unit; i < p.length; i++) if (p[i] === p[i - unit]) same++;
    if (p.length > unit && same / (p.length - unit) >= 0.8) return true;
  }

  // positions covered by a run or walk of at least 4 characters
  const covered = new Array(p.length).fill(false);
  for (const walk of WALKS) {
    for (let i = 0; i < p.length; i++) {
      let j = i;
      while (j < p.length && walk.includes(p.slice(i, j + 1))) j++;
      if (j - i >= 4) for (let k = i; k < j; k++) covered[k] = true;
    }
  }
  return covered.filter(Boolean).length / p.length >= 0.75;
}

export function isCommon(password) {
  if (COMMON.has(password.toLowerCase())) return true;
  if (isPattern(password)) return true;
  for (const oneAs of ['i', 'l']) {
    const n = normalise(password, oneAs);
    if (n && COMMON.has(n)) return true;
    // a short password that is just a well-known word plus decoration
    if (n.length <= 14 && ROOTS.some((root) => n.includes(root))) return true;
  }
  return false;
}

const alnum = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** True if the password contains (part of) the person's email name or one of their names. */
export function containsPersonalInfo(password, { email, names } = {}) {
  const pw = alnum(password);
  const parts = [];
  if (email) parts.push(alnum(String(email).split('@')[0]));
  for (const n of names ?? []) for (const token of String(n ?? '').split(/\s+/)) parts.push(alnum(token));
  return parts.some((part) => part.length >= 3 && pw.includes(part));
}

/**
 * Check a password. `email` and `names` are optional: when given, a password built from them is refused.
 *
 * Returns the individual checks (for a checklist), a strength score and label (a guide, never a promise
 * that a password is safe), and `acceptable`: every required check passes.
 */
export function evaluatePassword(password, { email, names } = {}) {
  const pw = typeof password === 'string' ? password : '';
  const personal = Boolean(email) || (names ?? []).some((n) => String(n ?? '').trim().length >= 3);

  const checks = [
    { id: 'length', label: `At least ${MIN_LENGTH} characters`, met: pw.length >= MIN_LENGTH, applicable: true },
    { id: 'lowercase', label: 'A lowercase letter', met: /\p{Ll}/u.test(pw), applicable: true },
    { id: 'uppercase', label: 'An uppercase letter', met: /\p{Lu}/u.test(pw), applicable: true },
    { id: 'number', label: 'A number', met: /\d/.test(pw), applicable: true },
    { id: 'common', label: 'Not a commonly used password', met: pw.length > 0 && !isCommon(pw), applicable: true },
    { id: 'personal', label: "Doesn't contain your name or email", met: !personal || !containsPersonalInfo(pw, { email, names }), applicable: personal },
    { id: 'max', label: `No more than ${MAX_LENGTH} characters`, met: pw.length <= MAX_LENGTH, applicable: pw.length > MAX_LENGTH },
  ];

  const required = checks.filter((c) => c.applicable);
  const acceptable = pw.length > 0 && required.every((c) => c.met);

  let score = 0;
  let label = '';
  if (pw.length > 0) {
    if (!acceptable) {
      score = pw.length >= 8 ? 1 : 0;
      label = 'Weak';
    } else if (pw.length >= 16 && new Set(pw).size >= 8) {
      score = 4;
      label = 'Strong';
    } else if (pw.length >= 14 && new Set(pw).size >= 6) {
      score = 3;
      label = 'Good';
    } else {
      score = 2;
      label = 'Fair';
    }
  }

  return { checks: checks.filter((c) => c.applicable), score, label, acceptable };
}

/** A sentence for an error message: what is still missing. Empty when acceptable. */
export function describeFailures(result) {
  const missing = result.checks.filter((c) => !c.met).map((c) => c.label.replace(/^(A|An) /, 'a ').replace(/^At least/, 'at least').replace(/^Not a/, 'not a').replace(/^Doesn't/, "doesn't").replace(/^No more/, 'no more'));
  if (missing.length === 0) return '';
  return `Your password needs: ${missing.join('; ')}.`;
}
