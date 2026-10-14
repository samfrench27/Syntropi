import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRoute } from '../src/lib/routeParams.mjs';

test('reads the id from the address', () => {
  assert.deepEqual(matchRoute('/platform-admin/users/[id]', '/platform-admin/users/6ac9b8'), { id: '6ac9b8' });
  assert.deepEqual(matchRoute('/org-admin/payments/[paymentId]', '/org-admin/payments/pay_abc123'), { paymentId: 'pay_abc123' });
});

test('copes with a trailing slash, a query string and a hash', () => {
  assert.deepEqual(matchRoute('/platform-admin/users/[id]', '/platform-admin/users/6ac9b8/?tab=users#x'), { id: '6ac9b8' });
});

test('matches nested routes', () => {
  assert.deepEqual(matchRoute('/platform-admin/analytics/payments/[paymentId]', '/platform-admin/analytics/payments/pay_1'), { paymentId: 'pay_1' });
});

test('returns nothing for a different route, a different depth, or the build placeholder', () => {
  assert.deepEqual(matchRoute('/platform-admin/users/[id]', '/platform-admin/organizations/abc'), {});
  assert.deepEqual(matchRoute('/platform-admin/users/[id]', '/platform-admin/users'), {});
  assert.deepEqual(matchRoute('/platform-admin/users/[id]', '/platform-admin/users/abc/extra'), {});
  assert.deepEqual(matchRoute('/platform-admin/users/[id]', '/platform-admin/users/_/'), {});
});

test('decodes encoded ids and rejects malformed ones', () => {
  assert.deepEqual(matchRoute('/x/[id]', '/x/a%20b'), { id: 'a b' });
  assert.deepEqual(matchRoute('/x/[id]', '/x/%E0%A4%A'), {});
});
