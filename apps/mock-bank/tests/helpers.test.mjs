import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCountdown, formatMoney, parsePaymentId, readToken, safeRedirectUrl, scrubbedUrl, secondsLeft } from '../src/lib/helpers.mjs';

test('parsePaymentId takes the last path segment', () => {
  assert.equal(parsePaymentId('/pay/abc-123', ''), 'abc-123');
  assert.equal(parsePaymentId('/pay/abc-123/', '?token=x'), 'abc-123');
  assert.equal(parsePaymentId('/a/b/c/9f1e2d3c-0000-4000-8000-000000000000', ''), '9f1e2d3c-0000-4000-8000-000000000000');
});
test('parsePaymentId falls back to ?paymentId=', () => {
  assert.equal(parsePaymentId('/pay/', '?paymentId=p_1'), 'p_1');
  assert.equal(parsePaymentId('/pay', '?paymentId=p_1&token=t'), 'p_1');
  assert.equal(parsePaymentId('/pay/index.html', '?paymentId=p_1'), 'p_1');
});
test('parsePaymentId rejects missing or odd ids', () => {
  assert.equal(parsePaymentId('/pay/', ''), null);
  assert.equal(parsePaymentId('/', ''), null);
  assert.equal(parsePaymentId('/pay/a%2Fb', ''), null);
  assert.equal(parsePaymentId('/pay/%E0%A4%A', ''), null);
  assert.equal(parsePaymentId('/pay/', '?paymentId=../x'), null);
});
test('readToken and scrubbedUrl', () => {
  assert.equal(readToken('?token=abc.def.ghi'), 'abc.def.ghi');
  assert.equal(readToken('?token='), null);
  assert.equal(readToken(''), null);
  assert.equal(scrubbedUrl('/pay/1/', '?token=abc&x=1', '#h'), '/pay/1/?x=1#h');
  assert.equal(scrubbedUrl('/pay/1/', '?token=abc'), '/pay/1/');
});
test('safeRedirectUrl only allows http and https', () => {
  assert.equal(safeRedirectUrl('https://shop.test/return?a=1'), 'https://shop.test/return?a=1');
  assert.equal(safeRedirectUrl('http://localhost:3002/done'), 'http://localhost:3002/done');
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'ftp://x.test', '//evil.test', '/relative', '', '   ', null, undefined, 5]) {
    assert.equal(safeRedirectUrl(bad), null, String(bad));
  }
});
test('formatMoney formats by currency without float rounding', () => {
  assert.equal(formatMoney('10.50', 'GBP'), '£10.50');
  assert.equal(formatMoney('1234567.89', 'EUR'), '€1,234,567.89');
  assert.equal(formatMoney('9007199254740993.01', 'GBP'), '£9,007,199,254,740,993.01');
  assert.equal(formatMoney('500', 'JPY'), 'JP¥500');
  assert.equal(formatMoney('1.00', 'NOPE'), '1.00 NOPE');
  assert.equal(formatMoney('abc', 'GBP'), 'abc GBP');
});
test('secondsLeft and formatCountdown', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(secondsLeft('2026-01-01T00:30:00Z', now), 1800);
  assert.equal(secondsLeft('2025-12-31T23:00:00Z', now), 0);
  assert.equal(secondsLeft(null, now), null);
  assert.equal(secondsLeft('nope', now), null);
  assert.equal(formatCountdown(1800), '30:00');
  assert.equal(formatCountdown(65), '1:05');
  assert.equal(formatCountdown(3725), '1:02:05');
  assert.equal(formatCountdown(-3), '0:00');
});
