import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import { generateApiKey } from '../src/lib/crypto';
import { ISO_REASONS, ISO_STATUSES, MOCK_PRESETS, MOCK_REJECT_REASONS, isoToSyntropi, type IsoStatus } from '../src/services/isoStatus';
import { FLOW_TYPES, PAYMENT_STATUSES, createPaymentSchema } from '../src/services/payments';
import { createTestApp, type TestApp } from './helpers/app';

/**
 * The developer docs (apps/developer-docs) are hand-written. This test is what stops them drifting from the API:
 * if an endpoint, enum, example, response field or error code changes without the docs changing, it fails.
 */
const DOCS = join(__dirname, '../../developer-docs');
const spec: any = parse(readFileSync(join(DOCS, 'openapi.yaml'), 'utf8'));
const guide = (name: string) => readFileSync(join(DOCS, 'content', name), 'utf8');
const schemas = spec.components.schemas;

// Routes under these prefixes that merchants do not call with an API key, so the reference leaves them out on purpose
const UNDOCUMENTED = new Set([
  'POST /api/payments/initiate', // hosted payment page, payment-token auth
  'GET /api/payments/:paymentId/hosted', // hosted payment page
  'GET /api/payments/:paymentId/status', // hosted payment page
  'POST /api/banks/sync', // Syntropi superadmin
]);

let t: TestApp;
let key: string;

beforeAll(async () => {
  t = await createTestApp();
  const k = await generateApiKey();
  key = k.key;
  await t.admin((pg) =>
    pg.query(`insert into api_keys (organization_id, name, key_hash, key_prefix, permissions, created_by) values ($1, 'docs', $2, $3, '{read,write}', $4)`, [t.ids.orgA, k.hash, k.prefix, t.ids.userA]),
  );
}, 60000);

describe('API reference matches the API', () => {
  it('is a valid OpenAPI 3.1 document with the pieces Redoc needs', () => {
    expect(String(spec.openapi)).toMatch(/^3\.1/);
    expect(spec.info.title).toBeTruthy();
    expect(spec.servers).toEqual([{ url: 'https://api.syntropi.co.uk', description: 'Production' }]);
    // Every $ref points at something that exists
    const refs = [...JSON.stringify(spec).matchAll(/"\$ref":"#\/([^"]+)"/g)].map((m) => m[1]);
    for (const ref of refs) {
      const found = ref.split('/').reduce((node: any, part) => node?.[part], spec);
      expect(found, ref).toBeDefined();
    }
  });

  it('documents only endpoints that exist, and every merchant endpoint', () => {
    const real = new Set(t.app.routes.map((r) => `${r.method} ${r.path}`));
    const documented = new Set<string>();
    for (const [path, ops] of Object.entries<any>(spec.paths)) {
      for (const method of Object.keys(ops)) {
        const honoPath = path.replace(/\{(\w+)\}/g, ':$1');
        documented.add(`${method.toUpperCase()} ${honoPath}`);
        expect(real.has(`${method.toUpperCase()} ${honoPath}`), `${method.toUpperCase()} ${path} is documented but is not an endpoint`).toBe(true);
      }
    }
    const merchantRoutes = [...real].filter((r) => /^(GET|POST|PUT|PATCH|DELETE) \/api\/(payments|banks)(\/|$)/.test(r));
    expect(merchantRoutes.length).toBeGreaterThan(5);
    for (const r of merchantRoutes) {
      expect(documented.has(r) || UNDOCUMENTED.has(r), `${r} is an endpoint but is not in the reference`).toBe(true);
    }
  });

  it('lists the same statuses, flow types and Mock bank options as the code', () => {
    expect(schemas.PaymentStatus.enum).toEqual([...PAYMENT_STATUSES]);
    expect(schemas.IsoStatusCode.enum).toEqual([...ISO_STATUSES]);
    expect(schemas.IsoReasonCode.enum).toEqual([...ISO_REASONS]);
    expect(schemas.FlowType.enum).toEqual([...FLOW_TYPES]);
    expect(schemas.MockBankScenario.properties.preset.enum).toEqual([...MOCK_PRESETS]);
    expect(schemas.MockBankScenario.properties.rejectReason.enum).toEqual([...MOCK_REJECT_REASONS]);
  });

  it('has create-payment examples the API accepts', () => {
    const examples = spec.paths['/api/payments'].post.requestBody.content['application/json'].examples;
    expect(Object.keys(examples).length).toBeGreaterThanOrEqual(3);
    for (const [name, ex] of Object.entries<any>(examples)) {
      const parsed = createPaymentSchema.safeParse(ex.value);
      expect(parsed.success, `${name}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`).toBe(true);
    }
  });

  /** Every field of a real response is documented, and every required field is there. */
  function expectMatches(schemaName: string, actual: Record<string, unknown>, where: string) {
    const s = schemas[schemaName];
    const documented = Object.keys(s.properties);
    for (const k of Object.keys(actual)) expect(documented, `${where}: "${k}" is returned but not documented in ${schemaName}`).toContain(k);
    for (const k of s.required ?? []) expect(Object.keys(actual), `${where}: "${k}" is documented as required but not returned`).toContain(k);
  }

  it('describes exactly the fields the API returns for a payment', async () => {
    const created = await t.request('POST', '/api/payments', {
      headers: { 'x-api-key': key },
      body: {
        toAccount: { accountName: 'Acme', sortCode: '040004', accountNumber: '12345678' },
        amount: { value: '10.50', currency: 'GBP' },
        reference: 'Docs check',
        redirectUrl: 'https://shop.test/return',
      },
    });
    expect(created.status).toBe(201);
    expectMatches('CreatedPayment', created.json.data, 'create');

    const id = created.json.data.paymentId;
    const one = await t.request('GET', `/api/payments/${id}`, { headers: { 'x-api-key': key } });
    expectMatches('Payment', one.json.data, 'get');
    for (const h of one.json.data.statusHistory) expectMatches('HistoryEntry', h, 'history');
    expectMatches('IsoStatus', one.json.data.isoStatus, 'isoStatus');

    const list = await t.request('GET', '/api/payments', { headers: { 'x-api-key': key } });
    expectMatches('Payment', list.json.data.payments[0], 'list');

    const cancelled = await t.request('POST', `/api/payments/${id}/cancel`, { headers: { 'x-api-key': key } });
    expect(cancelled.status).toBe(200);
    expectMatches('Payment', cancelled.json.data, 'cancel');
    expectMatches('IsoStatus', cancelled.json.data.isoStatus, 'cancelled isoStatus');
    expect(cancelled.json.data.isoStatus.reason).toMatchObject({ code: 'CUST' });
  });

  it('describes the fields the API returns for a bank and the error shape', async () => {
    const banks = await t.request('GET', '/api/banks', { headers: { 'x-api-key': key } });
    expect(banks.status).toBe(200);
    expect(Object.keys(banks.json.data)).toEqual(expect.arrayContaining(['banks', 'pagination']));
    if (banks.json.data.banks.length > 0) expectMatches('Bank', banks.json.data.banks[0], 'bank');

    const bad = await t.request('POST', '/api/payments', { headers: { 'x-api-key': key }, body: { amount: { value: '-1', currency: 'GBP' } } });
    expect(bad.status).toBe(400);
    expect(bad.json.success).toBe(false);
    expect(bad.json.error.code).toBe('VALIDATION_FAILED');
    expect(bad.json.error.details[0]).toHaveProperty('field');
    expect(bad.json.error.details[0]).toHaveProperty('message');
  });
});

describe('developer guides match the API', () => {
  const sources = (dir: string): string =>
    readdirSync(dir, { withFileTypes: true })
      .map((e) => (e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith('.ts') ? readFileSync(join(dir, e.name), 'utf8') : ''))
      .join('\n');
  const source = sources(join(__dirname, '../src'));

  it('only names error codes the API really returns', () => {
    const codes = [...guide('09-errors.md').matchAll(/^\| `([A-Z_]{4,})` \|/gm)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThanOrEqual(8);
    for (const code of codes) expect(source, `${code} is in the Errors guide but not in the API`).toContain(`'${code}'`);
    // And every code a merchant can hit is explained
    for (const code of ['VALIDATION_FAILED', 'PROVIDER_NOT_APPROVED', 'PAYMENT_NOT_CANCELLABLE', 'MOCK_BANK_ONLY', 'PROVIDER_NOT_CONFIGURED']) {
      expect(codes, `${code} should be in the Errors guide`).toContain(code);
    }
  });

  it('has a status mapping table that matches the API for every ISO status', () => {
    const rows = [...guide('06-payment-statuses.md').matchAll(/^\| `([A-Z]{4})`([^|]*)\| [^|]+\| `([A-Z]+)` \|/gm)];
    const seen = new Set<string>();
    for (const [, code, extra, syntropi] of rows) {
      const iso = code as IsoStatus;
      if (iso === 'RJCT') {
        // "RJCT, any reason except NOAS" is the failed row; "RJCT with NOAS" is the expired row
        const noas = !/except/.test(extra) && /NOAS/.test(extra);
        const reason = noas ? 'NOAS' : 'NARR';
        expect(isoToSyntropi({ status: 'RJCT', reason }), `RJCT ${reason}`).toBe(syntropi);
      } else {
        expect(isoToSyntropi({ status: iso }), iso).toBe(syntropi);
      }
      seen.add(`${iso}${iso === 'RJCT' ? (!/except/.test(extra) && /NOAS/.test(extra) ? ':NOAS' : ':other') : ''}`);
    }
    for (const iso of ISO_STATUSES) expect([...seen].some((s) => s.startsWith(iso)), `${iso} is missing from the mapping table`).toBe(true);
    expect(seen.has('RJCT:NOAS') && seen.has('RJCT:other')).toBe(true);
  });

  it('gives the Mock bank timings and options the API really uses', () => {
    const page = guide('07-testing-with-the-mock-bank.md');
    for (const preset of MOCK_PRESETS) expect(page).toContain(`\`${preset}\``);
    for (const reason of MOCK_REJECT_REASONS) expect(page).toContain(`\`${reason}\``);
    expect(page).toContain('`mockBank`');
    expect(page).toContain('MOCK_BANK_ONLY');
  });

  it('names every guide page it links to', () => {
    const slugs = new Set(readdirSync(join(DOCS, 'content')).map((f) => guide(f).match(/^slug: (.+)$/m)![1]));
    for (const file of readdirSync(join(DOCS, 'content'))) {
      for (const [, slug] of guide(file).matchAll(/\]\(\/guides\/([a-z-]+)\/\)/g)) {
        expect(slugs.has(slug), `${file} links to /guides/${slug}/ which does not exist`).toBe(true);
      }
    }
  });
});
