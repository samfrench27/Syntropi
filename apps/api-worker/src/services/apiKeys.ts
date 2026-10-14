import { z } from 'zod';
import type { Db } from '../db';
import { generateApiKey } from '../lib/crypto';
import { KEY_SELECT, environment, keyOut, permission, withId } from './adminCommon';

export const keyFields = {
  name: z.string().trim().min(1).max(100),
  environment: environment.optional(),
  permissions: z.array(permission).max(10).optional(),
};

/**
 * Create a key. Only the hash is stored. The plaintext is in the result once and cannot be read
 * back. `data.key` is where the dashboard reads it; `data.apiKey` carries the same record the
 * list endpoints return, plus the plaintext.
 */
export async function createKey(
  db: Db,
  input: { organizationId: string; createdBy: string; name: string; environment?: 'sandbox' | 'production'; permissions?: string[] },
) {
  const { key, hash, prefix } = await generateApiKey();
  const [{ id }] = await db.query<{ id: string }>(
    `insert into api_keys (organization_id, name, key_hash, key_prefix, environment, permissions, created_by)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [input.organizationId, input.name, hash, prefix, input.environment ?? 'sandbox', input.permissions ?? [], input.createdBy],
  );
  const [row] = await db.query(`${KEY_SELECT} where k.id = $1`, [id]);
  const record = keyOut(row);
  return {
    id,
    key,
    row: record,
    response: withId({
      id,
      name: record.name,
      key,
      keyPrefix: record.keyPrefix,
      environment: record.environment,
      permissions: record.permissions,
      createdAt: record.createdAt,
      apiKey: { ...record, key },
    }),
  };
}
