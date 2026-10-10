// Screenshots of every state: light and dark, desktop and 390px mobile.
//   NODE_PATH=<dir>/node_modules node e2e/shots.mjs [outDir]
// Real payments are used where the API can produce the state; the rest (loading, processing, server error,
// no banks, unsafe link) are real pages with one API response replaced.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { setup, SITE, API } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const OUT = process.argv[2] || '/private/tmp/claude-501/-Users-samfrench-Developer-GitHub-syntropi-syntropi/27612947-ffbe-4740-8b73-b3f87f0c87d6/scratchpad/hosted-shots';
mkdirSync(OUT, { recursive: true });

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#0b6b4f"/><path d="M8 28V16l12-6 12 6v12z" fill="#fff"/></svg>`;
const json = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

const s = await setup();
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const bankId = async (pay) => (await s.call('GET', `${API}/api/banks?limit=100`, { headers: { authorization: `Bearer ${pay.token}` } })).json.data.banks[0].id;
  const make = async (final) => {
    const pay = await s.createPayment();
    if (final === 'cancel') await s.call('POST', `${API}/api/payments/${pay.paymentId}/cancel`, { headers: { authorization: `Bearer ${pay.token}` } });
    if (final === 'expire') await s.expire(pay.paymentId);
    if (final === 'approve' || final === 'reject') {
      const init = await s.call('POST', `${API}/api/payments/initiate`, { headers: { authorization: `Bearer ${pay.token}` }, body: { paymentId: pay.paymentId, bankId: await bankId(pay) } });
      await s.decide(init.json.data.redirectUrl, final);
    }
    return pay;
  };
  const pays = { open: await make(), cancel: await make('cancel'), expire: await make('expire'), approve: await make('approve'), reject: await make('reject') };

  const states = [
    { name: '01-loading', pay: 'open', ready: '[data-testid=state-loading]', setup: async (c) => c.route(`${API}/api/payments/*/hosted`, async (r) => { await new Promise((x) => setTimeout(x, 30000)); r.abort(); }) },
    { name: '02-choose-bank', pay: 'open', ready: '[data-testid=bank]' },
    { name: '03-choose-no-match', pay: 'open', ready: '[data-testid=bank]', act: async (p) => p.getByPlaceholder('Search banks').fill('zzz') },
    { name: '04-choose-notice', pay: 'open', ready: '[data-testid=bank]', setup: async (c) => c.route(`${API}/api/payments/initiate`, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"error":{"message":"boom"}}' })), act: async (p) => { await p.getByTestId('bank').first().click(); await p.getByTestId('notice').waitFor(); } },
    { name: '05-choose-confirm-cancel', pay: 'open', ready: '[data-testid=bank]', act: async (p) => p.getByTestId('cancel').click() },
    { name: '06-choose-focus', pay: 'open', ready: '[data-testid=bank]', act: async (p) => { await p.getByPlaceholder('Search banks').focus(); await p.keyboard.press('Tab'); } },
    { name: '07-no-banks', pay: 'open', ready: '[data-testid=no-banks]', setup: async (c) => c.route(`${API}/api/banks*`, (r) => r.fulfill(json({ banks: [], pagination: { total: 0, page: 1, limit: 100, pages: 0 } }))) },
    { name: '08-redirecting', pay: 'open', ready: '[data-testid=bank]', setup: async (c) => c.route('http://localhost:3002/**', async (r) => { await new Promise((x) => setTimeout(x, 30000)); r.abort(); }), fast: true, act: async (p) => { await p.getByTestId('bank').first().click({ noWaitAfter: true }); for (let i = 0; i < 40; i++) { if (await p.evaluate(() => !!document.querySelector('[data-testid=state-redirecting]')).catch(() => false)) break; await p.waitForTimeout(150); } } },
    { name: '09-processing', pay: 'open', ready: '[data-testid=state-processing]', setup: async (c, pay) => c.route(`${API}/api/payments/${pay.paymentId}/hosted`, async (r) => { const real = await (await r.fetch()).json(); real.data.status = 'SUBMITTED'; r.fulfill(json(real.data)); }) },
    { name: '10-completed', pay: 'approve', ready: '[data-testid=state-completed]' },
    { name: '11-failed', pay: 'reject', ready: '[data-testid=state-failed]' },
    { name: '12-cancelled', pay: 'cancel', ready: '[data-testid=state-cancelled]' },
    { name: '13-expired', pay: 'expire', ready: '[data-testid=state-expired]' },
    { name: '14-invalid-link', pay: 'open', token: 'nope', ready: '[data-testid=state-invalid]' },
    { name: '15-network-error', pay: 'open', ready: '[data-testid=state-network]', setup: async (c) => c.route(`${API}/**`, (r) => r.abort('connectionrefused')) },
    { name: '16-server-error', pay: 'open', ready: '[data-testid=state-server]', setup: async (c) => c.route(`${API}/api/payments/*/hosted`, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"error":{"message":"x"}}' })) },
  ];
  const viewports = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };

  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  for (const st of states) {
    if (only.length && !only.some((o) => st.name.startsWith(o))) continue;
    for (const scheme of ['light', 'dark']) {
      for (const [vp, size] of Object.entries(viewports)) {
        const context = await browser.newContext({ viewport: size, colorScheme: scheme, deviceScaleFactor: vp === 'mobile' ? 2 : 1 });
        await context.route('https://example.com/logos/financial-trust.png', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO }));
        const pay = pays[st.pay];
        await st.setup?.(context, pay);
        const page = await context.newPage();
        await page.goto(`${SITE}/sessions/${pay.paymentId}?token=${encodeURIComponent(st.token ?? pay.token)}`, { waitUntil: 'commit' });
        await page.waitForSelector(st.ready, { timeout: 20000 });
        await st.act?.(page);
        if (!st.fast) {
          await page.waitForTimeout(500);
          // No horizontal scroll at any width.
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
          if (overflow) console.log(`  OVERFLOW in ${st.name} ${scheme} ${vp}`);
        }
        await page.screenshot({ path: path.join(OUT, `${st.name}-${scheme}-${vp}.png`), fullPage: true });
        await context.close();
      }
    }
    console.log('  shot', st.name);
  }
} finally {
  await browser.close();
  console.log('Cleaning up:', JSON.stringify(await s.cleanup()));
}
