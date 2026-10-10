import type { MiddlewareHandler } from 'hono';
import { sha256Hex } from '../lib/crypto';
import { ApiError } from '../http';
import type { ApiKeyAuth, AppEnv } from '../types';

interface Cached {
  key: ApiKeyAuth;
  active: boolean;
  expiresAt: number | null;
  orgActive: boolean;
  lastUsedWrittenAt: number;
  cachedAt: number;
}

// Keys are looked up on every API call, so a short in-memory cache keeps the database off the hot path.
// A revoked key stops working within CACHE_MS at the latest.
const CACHE_MS = 30_000;
const LAST_USED_EVERY_MS = 5 * 60_000;
const cache = new Map<string, Cached>();

export const clearApiKeyCache = () => cache.clear();

/** Server-to-server calls with `x-api-key`. Sets c.var.apiKey. */
export const apiKeyAuth =
  (permission?: 'read' | 'write' | 'webhooks'): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const deps = c.get('deps');
    const presented = c.req.header('x-api-key');
    if (!presented) throw new ApiError('API key required', 401);

    const hash = await sha256Hex(presented);
    const now = deps.now().getTime();
    let hit = cache.get(hash);

    if (!hit || now - hit.cachedAt > CACHE_MS) {
      const [row] = await deps.db.query<any>(
        `select k.id, k.name, k.organization_id, k.permissions, k.environment, k.is_active, k.expires_at, o.status as org_status
           from api_keys k join organizations o on o.id = k.organization_id
          where k.key_hash = $1`,
        [hash],
      );
      if (!row) {
        cache.delete(hash);
        throw new ApiError('Invalid API key', 401);
      }
      hit = {
        key: { id: row.id, name: row.name, organizationId: row.organization_id, permissions: row.permissions, environment: row.environment },
        active: row.is_active,
        expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
        orgActive: row.org_status === 'active',
        lastUsedWrittenAt: hit?.lastUsedWrittenAt ?? 0,
        cachedAt: now,
      };
      cache.set(hash, hit);
    }

    if (!hit.active) throw new ApiError('API key is inactive', 401);
    if (hit.expiresAt !== null && hit.expiresAt < now) throw new ApiError('API key has expired', 401);
    if (!hit.orgActive) throw new ApiError('Organization is not active', 403);
    if (permission && !hit.key.permissions.includes(permission)) throw new ApiError(`API key lacks ${permission} permission`, 403);

    // Bookkeeping that must not slow or fail the request
    const bookkeeping: Promise<unknown>[] = [];
    if (now - hit.lastUsedWrittenAt > LAST_USED_EVERY_MS) {
      hit.lastUsedWrittenAt = now;
      bookkeeping.push(deps.db.query(`update api_keys set last_used = now() where id = $1`, [hit.key.id]));
    }
    const month = deps.now().toISOString().slice(0, 7);
    bookkeeping.push(deps.db.query(`select billing_increment($1, $2, 0, 1, 0, 0)`, [hit.key.organizationId, month]));
    const settled = Promise.allSettled(bookkeeping);
    try {
      c.executionCtx.waitUntil(settled);
    } catch {
      await settled;
    }

    c.set('apiKey', hit.key);
    await next();
  };
