import { Hono } from 'hono';
import { z } from 'zod';
import { ok, pageInfo, pagination, validate, valid } from '../../http';
import { authenticate } from '../../middleware/auth';
import { dateString, listActivities } from '../../services/adminCommon';
import type { AppEnv } from '../../types';

export const activitiesRoutes = new Hono<AppEnv>();
activitiesRoutes.use('*', authenticate);

const listQuery = z.object({
  action: z.string().trim().max(100).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
});

// Always the caller's own organization. An `organizationId` in the query string is ignored.
activitiesRoutes.get('/', validate('query', listQuery), async (c) => {
  const q = valid<z.infer<typeof listQuery>>(c, 'query');
  const { page, limit, offset } = pagination(c);
  const { activities, total } = await listActivities(
    c.get('deps').db,
    { ...q, organizationId: c.get('user').organizationId },
    { limit, offset },
  );
  return ok(c, { activities, pagination: pageInfo(total, page, limit) });
});
