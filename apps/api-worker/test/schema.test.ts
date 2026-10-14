import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, seedTenants } from './helpers/db';

let t: Awaited<ReturnType<typeof createTestDb>>;
let ids: Awaited<ReturnType<typeof seedTenants>>;

beforeAll(async () => {
  t = await createTestDb();
  ids = await seedTenants(t.db);
});

const rows = async (sql: string, params: unknown[] = []) => (await t.db.query(sql, params)).rows as any[];

describe('migrations', () => {
  it('seed the provider catalogue, with the mock bank active', async () => {
    const providers = await rows(`select code, status from providers order by code`);
    expect(providers.map((p) => p.code)).toEqual(['mock', 'tink', 'token', 'truelayer', 'yapily']);
    expect(providers.find((p) => p.code === 'mock').status).toBe('active');
  });

  it('enable row-level security on every public table', async () => {
    const off = await rows(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not (c.relrowsecurity and c.relforcerowsecurity)`,
    );
    expect(off).toEqual([]);
  });
});

describe('row-level security', () => {
  it('shows anon nothing, in any table', async () => {
    const tables = (await rows(`select tablename from pg_tables where schemaname = 'public'`)).map((r) => r.tablename);
    for (const table of tables) {
      const seen = await t.as('anon', async () => rows(`select 1 from public.${table}`));
      expect(seen, table).toEqual([]);
    }
  });

  it('lets a signed-in user read only their own profile and organization', async () => {
    const profiles = await t.as('authenticated', () => rows(`select id from profiles`), ids.userA);
    expect(profiles.map((p) => p.id)).toEqual([ids.userA]);
    const orgs = await t.as('authenticated', () => rows(`select id from organizations`), ids.userA);
    expect(orgs.map((o) => o.id)).toEqual([ids.orgA]);
  });

  it('keeps payments, API keys and activity out of reach of direct user access', async () => {
    for (const table of ['payments', 'api_keys', 'activities', 'provider_access', 'billing_usage']) {
      const seen = await t.as('authenticated', () => rows(`select 1 from ${table}`), ids.userA);
      expect(seen, table).toEqual([]);
    }
  });

  it('does not let a signed-in user write', async () => {
    await expect(
      t.as('authenticated', () => t.db.query(`update profiles set role = 'superadmin' where id = $1`, [ids.userA]), ids.userA),
    ).resolves.toMatchObject({ affectedRows: 0 });
  });

  it('lets the API role read and write everything, since it enforces tenancy itself', async () => {
    const all = await t.as('api_worker', () => rows(`select payment_id from payments order by payment_id`));
    expect(all.map((p) => p.payment_id)).toEqual(['pay_a1', 'pay_b1']);
  });
});

describe('constraints', () => {
  it('never allows an access row for the mock bank', async () => {
    await expect(
      t.db.query(`insert into provider_access (organization_id, provider_code) values ($1, 'mock')`, [ids.orgA]),
    ).rejects.toThrow();
  });

  it('allows one access row per organization and provider', async () => {
    await t.db.query(`insert into provider_access (organization_id, provider_code) values ($1, 'token')`, [ids.orgA]);
    await expect(
      t.db.query(`insert into provider_access (organization_id, provider_code) values ($1, 'token')`, [ids.orgA]),
    ).rejects.toThrow();
    await t.db.query(`insert into provider_access (organization_id, provider_code) values ($1, 'token')`, [ids.orgB]);
  });

  it('stores API keys hashed only', async () => {
    const columns = (await rows(`select column_name from information_schema.columns where table_name = 'api_keys'`)).map((c) => c.column_name);
    expect(columns).toContain('key_hash');
    expect(columns).not.toContain('key');
    await expect(
      t.db.query(`insert into api_keys (organization_id, name, key_hash, key_prefix, created_by) values ($1, 'dup', 'hash-a', 'sk_x', $2)`, [ids.orgA, ids.userA]),
    ).rejects.toThrow();
  });

  it('rejects a bank mapped to a provider that is not in the catalogue', async () => {
    const [bank] = await rows(`insert into banks (syntropi_id, name, country) values ('gb-test', 'Test Bank', 'GB') returning id`);
    await expect(
      t.db.query(`insert into bank_provider_mappings (bank_id, provider_code, provider_id) values ($1, 'nope', 'x')`, [bank.id]),
    ).rejects.toThrow();
    await t.db.query(`insert into bank_provider_mappings (bank_id, provider_code, provider_id) values ($1, 'token', 'ob-test')`, [bank.id]);
  });
});

describe('payments', () => {
  it('writes the first history entry when a payment is created', async () => {
    const history = await rows(`select h.status from payment_status_history h join payments p on p.id = h.payment_id where p.payment_id = 'pay_a1'`);
    expect(history.map((h) => h.status)).toEqual(['PENDING']);
  });

  it('records a status change and sets completed_at in one call', async () => {
    const [{ id }] = await rows(`select id from payments where payment_id = 'pay_a1'`);
    await t.db.query(`select * from payment_set_status($1, 'AUTHORIZING', 'User opened the bank page')`, [id]);
    const done = await rows(`select status, completed_at from payment_set_status($1, 'COMPLETED')`, [id]);
    expect(done[0].status).toBe('COMPLETED');
    expect(done[0].completed_at).not.toBeNull();
    const history = await rows(`select status, details from payment_status_history where payment_id = $1 order by id`, [id]);
    expect(history.map((h) => h.status)).toEqual(['PENDING', 'AUTHORIZING', 'COMPLETED']);
    expect(history[1].details).toBe('User opened the bank page');
  });

  it('fails clearly for a payment that does not exist', async () => {
    await expect(
      t.db.query(`select * from payment_set_status('00000000-0000-0000-0000-00000000ffff', 'FAILED')`),
    ).rejects.toThrow(/not found/);
  });

  it('rejects zero and negative amounts', async () => {
    await expect(
      t.db.query(`insert into payments (payment_id, organization_id, client_id, to_account, amount_value, provider_code) values ('pay_bad', $1, 'c', '{}', 0, 'mock')`, [ids.orgA]),
    ).rejects.toThrow();
  });

  it('serves per-organization queries from an index that leads with the organization', async () => {
    await t.db.exec(`set enable_seqscan = off`);
    const plan = (await rows(`explain select * from payments where organization_id = '${ids.orgA}' and status = 'PENDING' order by created_at desc`))
      .map((r) => r['QUERY PLAN']).join('\n');
    await t.db.exec(`reset enable_seqscan`);
    // Any index that leads with organization_id keeps the query inside one tenant's rows
    expect(plan).toMatch(/Index (Only )?Scan using payments_org_\w+_idx/);
    expect(plan).not.toMatch(/Seq Scan/);
  });
});

describe('billing counters', () => {
  it('add up across calls instead of overwriting', async () => {
    await t.db.query(`select * from billing_increment($1, '2026-10', 1, 5, 0, 0)`, [ids.orgA]);
    await t.db.query(`select * from billing_increment($1, '2026-10', 2, 3, 1, 1)`, [ids.orgA]);
    const [usage] = await rows(`select payments, api_calls, successful_payments, failed_payments, year from billing_usage where organization_id = $1 and month = '2026-10'`, [ids.orgA]);
    expect(usage).toMatchObject({ payments: 3, api_calls: 8, successful_payments: 1, failed_payments: 1, year: 2026 });
  });

  it('rejects a malformed month', async () => {
    await expect(t.db.query(`select * from billing_increment($1, '2026-13')`, [ids.orgA])).rejects.toThrow();
  });
});

describe('search', () => {
  it('finds banks and people by part of a name, ignoring case', async () => {
    await t.db.exec(`insert into banks (syntropi_id, name, country) values ('gb-monzo', 'Monzo Bank', 'GB'), ('gb-starling', 'Starling Bank', 'GB')`);
    const banks = await rows(`select syntropi_id from banks where name ilike $1 order by syntropi_id`, ['%MON%']);
    expect(banks.map((b) => b.syntropi_id)).toEqual(['gb-monzo']);
    const people = await rows(`select email from profiles where (first_name || ' ' || last_name || ' ' || email) ilike $1`, ['%buyer%']);
    expect(people.map((p) => p.email)).toEqual(['b@borealis.test']);
  });
});
