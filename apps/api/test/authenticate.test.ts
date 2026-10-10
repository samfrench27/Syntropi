import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';

vi.mock('../src/models/user.model', () => ({ User: { findOne: vi.fn() } }));

import { User } from '../src/models/user.model';
import { authenticate } from '../src/middleware/auth';
import { setJwksForTesting } from '../src/lib/supabase';

const ISSUER = 'https://test-project.supabase.co/auth/v1';

let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;

async function sign(
  claims: Record<string, unknown>,
  opts: { key?: CryptoKey; issuer?: string; audience?: string; expiresIn?: string } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject('supabase-user-1')
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '1h')
    .sign(opts.key ?? privateKey);
}

/** Runs the middleware and returns what it passed to next(). */
async function run(token?: string) {
  const req: any = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const next = vi.fn();
  await authenticate(req, {} as any, next);
  return { req, err: next.mock.calls[0]?.[0] as (Error & { statusCode?: number }) | undefined };
}

const goodMeta = { role: 'admin', organization_id: 'org-1', mongo_user_id: 'mongo-1' };
const mongoUser = { _id: 'mongo-1', email: 'a@example.test', role: 'admin', status: 'active', organization: 'org-1' };

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  otherPrivateKey = (await generateKeyPair('ES256')).privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'ES256', use: 'sig' };
  setJwksForTesting(createLocalJWKSet({ keys: [jwk] }));
});

beforeEach(() => {
  vi.mocked(User.findOne).mockReset();
  vi.mocked(User.findOne).mockResolvedValue(mongoUser as any);
});

describe('authenticate (Supabase access tokens)', () => {
  it('accepts a valid token and sets req.user in the shape controllers expect', async () => {
    const { req, err } = await run(await sign({ app_metadata: goodMeta }));
    expect(err).toBeUndefined();
    expect(User.findOne).toHaveBeenCalledWith({ supabaseId: 'supabase-user-1' });
    expect(req.user).toMatchObject({ userId: 'mongo-1', role: 'admin', organizationId: 'org-1' });
  });

  it('rejects a request with no token', async () => {
    const { err } = await run();
    expect(err?.statusCode).toBe(401);
  });

  it('rejects an expired token', async () => {
    const { err } = await run(await sign({ app_metadata: goodMeta }, { expiresIn: '-1m' }));
    expect(err?.statusCode).toBe(401);
  });

  it('rejects a token signed by a different key', async () => {
    const { err } = await run(await sign({ app_metadata: goodMeta }, { key: otherPrivateKey }));
    expect(err?.statusCode).toBe(401);
  });

  it('rejects the wrong issuer', async () => {
    const { err } = await run(await sign({ app_metadata: goodMeta }, { issuer: 'https://evil.example/auth/v1' }));
    expect(err?.statusCode).toBe(401);
  });

  it('rejects the wrong audience', async () => {
    const { err } = await run(await sign({ app_metadata: goodMeta }, { audience: 'anon' }));
    expect(err?.statusCode).toBe(401);
  });

  it('rejects a valid token whose user has no Mongo profile', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);
    const { err } = await run(await sign({ app_metadata: goodMeta }));
    expect(err?.statusCode).toBe(401);
  });

  it('blocks accounts that are not active', async () => {
    vi.mocked(User.findOne).mockResolvedValue({ ...mongoUser, status: 'suspended' } as any);
    const { err } = await run(await sign({ app_metadata: goodMeta }));
    expect(err?.statusCode).toBe(403);
  });

  it('rejects a token with no role claim', async () => {
    const { err } = await run(await sign({ app_metadata: {} }));
    expect(err?.statusCode).toBe(403);
  });

  it('ignores user_metadata, which the user can edit', async () => {
    const { err } = await run(await sign({ app_metadata: {}, user_metadata: { role: 'superadmin' } }));
    expect(err?.statusCode).toBe(403);
  });

  it('asks for a refresh when the role changed after the token was issued', async () => {
    vi.mocked(User.findOne).mockResolvedValue({ ...mongoUser, role: 'user' } as any);
    const { err } = await run(await sign({ app_metadata: goodMeta }));
    expect(err?.statusCode).toBe(401);
    expect(err?.message).toMatch(/refresh/i);
  });
});
