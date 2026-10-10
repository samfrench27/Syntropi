import type { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { AppEnv } from './types';

/** An error that becomes an HTTP response. Anything else becomes a 500 with no detail. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const ok = <T>(c: Context<AppEnv>, data: T, message?: string, status: 200 | 201 = 200) =>
  c.json({ success: true, ...(message ? { message } : {}), data }, status);

/** Validate a request part against a zod schema. Failure is a 400 with the problems listed. */
export function validate<T extends z.ZodType>(source: 'json' | 'query' | 'param', schema: T): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    let input: unknown;
    if (source === 'json') input = await c.req.json().catch(() => ({}));
    else if (source === 'query') input = c.req.query();
    else input = c.req.param();

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      throw new ApiError('Validation failed', 400, 'VALIDATION_FAILED', issues);
    }
    c.set(`valid_${source}` as never, parsed.data as never);
    await next();
  };
}

/** The validated value for a request part (set by `validate`). */
export const valid = <T>(c: Context<AppEnv>, source: 'json' | 'query' | 'param'): T => c.get(`valid_${source}` as never) as T;

/** page and limit from the query string, clamped. */
export function pagination(c: Context<AppEnv>, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(c.req.query('limit') || String(defaultLimit), 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export const pageInfo = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit),
});

export const uuidSchema = z.string().uuid();
