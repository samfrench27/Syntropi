import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, ok, pageInfo, pagination, validate, valid } from '../../http';
import { authenticate } from '../../middleware/auth';
import { logActivity } from '../../lib/activity';
import { KEY_SELECT, idParam, keyOut } from '../../services/adminCommon';
import { createKey, keyFields } from '../../services/apiKeys';
import type { AppEnv } from '../../types';

export const apiKeysRoutes = new Hono<AppEnv>();
apiKeysRoutes.use('*', authenticate);

// Everything here is confined to the caller's own organization (from their profile, never the request)

apiKeysRoutes.get('/', async (c) => {
  const { organizationId } = c.get('user');
  const { page, limit, offset } = pagination(c);
  const db = c.get('deps').db;
  const [{ count }] = await db.query<{ count: string }>(
    `select count(*) as count from api_keys where organization_id = $1 and is_active`,
    [organizationId],
  );
  const rows = await db.query(
    `${KEY_SELECT} where k.organization_id = $1 and k.is_active order by k.created_at desc, k.id desc limit $2 offset $3`,
    [organizationId, limit, offset],
  );
  return ok(c, { apiKeys: rows.map(keyOut), pagination: pageInfo(Number(count), page, limit) });
});

apiKeysRoutes.get('/:id', validate('param', idParam), async (c) => {
  const { id } = valid<{ id: string }>(c, 'param');
  const [row] = await c.get('deps').db.query(`${KEY_SELECT} where k.id = $1 and k.organization_id = $2`, [id, c.get('user').organizationId]);
  if (!row) throw new ApiError('API key not found', 404);
  return ok(c, { apiKey: keyOut(row) });
});

const createSchema = z.object(keyFields);

apiKeysRoutes.post('/', validate('json', createSchema), async (c) => {
  const user = c.get('user');
  const body = valid<z.infer<typeof createSchema>>(c, 'json');
  const created = await createKey(c.get('deps').db, { ...body, organizationId: user.organizationId, createdBy: user.userId });
  await logActivity(c, {
    userId: user.userId,
    organizationId: user.organizationId,
    action: 'client.apiKey.create',
    details: { apiKeyId: created.id, name: body.name },
  });
  return ok(c, created.response, 'API key created successfully', 201);
});

apiKeysRoutes.delete('/:id', validate('param', idParam), async (c) => {
  const { id } = valid<{ id: string }>(c, 'param');
  const user = c.get('user');
  const [key] = await c.get('deps').db.query<{ name: string }>(
    `update api_keys set is_active = false where id = $1 and organization_id = $2 returning name`,
    [id, user.organizationId],
  );
  if (!key) throw new ApiError('API key not found', 404);
  await logActivity(c, {
    userId: user.userId,
    organizationId: user.organizationId,
    action: 'client.apiKey.revoke',
    details: { apiKeyId: id, name: key.name },
  });
  return ok(c, undefined, 'API key revoked successfully');
});
