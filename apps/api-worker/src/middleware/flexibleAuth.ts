import type { Context, MiddlewareHandler } from 'hono';
import { ApiError } from '../http';
import { verifyPaymentToken } from '../lib/paymentToken';
import type { AppEnv } from '../types';
import { apiKeyAuth } from './apiKey';
import { authenticate } from './auth';

/**
 * Who is calling, whichever way they authenticated.
 *
 * Context variables set by `flexibleAuth` (in addition to what the underlying method sets:
 * `apiKey` for API keys, `user` for signed-in users, `paymentToken` for hosted-page tokens):
 *   - `organizationId`: the caller's organization id (uuid), for all three methods.
 *   - `isSuperadmin`: true only for a signed-in superadmin.
 * Read them with `callerOf(c)`.
 */
export function callerOf(c: Context<AppEnv>): { organizationId: string; superadmin: boolean } {
  const organizationId = c.get('organizationId' as never) as string | undefined;
  if (!organizationId) throw new ApiError('Authentication required', 401);
  return { organizationId, superadmin: c.get('isSuperadmin' as never) === true };
}

const set = (c: Context<AppEnv>, key: string, value: unknown) => c.set(key as never, value as never);

/**
 * Accepts an API key (`x-api-key`), a hosted-pages payment token (`Authorization: Bearer`), or a
 * signed-in user's access token (`Authorization: Bearer`). The API key permission only applies to API keys.
 */
export const flexibleAuth =
  (permission?: 'read' | 'write' | 'webhooks'): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (c.req.header('x-api-key')) {
      await apiKeyAuth(permission)(c, async () => {
        set(c, 'organizationId', c.get('apiKey').organizationId);
        set(c, 'isSuperadmin', false);
      });
      return next();
    }

    const header = c.req.header('authorization');
    if (!header?.startsWith('Bearer ') || header.length <= 7) {
      throw new ApiError('Authentication required. Provide either an API key (x-api-key header) or a bearer token (Authorization header)', 401);
    }
    const token = header.slice(7);

    // A hosted-pages token is a different kind of JWT (our own secret); anything else must be a user token
    let claims;
    try {
      claims = await verifyPaymentToken(c.get('deps').config.hostedPagesJwtSecret, token, 'hosted-pages-access');
    } catch {
      claims = undefined;
    }
    if (claims) {
      set(c, 'paymentToken', claims);
      set(c, 'organizationId', claims.organizationId);
      set(c, 'isSuperadmin', false);
      return next();
    }

    await authenticate(c, async () => {
      const user = c.get('user');
      set(c, 'organizationId', user.organizationId);
      set(c, 'isSuperadmin', user.role === 'superadmin');
    });
    return next();
  };
