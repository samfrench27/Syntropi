import type { Context, MiddlewareHandler } from 'hono';
import { ApiError } from '../http';
import type { AppEnv } from '../types';

/** Per-caller limit, counted in Postgres so every Worker instance shares it. */
export const rateLimit =
  (opts: { name: string; limit: number; windowSeconds: number; key?: (c: Context<AppEnv>) => string }): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const caller = opts.key?.(c) ?? c.req.header('cf-connecting-ip') ?? 'unknown';
    const [{ allowed }] = await c.get('deps').db.query<{ allowed: boolean }>(
      `select rate_limit_hit($1, $2, $3) as allowed`,
      [`${opts.name}:${caller}`, opts.windowSeconds, opts.limit],
    );
    if (!allowed) throw new ApiError('Too many requests. Try again later.', 429);
    await next();
  };
