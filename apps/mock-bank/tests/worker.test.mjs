import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';

const seen = [];
const env = { ASSETS: { fetch: async (req) => { seen.push(new URL(req.url).pathname); return new Response('asset'); } } };

test('shows the payment page for any /pay/<id>, without using the id', async () => {
  seen.length = 0;
  await worker.fetch(new Request('https://bank.example/pay/pay_abc123?token=secret'), env);
  assert.deepEqual(seen, ['/pay/']);
});

test('passes every other path straight to the static files', async () => {
  seen.length = 0;
  await worker.fetch(new Request('https://bank.example/favicon.svg'), env);
  await worker.fetch(new Request('https://bank.example/nope'), env);
  assert.deepEqual(seen, ['/favicon.svg', '/nope']);
});
