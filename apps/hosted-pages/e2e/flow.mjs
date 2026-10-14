// End-to-end check of the hosted payment page against a REAL local Worker and the Supabase project behind it.
//
//   NODE_PATH=<dir>/node_modules node e2e/flow.mjs
//
// Needs: the Worker at E2E_API_URL (default http://127.0.0.1:8787) and the page at E2E_SITE_URL
// (default http://localhost:3001; started with `npm run dev` if nothing answers). The Mock bank app
// is NOT needed: the Mock bank link is only intercepted and its URL asserted.
// Test data is fictional; secrets are read from apps/api-worker/.dev.vars and never printed.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { setup, SITE, API } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const here = path.dirname(fileURLToPath(import.meta.url));

const INVALID_TEXT = "This link isn't valid anymore. Return to the merchant and try again.";
const MOCK_BANK_ORIGIN = 'http://localhost:3002';

async function reachable(url) {
  try { await fetch(url, { signal: AbortSignal.timeout(3000) }); return true; } catch { return false; }
}

let devServer;
async function ensureSite() {
  if (await reachable(SITE)) return;
  console.log(`Starting the page on ${SITE} ...`);
  devServer = spawn('npx', ['next', 'dev', '-p', new URL(SITE).port || '3001'], { cwd: path.resolve(here, '..'), stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await reachable(SITE)); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await reachable(SITE))) throw new Error(`The page did not start on ${SITE}`);
}

// Payment tokens are credentials: never print them.
const redact = (t) => t.replace(/(token=)[^\s"&]+/g, '$1<redacted>').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<jwt>');

const results = [];
async function test(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok   ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    results.push({ name, ok: false, error: e });
    console.log(`  FAIL ${name}\n       ${redact(String(e.message || e)).split('\n').join('\n       ')}`);
  }
}

const sessionUrl = (id, token) => `${SITE}/sessions/${id}${token === undefined ? '' : `?token=${encodeURIComponent(token)}`}`;

async function main() {
  await ensureSite();
  const s = await setup();
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });

  /** A fresh page that records console errors (except broken bank logos, which are expected: the fallback letter shows). */
  async function open() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.problems = [];
    page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.problems.push(`console: ${m.text()}`);
    });
    // The Mock bank app is built separately: answer its URL so we only assert where we were sent.
    await context.route(`${MOCK_BANK_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Mock bank (stub)</title>' }));
    return { context, page };
  }
  const apiBanks = async (token) => (await s.call('GET', `${API}/api/banks?limit=100`, { headers: { authorization: `Bearer ${token}` } })).json.data.banks;

  try {
    console.log(`Page ${SITE}, API ${API}`);

    await test('choose a Mock bank: lists only the API banks, then goes to the Mock bank link', async () => {
      const pay = await s.createPayment();
      const expected = await apiBanks(pay.token);
      assert.ok(expected.length > 0, 'the API returned no banks');
      const { context, page } = await open();
      await page.goto(sessionUrl(pay.paymentId, pay.token));
      await page.getByTestId('state-choose').waitFor();

      // The token is out of the address bar, kept in sessionStorage (not localStorage).
      assert.equal(new URL(page.url()).search, '', 'query string should be stripped');
      assert.ok(!page.url().includes(pay.token));
      const stored = await page.evaluate(() => ({ s: Object.values({ ...sessionStorage }), l: Object.keys({ ...localStorage }).length }));
      assert.ok(stored.s.includes(pay.token), 'token should be in sessionStorage');
      assert.equal(stored.l, 0, 'nothing may be in localStorage');
      assert.equal(await page.locator('meta[name=referrer]').getAttribute('content'), 'no-referrer');

      // Summary and bank list.
      assert.match(await page.getByTestId('summary').innerText(), /£24\.50/);
      const shown = await page.getByTestId('bank').evaluateAll((els) => els.map((e) => e.getAttribute('data-bank-id')));
      assert.deepEqual(shown.sort(), expected.map((b) => b.id).sort());

      // Search narrows the list; no match shows a message.
      const first = expected[0];
      await page.getByPlaceholder('Search banks').fill(first.name.slice(0, 6).toUpperCase());
      assert.ok((await page.getByTestId('bank').count()) >= 1);
      await page.getByPlaceholder('Search banks').fill('zzzz-no-such-bank');
      await page.getByTestId('no-match').waitFor();
      await page.getByPlaceholder('Search banks').fill('');

      // Keyboard only: Tab from the search box to the first bank, Enter to choose it.
      await page.getByPlaceholder('Search banks').focus();
      await page.keyboard.press('Tab');
      const focusedId = await page.evaluate(() => document.activeElement?.getAttribute('data-bank-id'));
      assert.ok(focusedId, 'Tab should reach a bank button');

      const initiateResponse = page.waitForResponse((r) => r.url().endsWith('/api/payments/initiate') && r.request().method() === 'POST');
      const bankRequest = page.waitForRequest((r) => r.url().startsWith(`${MOCK_BANK_ORIGIN}/`));
      await page.keyboard.press('Enter');
      const initiated = await (await initiateResponse).json();
      assert.equal(initiated.success, true);
      const redirectUrl = initiated.data.redirectUrl;
      assert.ok(redirectUrl.startsWith(`${MOCK_BANK_ORIGIN}/pay/${pay.paymentId}?token=`), `unexpected link ${redirectUrl.split('?')[0]}`);
      await page.getByTestId('state-redirecting').waitFor();
      const reached = (await bankRequest).url();
      assert.equal(reached, redirectUrl, 'the page must go exactly to the link the API returned');
      assert.deepEqual(page.problems, []);
      await context.close();
    });

    await test('invalid token shows the link-not-valid message', async () => {
      const pay = await s.createPayment();
      const { context, page } = await open();
      await page.goto(sessionUrl(pay.paymentId, 'not-a-real-token'));
      await page.getByTestId('state-invalid').waitFor();
      assert.ok((await page.getByTestId('state-invalid').innerText()).includes(INVALID_TEXT));
      assert.equal(await page.getByTestId('bank').count(), 0);
      assert.equal(new URL(page.url()).search, '');
      await context.close();
    });

    await test('missing token shows the link-not-valid message (no API call)', async () => {
      const pay = await s.createPayment();
      const { context, page } = await open();
      let apiCalls = 0;
      page.on('request', (r) => { if (r.url().startsWith(API)) apiCalls++; });
      await page.goto(sessionUrl(pay.paymentId));
      await page.getByTestId('state-invalid').waitFor();
      assert.ok((await page.getByTestId('state-invalid').innerText()).includes(INVALID_TEXT));
      assert.equal(apiCalls, 0);
      await context.close();
    });

    await test("a token for a different payment is refused", async () => {
      const a = await s.createPayment();
      const b = await s.createPayment();
      const { context, page } = await open();
      await page.goto(sessionUrl(a.paymentId, b.token));
      await page.getByTestId('state-invalid').waitFor();
      assert.ok((await page.getByTestId('state-invalid').innerText()).includes(INVALID_TEXT));
      await context.close();
    });

    await test('an expired payment shows the expired message', async () => {
      const pay = await s.createPayment();
      assert.ok(await s.expire(pay.paymentId), 'could not move the test payment expiry into the past');
      const { context, page } = await open();
      await page.goto(sessionUrl(pay.paymentId, pay.token));
      await page.getByTestId('state-expired').waitFor();
      assert.match(await page.getByTestId('state-expired').innerText(), /expired/i);
      assert.equal(await page.getByTestId('bank').count(), 0);
      await context.close();
    });

    await test('completed and failed payments show their result (decided on the Mock bank through the API)', async () => {
      for (const [decision, testId, text] of [['approve', 'state-completed', /Payment complete/], ['reject', 'state-failed', /didn't go through/]]) {
        const pay = await s.createPayment();
        const init = await s.call('POST', `${API}/api/payments/initiate`, { headers: { authorization: `Bearer ${pay.token}` }, body: { paymentId: pay.paymentId, bankId: (await apiBanks(pay.token))[0].id } });
        await s.decide(init.json.data.redirectUrl, decision);
        const { context, page } = await open();
        await page.goto(sessionUrl(pay.paymentId, pay.token));
        await page.getByTestId(testId).waitFor();
        assert.match(await page.getByTestId(testId).innerText(), text);
        // The merchant return link is the one fixed when the payment was created.
        assert.equal(await page.getByTestId('return-link').getAttribute('href'), 'https://merchant.example/return');
        await context.close();
      }
    });

    await test('cancelling from the page cancels the payment', async () => {
      const pay = await s.createPayment();
      const { context, page } = await open();
      await page.goto(sessionUrl(pay.paymentId, pay.token));
      await page.getByTestId('cancel').click();
      await page.getByTestId('confirm-cancel').click();
      await page.getByTestId('state-cancelled').waitFor();
      const st = await s.call('GET', `${API}/api/payments/${pay.paymentId}/status`, { headers: { authorization: `Bearer ${pay.token}` } });
      assert.equal(st.json.data.status, 'CANCELLED');
      await context.close();
    });

    await test('network error shows a retry, and retry recovers; a reload keeps working without the token in the URL', async () => {
      const pay = await s.createPayment();
      const { context, page } = await open();
      await context.route(`${API}/**`, (route) => route.abort('connectionrefused'));
      await page.goto(sessionUrl(pay.paymentId, pay.token));
      await page.getByTestId('state-network').waitFor();
      assert.match(await page.getByTestId('state-network').innerText(), /Check your internet connection/);
      await context.unroute(`${API}/**`);
      await page.getByRole('button', { name: 'Try again' }).click();
      await page.getByTestId('state-choose').waitFor();
      await page.reload();
      await page.getByTestId('state-choose').waitFor();
      await context.close();
    });

    await test('an unsafe redirect URL from the API is not followed', async () => {
      const pay = await s.createPayment();
      const { context, page } = await open();
      await context.route(`${API}/api/payments/initiate`, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { paymentId: pay.paymentId, status: 'AUTHORIZING', redirectUrl: 'javascript:alert(1)' } }) }));
      await page.goto(sessionUrl(pay.paymentId, pay.token));
      await page.getByTestId('bank').first().click();
      await page.getByTestId('notice').waitFor();
      assert.equal(await page.getByTestId('state-redirecting').count(), 0);
      assert.match(await page.getByTestId('notice').innerText(), /couldn't start your payment/);
      await context.close();
    });

    await test('/sessions/<id> with a different id and no trailing slash serves the same page (dev rewrite)', async () => {
      const { context, page } = await open();
      await page.goto(`${SITE}/sessions/pay_does_not_matter`);
      await page.getByTestId('state-invalid').waitFor();
      await context.close();
    });
  } finally {
    await browser.close();
    console.log('Cleaning up test data:', JSON.stringify(await s.cleanup()));
    devServer?.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); devServer?.kill(); process.exit(1); });
