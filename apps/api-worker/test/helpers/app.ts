import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';
import type { PGlite } from '@electric-sql/pglite';
import { buildApp } from '../../src/app';
import type { Db } from '../../src/db';
import type { Identity, AppMetadata } from '../../src/identity';
import type { AppDeps } from '../../src/types';
import { clearApiKeyCache } from '../../src/middleware/apiKey';
import { createTestDb, seedTenants } from './db';

export const SUPABASE_URL = 'https://test-project.supabase.co';
export const ISSUER = `${SUPABASE_URL}/auth/v1`;

/** A password that passes the policy (12+ characters, mixed case, a number, not common). */
export const STRONG_PASSWORD = 'Quiet-Harbor-Lamps-71';

export function pgliteDb(pg: PGlite): Db {
  const wrap = (runner: Pick<PGlite, 'query'>): Db => ({
    query: async (text, params = []) => (await runner.query(text, params as any[])).rows as any,
    tx: (fn) => pg.transaction((tx) => fn(wrap(tx as any))),
  });
  return wrap(pg);
}

/** An in-memory stand-in for Supabase Auth that also keeps auth.users in step, so foreign keys hold. */
export function fakeIdentity(db: Db) {
  const registered = new Set<string>();
  const metadata = new Map<string, AppMetadata>();
  const banned = new Set<string>();
  const calls: string[] = [];
  const resets: { email: string; redirectTo: string }[] = [];
  const failures: Record<string, Error | undefined> = {};

  const maybeFail = (name: string) => {
    if (failures[name]) throw failures[name];
  };

  const identity: Identity = {
    async signUp({ email }) {
      calls.push('signUp');
      maybeFail('signUp');
      if (registered.has(email)) return { id: '', alreadyRegistered: true };
      const [row] = await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
      registered.add(email);
      return { id: row.id, alreadyRegistered: false };
    },
    async createUser({ email, password, meta }) {
      calls.push(password ? 'createUser:password' : 'createUser:invite');
      maybeFail('createUser');
      const [row] = await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
      registered.add(email);
      metadata.set(row.id, meta);
      return row.id;
    },
    async setAppMetadata(id, meta) {
      calls.push('setAppMetadata');
      maybeFail('setAppMetadata');
      metadata.set(id, { ...metadata.get(id), ...meta });
    },
    async setActive(id, active) {
      calls.push(`setActive:${active}`);
      maybeFail('setActive');
      active ? banned.delete(id) : banned.add(id);
    },
    async sendPasswordReset({ email, redirectTo }) {
      calls.push('sendPasswordReset');
      maybeFail('sendPasswordReset');
      resets.push({ email, redirectTo });
    },
    async deleteUser(id) {
      calls.push('deleteUser');
      maybeFail('deleteUser');
      await db.query(`delete from auth.users where id = $1`, [id]);
      metadata.delete(id);
    },
  };

  return { identity, registered, metadata, banned, calls, resets, failures };
}

export interface TokenOptions {
  role?: string | null;
  organizationId?: string;
  expiresIn?: string;
  issuer?: string;
  audience?: string;
  userMetadata?: Record<string, unknown>;
  key?: CryptoKey;
}

/**
 * A complete Worker app on in-memory Postgres, running as the same restricted database role the
 * real API uses, with Supabase replaced by local fakes and every outbound call blocked.
 */
export async function createTestApp(overrides: Partial<AppDeps> = {}) {
  const t = await createTestDb();
  const ids = await seedTenants(t.db);
  const db = pgliteDb(t.db);

  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const otherKey = (await generateKeyPair('ES256')).privateKey;
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256', use: 'sig' };

  const fake = fakeIdentity(db);
  const outbound: { url: string; init?: RequestInit }[] = [];

  const deps: AppDeps = {
    db,
    identity: fake.identity,
    jwks: createLocalJWKSet({ keys: [jwk] }),
    config: {
      supabaseUrl: SUPABASE_URL,
      dashboardUrl: 'http://localhost:3000',
      hostedPagesUrl: 'http://localhost:3001',
      mockBankUrl: 'http://localhost:3002',
      hostedPagesJwtSecret: 'test-hosted-pages-secret-0123456789',
      corsOrigins: ['http://localhost:3000'],
    },
    env: {},
    fetch: async (input, init) => {
      outbound.push({ url: String(input), init });
      throw new Error(`Unexpected outbound request in test: ${String(input)}`);
    },
    now: () => new Date(),
    ...overrides,
  };

  const app = buildApp(deps);
  clearApiKeyCache();

  // From here on every query runs as the API's own role, so missing grants show up as test failures
  await t.db.exec('set role api_worker');
  /** Run setup SQL as the superuser (e.g. to seed rows), then go back to the API role. */
  const admin = async <T>(fn: (pg: PGlite) => Promise<T>): Promise<T> => {
    await t.db.exec('reset role');
    try {
      return await fn(t.db);
    } finally {
      await t.db.exec('set role api_worker');
    }
  };

  async function tokenFor(userId: string, opts: TokenOptions = {}) {
    const [profile] = (await db.query<any>(`select role, organization_id from profiles where id = $1`, [userId]));
    const meta = opts.role === null ? {} : { role: opts.role ?? profile?.role, organization_id: opts.organizationId ?? profile?.organization_id };
    return new SignJWT({ app_metadata: meta, ...(opts.userMetadata ? { user_metadata: opts.userMetadata } : {}) })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(userId)
      .setIssuer(opts.issuer ?? ISSUER)
      .setAudience(opts.audience ?? 'authenticated')
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? '1h')
      .sign(opts.key ?? privateKey);
  }

  /** Call the API as a signed-in user (or anonymously when no user is given). */
  async function request(method: string, path: string, opts: { user?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    const token = opts.token ?? (opts.user ? await tokenFor(opts.user) : undefined);
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await app.request(path, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, json, res };
  }

  const rows = async (sql: string, params: unknown[] = []) => db.query<any>(sql, params);

  return { app, deps, db, pg: t.db, ids, fake, outbound, admin, tokenFor, request, rows, keys: { privateKey, otherKey } };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
