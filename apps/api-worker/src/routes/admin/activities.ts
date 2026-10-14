import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, ok, pageInfo, pagination, validate, valid } from '../../http';
import { authenticate, authorizeAdmin, canAccessOrganization } from '../../middleware/auth';
import { ACTIVITY_SELECT, activityOut, dateString, idParam, listActivities, orgScope, uuid } from '../../services/adminCommon';
import type { AppEnv } from '../../types';

export const activitiesRoutes = new Hono<AppEnv>();
activitiesRoutes.use('*', authenticate, authorizeAdmin);

const listQuery = z.object({
  userId: uuid.optional(),
  organizationId: uuid.optional(),
  action: z.string().trim().max(100).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
});

// Org admins only ever see their own organization's activity; superadmins see everything.
activitiesRoutes.get('/', validate('query', listQuery), async (c) => {
  const q = valid<z.infer<typeof listQuery>>(c, 'query');
  const { page, limit, offset } = pagination(c);
  const { activities, total } = await listActivities(
    c.get('deps').db,
    { ...q, organizationId: orgScope(c, q.organizationId) },
    { limit, offset },
  );
  return ok(c, { activities, pagination: pageInfo(total, page, limit) });
});

activitiesRoutes.get('/:id', validate('param', idParam), async (c) => {
  const { id } = valid<{ id: string }>(c, 'param');
  const [row] = await c.get('deps').db.query<any>(`${ACTIVITY_SELECT} where a.id = $1`, [id]);
  if (!row || !canAccessOrganization(c.get('user'), row.organization_id)) throw new ApiError('Activity not found', 404);
  return ok(c, { activity: activityOut(row) });
});
