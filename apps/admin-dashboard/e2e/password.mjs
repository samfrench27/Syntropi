/**
 * Drives the password UI in a real browser: the show/hide eye, the strength meter and checklist, the
 * create-user forms, the admin "send reset email" button and the reset-password page.
 *
 *   NODE_PATH=<dir containing playwright-core>/node_modules node e2e/password.mjs
 *
 * Environment: BASE_URL (default http://localhost:3000), API_URL (default http://127.0.0.1:8787/api),
 * SHOTS (a folder: also saves screenshots), PASSWORD (the test accounts' password).
 * Signup is never submitted and the reset email is faked in the browser, so no accounts are created and no
 * email is sent. The reset-page check needs the Worker's .dev.vars (to mint a recovery link for a test user).
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// playwright-core is not a dependency of this repo; load it from NODE_PATH (ES imports ignore NODE_PATH)
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require('playwright-core'); } catch { return require('playwright'); }
})();

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://127.0.0.1:8787/api';
const SHOTS = process.env.SHOTS;
const PASSWORD = process.env.PASSWORD || 'DesignReview1!';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' -> ' + detail}`);

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const errors = [];

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.width ?? 1100, height: opts.height ?? 900 }, colorScheme: opts.dark ? 'dark' : 'light' });
  await ctx.addInitScript((t) => { try { localStorage.setItem('syntropi_theme', t); } catch {} }, opts.dark ? 'dark' : 'light');
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${e.message.slice(0, 80)}`));
  return page;
}

const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const typeInto = async (page, selector, text) => { await page.fill(selector, ''); await page.type(selector, text, { delay: 0 }); };
const type = (page, id) => page.getAttribute(`#${id}`, 'type');

/** What the checklist currently says: { label: met } */
async function checklist(page) {
  return page.$$eval('ul[aria-label="Password requirements"] li', (lis) =>
    Object.fromEntries(lis.map((li) => [li.querySelector('span')?.textContent?.trim(), /\(met\)/.test(li.textContent || '')])));
}
const strengthLabel = (page) => page.$eval('[aria-live="polite"]', (e) => e.textContent.replace('Password strength: ', '').trim()).catch(() => '');
const submitDisabled = (page) => page.$eval('button[type=submit]', (b) => b.disabled);

// ---------------------------------------------------------------- signup
{
  const page = await newPage();
  await page.goto(`${BASE}/signup/`);
  await page.waitForSelector('#password');

  // the eye
  const eye = page.getByRole('button', { name: /show password/i });
  check('signup: eye button is there and says "Show password"', (await eye.count()) === 1);
  check('signup: password is hidden by default', (await type(page, 'password')) === 'password');
  check('signup: eye starts unpressed', (await eye.getAttribute('aria-pressed')) === 'false');
  await page.fill('#password', 'Harbor-Lamps-71');
  await eye.click();
  check('signup: clicking the eye reveals the password', (await type(page, 'password')) === 'text');
  const hide = page.getByRole('button', { name: /hide password/i });
  check('signup: the button now says "Hide password" and is pressed', (await hide.count()) === 1 && (await hide.getAttribute('aria-pressed')) === 'true');
  check('signup: what was typed is intact', (await page.inputValue('#password')) === 'Harbor-Lamps-71');
  await hide.click();
  check('signup: clicking again hides it', (await type(page, 'password')) === 'password');

  // keyboard only
  await page.focus('#password');
  await page.keyboard.press('Tab');
  check('signup: Tab from the field lands on the eye button', (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Show password');
  await page.keyboard.press('Enter');
  check('signup: Enter toggles it', (await type(page, 'password')) === 'text');
  await page.keyboard.press('Space');
  check('signup: Space toggles it back', (await type(page, 'password')) === 'password');

  // the checklist before typing: shown, nothing ticked, no meter yet
  await page.fill('#password', '');
  const empty = await checklist(page);
  check('signup: requirements are listed before typing, none ticked', Object.keys(empty).length >= 5 && Object.values(empty).every((v) => v === false), JSON.stringify(empty));
  check('signup: no strength label until typing starts', (await strengthLabel(page)) === '');
  check('signup: submit is disabled with no password', await submitDisabled(page));
  await shot(page, 'signup-empty-light');

  // typing: boundary at 12
  await typeInto(page, '#password', 'abc');
  check('signup: "abc" is Weak', (await strengthLabel(page)) === 'Weak');
  await typeInto(page, '#password', 'Harbor-Lam1'); // 11
  let c = await checklist(page);
  check('signup: 11 characters fails only the length rule', c['At least 12 characters'] === false && c['A lowercase letter'] && c['An uppercase letter'] && c['A number'], JSON.stringify(c));
  check('signup: 11 characters keeps submit disabled', await submitDisabled(page));
  await typeInto(page, '#password', 'Harbor-Lamp1'); // 12
  c = await checklist(page);
  check('signup: 12 characters ticks every rule', Object.values(c).every(Boolean), JSON.stringify(c));
  check('signup: 12 characters is Fair', (await strengthLabel(page)) === 'Fair');
  check('signup: submit is enabled once the rules are met', !(await submitDisabled(page)));
  await shot(page, 'signup-fair-light');
  await typeInto(page, '#password', 'Harbor-Lamps-71'); // 15
  check('signup: 15 characters is Good', (await strengthLabel(page)) === 'Good');
  await typeInto(page, '#password', 'Misty-Anchor-Lamps-Quietly-7');
  check('signup: a long passphrase is Strong', (await strengthLabel(page)) === 'Strong');
  await shot(page, 'signup-strong-light');

  // common passwords
  for (const pw of ['Password1234', 'p@ssw0rd1234', 'Qwerty123456']) {
    await typeInto(page, '#password', pw);
    c = await checklist(page);
    check(`signup: "${pw}" is refused as a common password`, c['Not a commonly used password'] === false && (await submitDisabled(page)) && (await strengthLabel(page)) === 'Weak', JSON.stringify(c));
  }
  await shot(page, 'signup-common-light');

  // personal information
  await typeInto(page, '#email', 'quiet.harbor@acme.test');
  await typeInto(page, '#firstName', 'Quiet');
  await typeInto(page, '#password', 'Quiet-Anchor-Lamps-7');
  c = await checklist(page);
  check('signup: the "name or email" rule appears once there is something to compare', "Doesn't contain your name or email" in c);
  check('signup: a password containing the first name fails it and blocks submit', c["Doesn't contain your name or email"] === false && (await submitDisabled(page)));
  await typeInto(page, '#password', 'Misty-Anchor-Lamps-7');
  c = await checklist(page);
  check('signup: a different password passes it', c["Doesn't contain your name or email"] === true && !(await submitDisabled(page)));
  await page.close();
}

// ---------------------------------------------------------------- login
{
  const page = await newPage();
  await page.goto(`${BASE}/login/`);
  await page.waitForSelector('#password');
  check('login: has the eye toggle', (await page.getByRole('button', { name: /show password/i }).count()) === 1);
  check('login: no strength meter (it is not choosing a password)', (await page.$('ul[aria-label="Password requirements"]')) === null);
  await page.fill('#password', 'something');
  await page.getByRole('button', { name: /show password/i }).click();
  check('login: the eye reveals the password', (await type(page, 'password')) === 'text');
  await page.close();
}

// ---------------------------------------------------------------- dark and mobile views
{
  const dark = await newPage({ dark: true });
  await dark.goto(`${BASE}/signup/`); await dark.waitForSelector('#password');
  await typeInto(dark, '#password', 'Harbor-Lamp1');
  await shot(dark, 'signup-fair-dark');
  await typeInto(dark, '#password', 'Password1234');
  await shot(dark, 'signup-common-dark');
  await dark.close();
  const mobile = await newPage({ width: 390, height: 844 });
  await mobile.goto(`${BASE}/signup/`); await mobile.waitForSelector('#password');
  await typeInto(mobile, '#password', 'Harbor-Lamps-71');
  await shot(mobile, 'signup-good-mobile');
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('signup: no sideways scrolling at 390px wide', !overflow);
  const target = await mobile.$eval('button[aria-label="Show password"]', (b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check('signup: the eye button is at least 44px square on a phone', target.w >= 44 && target.h >= 44, JSON.stringify(target));
  await mobile.close();
}

// ---------------------------------------------------------------- admin forms (need the API and test accounts)
async function signIn(page, email) {
  await page.goto(`${BASE}/login/`);
  await page.fill('#email', email); await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(/dashboard/, { timeout: 30000 });
}
try {
  const page = await newPage();
  await signIn(page, 'superadmin@syntropi.test');

  for (const path of ['/platform-admin/users/create/']) {
    await page.goto(BASE + path);
    await page.waitForSelector('#password');
    check(`${path}: both password fields have an eye`, (await page.getByRole('button', { name: /show password/i }).count()) === 2);
    check(`${path}: no meter while the optional password is empty`, (await page.$('ul[aria-label="Password requirements"]')) === null);
    await page.fill('#password', 'abc');
    await page.waitForSelector('ul[aria-label="Password requirements"]');
    check(`${path}: the meter appears once a password is typed`, (await strengthLabel(page)) === 'Weak');
    await shot(page, 'create-user-weak-light');
  }

  // the user detail page: no "Change password" fields, a reset button instead
  const token = await page.evaluate(() => localStorage.getItem('syntropi_admin_token'));
  const users = await (await fetch(`${API}/admin/users?limit=50`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const target = users.data.users.find((u) => u.email === 'developer@acme.test') || users.data.users.find((u) => u.role === 'user');
  await page.goto(`${BASE}/platform-admin/users/${target.id}/`);
  await page.waitForSelector('text=Send password reset email', { timeout: 20000 });
  check('user page: the old password fields are gone', (await page.$('#newPassword')) === null && (await page.$('input[type=password]')) === null);
  check('user page: there is a "Send password reset email" button', (await page.getByRole('button', { name: /send password reset email/i }).count()) === 1);
  // fake the API so no real email is sent
  await page.route('**/send-password-reset', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'Password reset email sent', data: { sent: true } }) }));
  await page.getByRole('button', { name: /send password reset email/i }).click();
  await page.waitForSelector('[role=status]:has-text("Reset email sent")', { timeout: 10000 }).then(() => check('user page: a success message names the person emailed', true)).catch(() => check('user page: a success message names the person emailed', false, 'not shown'));
  await shot(page, 'user-reset-sent-light');
  await page.unroute('**/send-password-reset');
  await page.route('**/send-password-reset', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'x' } }) }));
  await page.getByRole('button', { name: /send password reset email/i }).click();
  await page.waitForSelector('[role=status]:has-text("few times")', { timeout: 10000 }).then(() => check('user page: a rate-limit shows a plain message', true)).catch(() => check('user page: a rate-limit shows a plain message', false, 'not shown'));
  await page.close();
} catch (e) {
  check('admin forms: could not run (is the API up and are the test accounts there?)', false, String(e.message).slice(0, 160));
}

// ---------------------------------------------------------------- reset-password page (needs a recovery link)
try {
  const vars = Object.fromEntries(readFileSync(process.env.DEV_VARS || '../api-worker/.dev.vars', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  const res = await fetch(`${vars.SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: vars.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${vars.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email: 'developer@acme.test', redirect_to: `${BASE}/reset-password/` }),
  });
  const link = (await res.json()).action_link;
  const page = await newPage();
  await page.goto(link);
  await page.waitForSelector('#password', { timeout: 30000 });
  check('reset: both fields have an eye', (await page.getByRole('button', { name: /show password/i }).count()) === 2);
  check('reset: the requirements are listed', Object.keys(await checklist(page)).length >= 5);
  check('reset: submit is disabled until the rules are met', await submitDisabled(page));
  await typeInto(page, '#password', 'Harbor-Lamps-71');
  check('reset: a good password rates Good', (await strengthLabel(page)) === 'Good');
  await typeInto(page, '#confirm', 'Harbor-Lamps-72');
  check('reset: a mismatch is called out inline', (await page.getByText('The two passwords don’t match.').count()) >= 1);
  check('reset: submit stays disabled while they differ', await submitDisabled(page));
  await typeInto(page, '#confirm', 'Harbor-Lamps-71');
  check('reset: submit enables when they match', !(await submitDisabled(page)));
  await shot(page, 'reset-ready-light');
  await page.close();
} catch (e) {
  check('reset page: could not run', false, String(e.message).slice(0, 160));
}

check('no page errors during the run', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
