import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paymentIdFromPathname, tokenFromSearch, safeHttpUrl, screenForStatus, isFinal, isPastExpiry,
  errorKind, formatAmount, bankInitial, filterBanks, saveToken, loadToken,
} from '../src/lib/logic.mjs';

test('payment id is the last path segment', () => {
  assert.equal(paymentIdFromPathname('/sessions/pay_abc123'), 'pay_abc123');
  assert.equal(paymentIdFromPathname('/sessions/pay_abc123/'), 'pay_abc123');
  assert.equal(paymentIdFromPathname('/sessions/'), null);
  assert.equal(paymentIdFromPathname('/sessions'), null);
  assert.equal(paymentIdFromPathname('/sessions/index.html'), null);
  assert.equal(paymentIdFromPathname('/'), null);
  assert.equal(paymentIdFromPathname('/sessions/%E0%A4%A'), null);
  assert.equal(paymentIdFromPathname('/sessions/a b'), null);
  assert.equal(paymentIdFromPathname('/sessions/%3Cscript%3E'), null);
});

test('token comes from the query string', () => {
  assert.equal(tokenFromSearch('?token=abc.def.ghi'), 'abc.def.ghi');
  assert.equal(tokenFromSearch('?redirect_uri=x&token=t'), 't');
  assert.equal(tokenFromSearch('?token='), null);
  assert.equal(tokenFromSearch('?token=%20'), null);
  assert.equal(tokenFromSearch(''), null);
});

test('only http and https urls are followed', () => {
  assert.equal(safeHttpUrl('https://bank.example/auth?x=1'), 'https://bank.example/auth?x=1');
  assert.equal(safeHttpUrl('http://localhost:3002/pay/p?token=t'), 'http://localhost:3002/pay/p?token=t');
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '//evil.example', '/relative', 'ftp://x', '', '  ', null, undefined, 42, {}]) {
    assert.equal(safeHttpUrl(bad), null, String(bad));
  }
});

test('status maps to a screen', () => {
  assert.equal(screenForStatus('PENDING'), 'choose');
  assert.equal(screenForStatus('AUTHORIZING'), 'choose');
  assert.equal(screenForStatus('AUTHORIZED'), 'processing');
  assert.equal(screenForStatus('SUBMITTED'), 'processing');
  assert.equal(screenForStatus('ACCEPTED'), 'processing');
  assert.equal(screenForStatus('COMPLETED'), 'completed');
  assert.equal(screenForStatus('FAILED'), 'failed');
  assert.equal(screenForStatus('CANCELLED'), 'cancelled');
  assert.equal(screenForStatus('EXPIRED'), 'expired');
  assert.equal(screenForStatus('SOMETHING_NEW'), 'choose');
  assert.equal(isFinal('COMPLETED'), true);
  assert.equal(isFinal('PENDING'), false);
});

test('expiry is noticed before the API marks it', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  assert.equal(isPastExpiry({ status: 'PENDING', expiresAt: '2026-01-01T11:59:00Z' }, now), true);
  assert.equal(isPastExpiry({ status: 'PENDING', expiresAt: '2026-01-01T12:01:00Z' }, now), false);
  assert.equal(isPastExpiry({ status: 'COMPLETED', expiresAt: '2026-01-01T11:00:00Z' }, now), false);
  assert.equal(isPastExpiry({ status: 'PENDING', expiresAt: null }, now), false);
});

test('errors are classified for display', () => {
  assert.equal(errorKind({ networkError: true }), 'network');
  assert.equal(errorKind({ status: 401 }), 'invalid');
  assert.equal(errorKind({ status: 403 }), 'invalid');
  assert.equal(errorKind({ status: 404 }), 'invalid');
  assert.equal(errorKind({ status: 500 }), 'server');
  assert.equal(errorKind({ status: 503 }), 'server');
  assert.equal(errorKind({ status: 429 }), 'server');
});

test('amounts are formatted with the currency', () => {
  assert.equal(formatAmount('24.50', 'GBP'), '£24.50');
  assert.equal(formatAmount('1200', 'GBP'), '£1,200.00');
  assert.match(formatAmount('10', 'EUR'), /€10\.00/);
  assert.equal(formatAmount('abc', 'GBP'), 'abc GBP');
  assert.equal(formatAmount('5', 'NOPE1'), '5 NOPE1');
});

test('banks: initial and search', () => {
  assert.equal(bankInitial({ name: 'national bank of test' }), 'N');
  assert.equal(bankInitial({ name: '', displayName: null }), 'B');
  assert.equal(bankInitial({ name: '!!!' }), '?');
  const banks = [{ name: 'Financial Trust Test' }, { name: 'National Bank of Test', displayName: 'Natbank' }];
  assert.equal(filterBanks(banks, '').length, 2);
  assert.equal(filterBanks(banks, '  TRUST ').length, 1);
  assert.equal(filterBanks(banks, 'natbank').length, 1);
  assert.equal(filterBanks(banks, 'bank   of').length, 1);
  assert.equal(filterBanks(banks, 'zzz').length, 0);
});

test('token storage survives a missing or throwing storage', () => {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  saveToken(storage, 'pay_1', 'tok');
  assert.equal(loadToken(storage, 'pay_1'), 'tok');
  assert.equal(loadToken(storage, 'pay_2'), null);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  saveToken(broken, 'pay_1', 'tok');
  assert.equal(loadToken(broken, 'pay_1'), null);
  assert.equal(loadToken(undefined, 'pay_1'), null);
});
