// End-to-end check of the Mock bank page against the REAL local API Worker.
//   NODE_PATH=<dir with playwright-core>/.. node e2e/flow.mjs        (bank on :3002, Worker on :8787)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { API, BANK, CHROME, createFixture } from './setup.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const results = [];
async function scenario(name, fn) {
  try {
    await fn();
    results.push([name, true]);
    console.log(`PASS ${name}`);
  } catch (e) {
    results.push([name, false]);
    console.log(`FAIL ${name}\n     ${String(e.message).split('\n').slice(0, 4).join('\n     ')}`);
  }
}

const CORS = { 'access-control-allow-origin': BANK, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
/** Answer an API call with a canned response (for cases the real API cannot easily produce). */
async function mock(page, pattern, status, body) {
  await page.route(pattern, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  });
}
const fakeView = (over = {}) => ({
  success: true,
  data: { paymentId: 'p1', merchant: { name: 'Acme Coffee' }, organizationName: 'Acme Coffee', amount: { value: '10.50', currency: 'GBP' }, currency: 'GBP', reference: 'ORDER-1', status: 'AUTHORIZING', expiresAt: new Date(Date.now() + 600000).toISOString(), ...over },
});
const text = (page, t, timeout = 8000) => page.getByText(t).first().waitFor({ timeout });
const doneDemo = (page) => page.route('**/done-demo**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>merchant</p>' }));

const fx = await createFixture();
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const consoleLines = [];
ctx.on('page', (p) => p.on('console', (m) => consoleLines.push(m.text())));

try {
  await scenario('approve: login, request details, approve, redirected, payment COMPLETED', async () => {
    const p = await fx.createPayment();
    const page = await ctx.newPage();
    await doneDemo(page);
    await page.goto(p.link);
    await text(page, 'Log in to your bank');
    const url = new URL(page.url());
    assert.equal(url.searchParams.get('token'), null, 'token removed from the address bar');
    assert.ok(url.pathname.includes(p.id), 'payment id still in the path');
    assert.equal(await page.getByLabel('Customer ID').inputValue(), 'demo-customer');
    assert.equal(await page.getByLabel('Passcode').inputValue(), '123456');
    await text(page, 'Mock bank, no real money');
    await page.getByRole('button', { name: 'Log in' }).click();
    await text(page, 'Approve this payment?');
    assert.equal(await page.getByTestId('amount').innerText(), '£10.50');
    await text(page, 'ORDER-1');
    await text(page, fx.orgName);
    await text(page, 'Time left to approve');
    await page.getByRole('button', { name: 'Approve payment' }).click();
    await text(page, 'Payment approved');
    await text(page, 'Return to merchant now');
    await page.waitForURL('**/done-demo**', { timeout: 8000 });
    const back = new URL(page.url());
    assert.equal(back.searchParams.get('status'), 'COMPLETED');
    assert.equal(back.searchParams.get('paymentId'), p.id);
    assert.equal(await fx.paymentStatus(p.id), 'COMPLETED');
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    await page.close();
  });

  await scenario('reject: payment FAILED and customer redirected', async () => {
    const p = await fx.createPayment({ reference: { reference: 'ORDER-2' } });
    const page = await ctx.newPage();
    await doneDemo(page);
    await page.goto(p.link);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.getByRole('button', { name: 'Reject' }).click();
    await text(page, 'Payment rejected');
    await page.waitForURL('**/done-demo**', { timeout: 8000 });
    assert.equal(new URL(page.url()).searchParams.get('status'), 'FAILED');
    assert.equal(await fx.paymentStatus(p.id), 'FAILED');
    await page.close();
  });

  await scenario('no redirect link: result stays, no navigation', async () => {
    const p = await fx.createPayment({ redirectUrl: undefined });
    const page = await ctx.newPage();
    await page.goto(p.link);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.getByRole('button', { name: 'Approve payment' }).click();
    await text(page, 'Payment approved');
    await page.waitForTimeout(2800);
    assert.ok(page.url().includes('/pay/'), 'still on the bank page');
    assert.equal(await page.getByText('Return to merchant now').count(), 0);
    await page.close();
  });

  await scenario('reusing a link shows the earlier result (already decided)', async () => {
    const p = await fx.createPayment({ redirectUrl: undefined });
    const page = await ctx.newPage();
    await page.goto(p.link);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.getByRole('button', { name: 'Approve payment' }).click();
    await text(page, 'Payment approved');
    await page.goto(p.link);
    await text(page, 'This payment was already decided');
    await text(page, 'Payment approved');
    await page.close();
  });

  await scenario('?paymentId= query is accepted as well as the path', async () => {
    const p = await fx.createPayment();
    const page = await ctx.newPage();
    await page.goto(`${BANK}/pay/?paymentId=${p.id}&token=${encodeURIComponent(p.token)}`);
    await text(page, 'Log in to your bank');
    assert.equal(new URL(page.url()).searchParams.get('token'), null);
    await page.close();
  });

  await scenario('tampered token: not valid', async () => {
    const p = await fx.createPayment();
    const bad = p.token.slice(0, -3) + (p.token.endsWith('aaa') ? 'bbb' : 'aaa');
    const page = await ctx.newPage();
    await page.goto(`${BANK}/pay/${p.id}?token=${encodeURIComponent(bad)}`);
    await text(page, 'This link is not valid');
    assert.equal(await page.getByText('{').count(), 0, 'no raw JSON');
    await page.close();
  });

  await scenario('missing token: plain guidance', async () => {
    const p = await fx.createPayment();
    const page = await ctx.newPage();
    await page.goto(`${BANK}/pay/${p.id}`);
    await text(page, 'This link is missing its security token. Go back to the merchant and try again.');
    await page.close();
  });

  await scenario('unknown payment id with a real token: not valid for this payment', async () => {
    const p = await fx.createPayment();
    const page = await ctx.newPage();
    await page.goto(`${BANK}/pay/00000000-0000-4000-8000-000000000000?token=${encodeURIComponent(p.token)}`);
    await text(page, 'This link is not valid');
    await page.close();
  });

  await scenario('no payment id at all', async () => {
    const page = await ctx.newPage();
    await page.goto(`${BANK}/pay/`);
    await text(page, 'Payment link incomplete');
    await page.close();
  });

  await scenario('double click on Approve sends one decision', async () => {
    const p = await fx.createPayment({ redirectUrl: undefined });
    const page = await ctx.newPage();
    let posts = 0;
    await page.route('**/decision', async (route) => {
      if (route.request().method() === 'POST') posts++;
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });
    await page.goto(p.link);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.getByRole('button', { name: 'Approve payment' }).dblclick();
    await text(page, 'Payment approved');
    assert.equal(posts, 1);
    await page.close();
  });

  await scenario('expired payment (410): plain message', async () => {
    const page = await ctx.newPage();
    await mock(page, '**/api/mock-bank/payments/p1', 410, { success: false, error: { message: 'This payment has expired', code: 'PAYMENT_EXPIRED' } });
    await page.goto(`${BANK}/pay/p1?token=abc.def.ghi`);
    await text(page, 'This payment has expired');
    assert.equal(await page.getByText('PAYMENT_EXPIRED').count(), 0);
    await page.close();
  });

  await scenario('network failure shows retry, retry recovers', async () => {
    const page = await ctx.newPage();
    let fail = true;
    await page.route('**/api/mock-bank/payments/p1', (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      if (fail) return route.abort('failed');
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(fakeView()) });
    });
    await page.goto(`${BANK}/pay/p1?token=abc.def.ghi`);
    await text(page, 'Cannot reach the Mock bank');
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await text(page, 'Log in to your bank');
    await page.close();
  });

  await scenario('decision 409 shows the earlier result', async () => {
    const page = await ctx.newPage();
    let decided = false;
    await page.route('**/api/mock-bank/payments/p1', (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(fakeView({ status: decided ? 'FAILED' : 'AUTHORIZING' })) });
    });
    await page.route('**/api/mock-bank/payments/p1/decision', (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      decided = true;
      return route.fulfill({ status: 409, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ success: false, error: { message: 'Payment is already FAILED' } }) });
    });
    await page.goto(`${BANK}/pay/p1?token=abc.def.ghi`);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.getByRole('button', { name: 'Approve payment' }).click();
    await text(page, 'Payment rejected');
    await text(page, 'already decided');
    await page.close();
  });

  await scenario('unsafe redirectUrl (javascript:) is ignored', async () => {
    const page = await ctx.newPage();
    await page.route('**/api/mock-bank/payments/p1', (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(fakeView()) });
    });
    await page.route('**/api/mock-bank/payments/p1/decision', (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ success: true, data: { status: 'COMPLETED', redirectUrl: 'javascript:alert(1)' } }) });
    });
    await page.goto(`${BANK}/pay/p1?token=abc.def.ghi`);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.getByRole('button', { name: 'Approve payment' }).click();
    await text(page, 'Payment approved');
    await page.waitForTimeout(2800);
    assert.equal(await page.getByText('Return to merchant now').count(), 0);
    assert.ok(page.url().startsWith(BANK));
    await page.close();
  });

  await scenario('token is never logged to the console', async () => {
    assert.ok(!consoleLines.some((l) => /eyJ/.test(l)), 'no JWT in console output');
  });
} finally {
  await browser.close();
  console.log(`cleanup: ${await fx.cleanup()}`);
}

const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
process.exit(failed ? 1 : 0);
