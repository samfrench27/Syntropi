import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';

const seen = [];
const env = { ASSETS: { fetch: async (req) => { seen.push(new URL(req.url).pathname); return new Response('asset'); } } };
const get = async (path) => { seen.length = 0; await worker.fetch(new Request('https://dash.example' + path), env); return seen[0]; };

test('answers every id with the page built for the placeholder', async () => {
  assert.equal(await get('/platform-admin/users/6ac9b8f1-2e26-4e6e-9629-d04f'), '/platform-admin/users/_/');
  assert.equal(await get('/platform-admin/users/6ac9b8/'), '/platform-admin/users/_/');
  assert.equal(await get('/platform-admin/analytics/payments/pay_abc'), '/platform-admin/analytics/payments/_/');
  assert.equal(await get('/org-admin/payments/pay_abc'), '/org-admin/payments/_/');
  assert.equal(await get('/platform-admin/organizations/abc?tab=users'), '/platform-admin/organizations/_/');
});

test('covers every page that has an id in its address', async () => {
  for (const base of ['/org-admin/analytics/payments', '/org-admin/payments', '/platform-admin/analytics/payments', '/platform-admin/api-keys', '/platform-admin/organizations', '/platform-admin/payments', '/platform-admin/providers', '/platform-admin/users']) {
    assert.equal(await get(`${base}/some-id`), `${base}/_/`, base);
  }
});

test('leaves the create pages and everything else to the static files', async () => {
  assert.equal(await get('/platform-admin/users/create'), '/platform-admin/users/create');
  assert.equal(await get('/platform-admin/users/create/'), '/platform-admin/users/create/');
  assert.equal(await get('/platform-admin/users'), '/platform-admin/users');
  assert.equal(await get('/login/'), '/login/');
  assert.equal(await get('/platform-admin/users/abc/extra'), '/platform-admin/users/abc/extra');
});

test('serves the app\'s own 404 page, with a 404 status, for an unknown path', async () => {
  const assets = { fetch: async (req) => {
    const path = new URL(req.url).pathname;
    return path === '/404.html' ? new Response('not found page', { status: 200, headers: { 'content-type': 'text/html' } }) : new Response('missing', { status: 404 });
  } };
  const res = await worker.fetch(new Request('https://dash.example/nope/'), { ASSETS: assets });
  assert.equal(res.status, 404);
  assert.equal(await res.text(), 'not found page');
  assert.equal(res.headers.get('content-type'), 'text/html');
});

test('passes a found file through untouched', async () => {
  const res = await worker.fetch(new Request('https://dash.example/login/'), { ASSETS: { fetch: async () => new Response('login page', { status: 200 }) } });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'login page');
});
