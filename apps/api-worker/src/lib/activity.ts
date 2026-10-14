import type { Context } from 'hono';
import type { Db } from '../db';
import type { AppEnv } from '../types';

export interface ActivityInput {
  userId?: string | null;
  organizationId: string;
  action: string;
  details?: unknown;
}

/** Write one audit entry. Never throws: a failed log must not fail the request. */
export async function logActivity(c: Context<AppEnv>, a: ActivityInput): Promise<void> {
  const db: Db = c.get('deps').db;
  const write = db
    .query(
      `insert into activities (user_id, organization_id, action, details, ip_address, user_agent)
       values ($1, $2, $3, $4::jsonb, $5, $6)`,
      [
        a.userId ?? null,
        a.organizationId,
        a.action,
        JSON.stringify(a.details ?? {}),
        c.req.header('cf-connecting-ip') ?? null,
        c.req.header('user-agent') ?? null,
      ],
    )
    .then(() => undefined)
    .catch((e) => console.warn(`Could not log activity ${a.action}: ${e?.message}`));

  // In Workers the write can finish after the response; in tests there is no execution context.
  try {
    c.executionCtx.waitUntil(write);
  } catch {
    await write;
  }
}
