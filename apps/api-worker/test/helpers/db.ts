import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const MIGRATIONS = join(__dirname, '../../../../supabase/migrations');

/**
 * An in-process Postgres (no Docker) with just enough of Supabase's own objects stubbed that the
 * real migrations run unchanged: the auth schema, auth.uid(), and the anon/authenticated roles.
 */
// Building the schema takes about half a second, so it is done once per test file and every
// test gets a cheap copy of the result.
let template: Promise<File | Blob> | undefined;

async function buildTemplate() {
  const db = new PGlite({ extensions: { pg_trgm } });

  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create role anon nologin;
    create role authenticated nologin;
  `);

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }

  // The test identity service writes auth.users directly, as Supabase Auth would.
  await db.exec(`
    grant usage on schema auth to api_worker;
    grant all on auth.users to api_worker;
  `);

  // Supabase grants the public tables to anon and authenticated by default. Row-level security,
  // not missing grants, is what has to keep them out, so mirror that here.
  await db.exec(`
    grant usage on schema public to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    grant execute on all functions in schema public to anon, authenticated;
  `);

  const dump = await db.dumpDataDir('none');
  await db.close();
  return dump;
}

/**
 * An in-process Postgres (no Docker) with just enough of Supabase's own objects stubbed that the
 * real migrations run unchanged: the auth schema, auth.uid(), and the anon/authenticated roles.
 */
export async function createTestDb() {
  template ??= buildTemplate();
  const db = new PGlite({ extensions: { pg_trgm }, loadDataDir: await template });
  await db.waitReady;

  /** Run SQL as a given database role, optionally as a signed-in user, then restore the superuser. */
  async function as<T>(role: 'anon' | 'authenticated' | 'api_worker', fn: () => Promise<T>, userId?: string): Promise<T> {
    if (userId) await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
    await db.exec(`set role ${role}`);
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
      await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    }
  }

  return { db, as };
}

/** Two organizations, each with a user, an API key and a payment. */
export async function seedTenants(db: PGlite) {
  const ids = {
    orgA: '00000000-0000-0000-0000-0000000000a1',
    orgB: '00000000-0000-0000-0000-0000000000b1',
    userA: '00000000-0000-0000-0000-0000000000a2',
    userB: '00000000-0000-0000-0000-0000000000b2',
  };
  await db.exec(`
    insert into organizations (id, name, contact_email) values
      ('${ids.orgA}', 'Acme Coffee', 'a@acme.test'),
      ('${ids.orgB}', 'Borealis Retail', 'b@borealis.test');
    insert into auth.users (id, email) values ('${ids.userA}', 'a@acme.test'), ('${ids.userB}', 'b@borealis.test');
    insert into profiles (id, email, first_name, last_name, role, organization_id) values
      ('${ids.userA}', 'a@acme.test', 'Ada', 'Admin', 'admin', '${ids.orgA}'),
      ('${ids.userB}', 'b@borealis.test', 'Bo', 'Buyer', 'admin', '${ids.orgB}');
    insert into api_keys (organization_id, name, key_hash, key_prefix, created_by) values
      ('${ids.orgA}', 'A key', 'hash-a', 'sk_aaaa', '${ids.userA}'),
      ('${ids.orgB}', 'B key', 'hash-b', 'sk_bbbb', '${ids.userB}');
    insert into payments (payment_id, organization_id, client_id, to_account, amount_value, provider_code) values
      ('pay_a1', '${ids.orgA}', 'client-a', '{"accountName":"Acme"}', 10.50, 'mock'),
      ('pay_b1', '${ids.orgB}', 'client-b', '{"accountName":"Borealis"}', 20.00, 'mock');
  `);
  return ids;
}
