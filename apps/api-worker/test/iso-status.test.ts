import { beforeEach, describe, expect, it } from 'vitest';
import { mapTokenIso, mapTokenStatus } from '../src/adapters/payments/token';
import { generateApiKey } from '../src/lib/crypto';
import { buildApprovalTimeline, defaultIsoFor, isoToSyntropi, parseIsoCode, ISO_STATUSES, type IsoState } from '../src/services/isoStatus';
import { settleDueMockPayments } from '../src/services/payments';
import { createTestApp, type TestApp } from './helpers/app';

describe('ISO 20022 to Syntropi status', () => {
  it.each<[IsoState, string]>([
    [{ status: 'RCVD' }, 'PENDING'],
    [{ status: 'PDNG' }, 'AUTHORIZING'],
    [{ status: 'ACTC' }, 'AUTHORIZED'],
    [{ status: 'ACCP' }, 'SUBMITTED'],
    [{ status: 'ACSP' }, 'ACCEPTED'],
    [{ status: 'ACSC' }, 'COMPLETED'],
    [{ status: 'CANC' }, 'CANCELLED'],
    [{ status: 'CANC', reason: 'CUST' }, 'CANCELLED'],
    [{ status: 'RJCT' }, 'FAILED'],
    [{ status: 'RJCT', reason: 'AM04' }, 'FAILED'],
    [{ status: 'RJCT', reason: 'NARR' }, 'FAILED'],
    [{ status: 'RJCT', reason: 'NOAS' }, 'EXPIRED'],
  ])('%j is %s', (iso, expected) => {
    expect(isoToSyntropi(iso)).toBe(expected);
  });

  it('round-trips: the default ISO status for each Syntropi status maps back to it', () => {
    for (const s of ['PENDING', 'AUTHORIZING', 'AUTHORIZED', 'SUBMITTED', 'ACCEPTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'] as const) {
      expect(isoToSyntropi(defaultIsoFor(s))).toBe(s);
    }
    expect(new Set(ISO_STATUSES).size).toBe(8);
  });

  it('folds variants of accepted into the nearest stage and does not guess at unknown codes', () => {
    expect(parseIsoCode('acwc')).toBe('ACSP');
    expect(parseIsoCode('ACWP')).toBe('ACSP');
    expect(parseIsoCode('ACFC')).toBe('ACCP');
    expect(parseIsoCode('ACIS')).toBe('ACSC');
    expect(parseIsoCode('WHAT')).toBeNull();
    expect(parseIsoCode(undefined)).toBeNull();
  });
});

describe('Token.io statuses', () => {
  it.each<[string, IsoState, string]>([
    ['INITIATION_PENDING_REDIRECT_AUTH', { status: 'PDNG' }, 'AUTHORIZING'],
    ['PENDING_AUTHENTICATION', { status: 'PDNG' }, 'AUTHORIZING'],
    ['INITIATION_PENDING_REDEMPTION', { status: 'ACTC' }, 'AUTHORIZED'],
    ['PENDING_SUBMISSION', { status: 'ACTC' }, 'AUTHORIZED'],
    ['INITIATION_PROCESSING', { status: 'ACCP' }, 'SUBMITTED'],
    ['SUBMITTED', { status: 'ACCP' }, 'SUBMITTED'],
    ['SETTLEMENT_IN_PROGRESS', { status: 'ACSP' }, 'ACCEPTED'],
    ['INITIATION_COMPLETED', { status: 'ACSP' }, 'ACCEPTED'],
    ['SETTLEMENT_COMPLETED', { status: 'ACSC' }, 'COMPLETED'],
    ['INITIATION_REJECTED_INSUFFICIENT_FUNDS', { status: 'RJCT', reason: 'AM04' }, 'FAILED'],
    ['INITIATION_REJECTED', { status: 'RJCT', reason: 'NARR' }, 'FAILED'],
    ['SETTLEMENT_INCOMPLETE', { status: 'RJCT', reason: 'NARR' }, 'FAILED'],
    ['INITIATION_DECLINED', { status: 'CANC', reason: 'CUST' }, 'CANCELLED'],
    ['INITIATION_EXPIRED', { status: 'RJCT', reason: 'NOAS' }, 'EXPIRED'],
    ['EXPIRED', { status: 'RJCT', reason: 'NOAS' }, 'EXPIRED'],
    ['SOMETHING_NEW', { status: 'RCVD' }, 'PENDING'],
  ])('%s is %j (%s)', (token, iso, syntropi) => {
    expect(mapTokenIso(token)).toEqual(iso);
    expect(mapTokenStatus(token)).toBe(syntropi);
  });
});

describe('Mock bank timelines', () => {
  const now = new Date('2026-10-11T10:00:00.000Z');
  const shape = (steps: ReturnType<typeof buildApprovalTimeline>) => steps.map((s) => [s.iso, (Date.parse(s.at) - now.getTime()) / 1000]);

  it('instant is one ACSC now', () => {
    expect(shape(buildApprovalTimeline(now, undefined))).toEqual([['ACSC', 0]]);
    expect(shape(buildApprovalTimeline(now, { preset: 'instant' }))).toEqual([['ACSC', 0]]);
  });
  it('realistic: ACTC now, ACCP 5s, ACSP 15s, ACSC 60s', () => {
    expect(shape(buildApprovalTimeline(now, { preset: 'realistic' }))).toEqual([['ACTC', 0], ['ACCP', 5], ['ACSP', 15], ['ACSC', 60]]);
  });
  it('slow: 30s, 2 minutes, 10 minutes', () => {
    expect(shape(buildApprovalTimeline(now, { preset: 'slow' }))).toEqual([['ACTC', 0], ['ACCP', 30], ['ACSP', 120], ['ACSC', 600]]);
  });
  it('custom: completes after N seconds, with the steps at 10% and 40%', () => {
    expect(shape(buildApprovalTimeline(now, { completeAfterSeconds: 100 }))).toEqual([['ACTC', 0], ['ACCP', 10], ['ACSP', 40], ['ACSC', 100]]);
    expect(shape(buildApprovalTimeline(now, { preset: 'slow', completeAfterSeconds: 20 }))).toEqual([['ACTC', 0], ['ACCP', 2], ['ACSP', 8], ['ACSC', 20]]);
  });
  it('custom: very short delays drop the middle steps instead of going out of order', () => {
    expect(shape(buildApprovalTimeline(now, { completeAfterSeconds: 1 }))).toEqual([['ACTC', 0], ['ACSC', 1]]);
    expect(shape(buildApprovalTimeline(now, { completeAfterSeconds: 2 }))).toEqual([['ACTC', 0], ['ACCP', 1], ['ACSC', 2]]);
    const steps = buildApprovalTimeline(now, { completeAfterSeconds: 3 });
    const times = steps.map((s) => Date.parse(s.at));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe('payments carry ISO status', () => {
  let t: TestApp;
  let key: string;
  let skew = 0;
  const advance = (seconds: number) => (skew += seconds * 1000);

  const api = (method: string, path: string, body?: unknown) => t.request(method, path, { headers: { 'x-api-key': key }, body });
  const bank = (id: string, tok: string, decision: unknown, scenario?: unknown) =>
    t.request('POST', `/api/mock-bank/payments/${id}/decision`, { token: tok, body: { decision, ...(scenario ? { scenario } : {}) } });
  const base = { toAccount: { accountName: 'Acme', sortCode: '040004', accountNumber: '12345678' }, amount: { value: '10.50', currency: 'GBP' }, redirectUrl: 'https://shop.test/return' };

  async function create(over: Record<string, unknown> = {}) {
    const res = await api('POST', '/api/payments', { ...base, ...over });
    expect(res.status).toBe(201);
    return { res, id: res.json.data.paymentId as string, tok: new URL(res.json.data.redirectUrl).searchParams.get('token')! };
  }
  const iso = async (id: string) => {
    const d = (await api('GET', `/api/payments/${id}`)).json.data;
    return { code: d.isoStatus.code, reason: d.isoStatus.reason?.code, status: d.status as string };
  };

  beforeEach(async () => {
    skew = 0;
    t = await createTestApp({ now: () => new Date(Date.now() + skew) });
    const k = await generateApiKey();
    key = k.key;
    await t.admin((pg) => pg.query(`insert into api_keys (organization_id, name, key_hash, key_prefix, permissions, created_by) values ($1, 'k', $2, $3, '{read,write}', $4)`, [t.ids.orgA, k.hash, k.prefix, t.ids.userA]));
  }, 60000);

  it('create, get and list all return isoStatus next to status', async () => {
    const { res, id } = await create();
    expect(res.json.data.isoStatus).toMatchObject({ code: 'PDNG', name: 'Pending' });
    expect(res.json.data.isoStatus).not.toHaveProperty('reason');
    const one = (await api('GET', `/api/payments/${id}`)).json.data;
    expect(one.isoStatus).toMatchObject({ code: 'PDNG', name: 'Pending', description: expect.any(String) });
    expect(one.statusHistory.map((h: any) => h.isoStatus.code)).toEqual(['RCVD', 'PDNG']);
    const list = (await api('GET', '/api/payments')).json.data.payments;
    expect(list[0].isoStatus.code).toBe('PDNG');
    expect(list[0].statusHistory.every((h: any) => h.isoStatus.code)).toBe(true);
  });

  it('approve with no scenario is instant: ACSC / COMPLETED', async () => {
    const { id, tok } = await create();
    expect((await bank(id, tok, 'approve')).json.data.status).toBe('COMPLETED');
    expect(await iso(id)).toEqual({ code: 'ACSC', reason: undefined, status: 'COMPLETED' });
  });

  it('the realistic preset moves ACTC, ACCP, ACSP, ACSC as time passes, and the history shows each step', async () => {
    const { id, tok } = await create();
    const res = await bank(id, tok, 'approve', { preset: 'realistic' });
    expect(res.json.data.status).toBe('AUTHORIZED');
    expect(new URL(res.json.data.redirectUrl).searchParams.get('status')).toBe('AUTHORIZED');
    expect((await iso(id)).code).toBe('ACTC');

    advance(4);
    expect((await iso(id)).code).toBe('ACTC'); // not due yet: nothing changes
    advance(2);
    expect(await iso(id)).toMatchObject({ code: 'ACCP', status: 'SUBMITTED' });
    advance(10);
    expect(await iso(id)).toMatchObject({ code: 'ACSP', status: 'ACCEPTED' });
    advance(60);
    expect(await iso(id)).toMatchObject({ code: 'ACSC', status: 'COMPLETED' });

    const hist = (await api('GET', `/api/payments/${id}`)).json.data.statusHistory.map((h: any) => h.isoStatus.code);
    expect(hist).toEqual(['RCVD', 'PDNG', 'ACTC', 'ACCP', 'ACSP', 'ACSC']);
    const [u] = await t.rows(`select successful_payments from billing_usage where organization_id = $1`, [t.ids.orgA]);
    expect(u.successful_payments).toBe(1); // counted once
  });

  it('several overdue steps apply in order in one read', async () => {
    const { id, tok } = await create();
    await bank(id, tok, 'approve', { completeAfterSeconds: 30 });
    advance(120);
    expect(await iso(id)).toMatchObject({ code: 'ACSC', status: 'COMPLETED' });
    const hist = (await api('GET', `/api/payments/${id}`)).json.data.statusHistory.map((h: any) => h.isoStatus.code);
    expect(hist).toEqual(['RCVD', 'PDNG', 'ACTC', 'ACCP', 'ACSP', 'ACSC']);
  });

  it('the per-minute job applies due steps for payments nobody is reading, and leaves nothing scheduled', async () => {
    const { id, tok } = await create();
    await bank(id, tok, 'approve', { preset: 'realistic' });
    advance(61);
    expect(await settleDueMockPayments(t.deps)).toBe(1);
    const [row] = await t.rows(`select status, scheduled_transitions from payments where payment_id = $1`, [id]);
    expect(row.status).toBe('COMPLETED');
    expect(JSON.parse(typeof row.scheduled_transitions === 'string' ? row.scheduled_transitions : JSON.stringify(row.scheduled_transitions))).toEqual([]);
    expect(await settleDueMockPayments(t.deps)).toBe(0);
  });

  it('cancelling mid-way stops the remaining steps', async () => {
    const { id, tok } = await create();
    await bank(id, tok, 'approve', { preset: 'slow' });
    expect((await api('POST', `/api/payments/${id}/cancel`)).status).toBe(200);
    advance(3600);
    expect(await iso(id)).toEqual({ code: 'CANC', reason: 'CUST', status: 'CANCELLED' });
  });

  it('a scenario set at creation is offered to the bank page and used on approve', async () => {
    const { id, tok } = await create({ mockBank: { preset: 'realistic' } });
    const page = await t.request('GET', `/api/mock-bank/payments/${id}`, { token: tok });
    expect(page.json.data.scenario).toEqual({ preset: 'realistic' });
    await bank(id, tok, 'approve');
    expect((await iso(id)).code).toBe('ACTC');
  });

  it.each([
    ['AM04', 'AM04'],
    ['AC04', 'AC04'],
    ['NARR', 'NARR'],
    [undefined, 'CUST'],
  ])('reject with reason %s gives RJCT/%s and FAILED', async (chosen, expected) => {
    const { id, tok } = await create();
    const res = await bank(id, tok, 'reject', chosen ? { rejectReason: chosen } : undefined);
    expect(res.json.data.status).toBe('FAILED');
    expect(await iso(id)).toEqual({ code: 'RJCT', reason: expected, status: 'FAILED' });
  });

  it('an unanswered payment expires as RJCT/NOAS', async () => {
    const { id } = await create();
    await t.admin((pg) => pg.query(`update payments set expires_at = now() - interval '1 second' where payment_id = $1`, [id]));
    expect(await iso(id)).toEqual({ code: 'RJCT', reason: 'NOAS', status: 'EXPIRED' });
  });

  it('mockBank validation: bounds are enforced and other providers are refused', async () => {
    for (const bad of [0, 3601, 1.5]) {
      expect((await api('POST', '/api/payments', { ...base, mockBank: { completeAfterSeconds: bad } })).status).toBe(400);
    }
    expect((await api('POST', '/api/payments', { ...base, mockBank: { rejectReason: 'XX99' } })).status).toBe(400);
    expect((await api('POST', '/api/payments', { ...base, mockBank: { completeAfterSeconds: 1 } })).status).toBe(201);
    expect((await api('POST', '/api/payments', { ...base, mockBank: { completeAfterSeconds: 3600 } })).status).toBe(201);
    await t.admin((pg) => pg.query(`insert into provider_access (organization_id, provider_code, status) values ($1, 'token', 'approved')`, [t.ids.orgA]));
    const other = await api('POST', '/api/payments', { ...base, provider: 'token', mockBank: { preset: 'slow' } });
    expect(other.status).toBe(400);
    expect(other.json.error.code ?? other.json.code).toBe('MOCK_BANK_ONLY');
  });

  it("another organization's key cannot see the ISO status or timeline of this payment", async () => {
    const { id } = await create();
    const k2 = await generateApiKey();
    await t.admin((pg) => pg.query(`insert into api_keys (organization_id, name, key_hash, key_prefix, permissions, created_by) values ($1, 'k2', $2, $3, '{read,write}', $4)`, [t.ids.orgB, k2.hash, k2.prefix, t.ids.userB]));
    const res = await t.request('GET', `/api/payments/${id}`, { headers: { 'x-api-key': k2.key } });
    expect(res.status).toBe(404);
  });
});

describe('migration backfill', () => {
  it('maps every Syntropi status to its ISO status', async () => {
    const t = await createTestApp();
    const expected: Record<string, [string, string | null]> = {
      PENDING: ['RCVD', null], AUTHORIZING: ['PDNG', null], AUTHORIZED: ['ACTC', null], SUBMITTED: ['ACCP', null], ACCEPTED: ['ACSP', null],
      COMPLETED: ['ACSC', null], FAILED: ['RJCT', 'NARR'], CANCELLED: ['CANC', 'CUST'], EXPIRED: ['RJCT', 'NOAS'],
    };
    for (const [status, [code, reason]] of Object.entries(expected)) {
      const [r] = await t.rows(`select iso::text as iso, reason from iso_for_status($1::payment_status)`, [status]);
      expect([status, r.iso, r.reason]).toEqual([status, code, reason]);
    }
  });
});
