// Screenshots of every state, light and dark, desktop and 390px mobile. The API is mocked so states are exact.
//   SHOTS_DIR=... NODE_PATH=... node e2e/shots.mjs   (bank on :3002)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { BANK, CHROME } from './setup.mjs';

const { chromium } = createRequire(import.meta.url)('playwright-core');
const DIR = process.env.SHOTS_DIR || './shots';
mkdirSync(DIR, { recursive: true });

const CORS = { 'access-control-allow-origin': BANK, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const view = (over = {}) => ({ success: true, data: { paymentId: 'p1', merchant: { name: 'Acme Coffee Roasters' }, organizationName: 'Acme Coffee Roasters', amount: { value: '42.50', currency: 'GBP' }, currency: 'GBP', reference: 'ORDER-10482', status: 'AUTHORIZING', expiresAt: new Date(Date.now() + 1700000).toISOString(), ...over } });
const err = (message) => ({ success: false, error: { message } });

/** Mock both endpoints. get: [status, body] | 'hang' | 'abort'. decision: same, or a body. */
async function mockApi(page, { get = [200, view()], decision = [200, { success: true, data: { status: 'COMPLETED', redirectUrl: `${BANK}/done-demo?paymentId=p1&status=COMPLETED` } }] } = {}) {
  const handle = (spec) => (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (spec === 'hang') return;
    if (spec === 'abort') return route.abort('failed');
    return route.fulfill({ status: spec[0], headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(spec[1]) });
  };
  await page.route('**/api/mock-bank/payments/p1', handle(get));
  await page.route('**/api/mock-bank/payments/p1/decision', handle(decision));
  await page.route('**/done-demo**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
}

const login = (p) => p.getByRole('button', { name: 'Log in' }).click();
const states = {
  '01-home': { url: '/', run: async () => {} },
  '02-loading': { get: 'hang', run: async (p) => p.waitForTimeout(400) },
  '03-login': { run: async (p) => p.getByText('Log in to your bank').waitFor() },
  '04-request': { run: async (p) => { await login(p); await p.getByText('Approve this payment?').waitFor(); } },
  '05-approved': { run: async (p) => { await login(p); await p.getByRole('button', { name: 'Approve payment' }).click(); await p.getByText('Return to merchant now').waitFor(); } },
  '06-rejected': { decision: [200, { success: true, data: { status: 'FAILED', redirectUrl: null } }], run: async (p) => { await login(p); await p.getByRole('button', { name: 'Reject' }).click(); await p.getByText('Payment rejected').waitFor(); } },
  '07-already-decided': { get: [200, view({ status: 'COMPLETED' })], run: async (p) => p.getByText('already decided').waitFor() },
  '08-expired': { get: [410, err('This payment has expired')], run: async (p) => p.getByText('This payment has expired').waitFor() },
  '09-invalid-token': { get: [401, err('Invalid payment access token')], run: async (p) => p.getByText('This link is not valid').waitFor() },
  '10-missing-token': { url: '/pay/p1/', run: async (p) => p.getByText('Security token missing').waitFor() },
  '11-network-error': { get: 'abort', run: async (p) => p.getByText('Cannot reach the Mock bank').waitFor() },
  '12-approving-busy': { decision: 'hang', run: async (p) => { await login(p); await p.getByRole('button', { name: 'Approve payment' }).click(); await p.getByText('Approving...').waitFor(); } },
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const scheme of ['light', 'dark']) {
  for (const [vp, size] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: size, colorScheme: scheme, deviceScaleFactor: 2 });
    for (const [name, s] of Object.entries(states)) {
      const page = await ctx.newPage();
      await mockApi(page, { get: s.get ? (s.get === 'hang' || s.get === 'abort' ? s.get : s.get) : undefined, decision: s.decision });
      await page.goto(`${BANK}${s.url || '/pay/p1/?token=abc.def.ghi'}`);
      await s.run(page);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${DIR}/${name}-${scheme}-${vp}.png`, fullPage: true });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`saved to ${DIR}`);
