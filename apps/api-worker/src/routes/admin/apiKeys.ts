import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, ok, pageInfo, pagination, validate, valid } from '../../http';
import { authenticate, authorizeAdmin, canAccessOrganization } from '../../middleware/auth';
import { logActivity } from '../../lib/activity';
import { KEY_SELECT, environment, idParam, keyOut, orgScope, uuid, where } from '../../services/adminCommon';
import { createKey, keyFields } from '../../services/apiKeys';
import type { AppEnv } from '../../types';

export const apiKeysRoutes = new Hono<AppEnv>();
apiKeysRoutes.use('*', authenticate, authorizeAdmin);

const createSchema = z.object({ ...keyFields, organizationId: uuid });

apiKeysRoutes.post('/', validate('json', createSchema), async (c) => {
  const { db } = c.get('deps');
  const actor = c.get('user');
  const body = valid<z.infer<typeof createSchema>>(c, 'json');

  orgScope(c, body.organizationId);
  if ((await db.query(`select 1 from organizations where id = $1`, [body.organizationId])).length === 0) {
    throw new ApiError('Organization not found', 404);
  }

  const created = await createKey(db, { ...body, createdBy: actor.userId });
  await logActivity(c, {
    userId: actor.userId,
    organizationId: actor.organizationId,
    action: 'admin.apiKey.create',
    details: { apiKeyId: created.id, name: body.name, organizationId: body.organizationId },
  });
  return ok(c, created.response, 'API key created successfully', 201);
});

const listQuery = z.object({
  organizationId: uuid.optional(),
  environment: environment.optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

apiKeysRoutes.get('/', validate('query', listQuery), async (c) => {
  const q = valid<z.infer<typeof listQuery>>(c, 'query');
  const { page, limit, offset } = pagination(c);
  const db = c.get('deps').db;

  const w = where();
  const org = orgScope(c, q.organizationId);
  if (org) w.add('k.organization_id = ?', org);
  if (q.environment) w.add('k.environment = ?', q.environment);
  // Only active keys by default, as in Express
  w.add('k.is_active = ?', q.isActive === undefined ? true : q.isActive === 'true');
  const clause = w.sql();

  const [{ count }] = await db.query<{ count: string }>(`select count(*) as count from api_keys k ${clause}`, [...w.params]);
  const lim = w.push(limit);
  const off = w.push(offset);
  const rows = await db.query(`${KEY_SELECT} ${clause} order by k.created_at desc, k.id desc limit ${lim} offset ${off}`, w.params);
  return ok(c, { apiKeys: rows.map(keyOut), pagination: pageInfo(Number(count), page, limit) });
});

/** A key from another organization is reported as missing, not forbidden. */
async function findVisibleKey(c: Parameters<typeof orgScope>[0], id: string) {
  const [row] = await c.get('deps').db.query<any>(`${KEY_SELECT} where k.id = $1`, [id]);
  if (!row || !canAccessOrganization(c.get('user'), row.organization_id)) throw new ApiError('API key not found', 404);
  return row;
}

apiKeysRoutes.get('/:id', validate('param', idParam), async (c) => {
  const row = await findVisibleKey(c, valid<{ id: string }>(c, 'param').id);
  return ok(c, { apiKey: keyOut(row) });
});

// Revoke: the key is deactivated and kept (the middleware cache lets go of it within 30s)
apiKeysRoutes.delete('/:id', validate('param', idParam), async (c) => {
  const { id } = valid<{ id: string }>(c, 'param');
  const actor = c.get('user');
  const key = await findVisibleKey(c, id);

  await c.get('deps').db.query(`update api_keys set is_active = false where id = $1`, [id]);
  await logActivity(c, {
    userId: actor.userId,
    organizationId: actor.organizationId,
    action: 'admin.apiKey.revoke',
    details: { apiKeyId: id, name: key.name, organizationId: key.organization_id },
  });
  return ok(c, undefined, 'API key revoked successfully');
});
