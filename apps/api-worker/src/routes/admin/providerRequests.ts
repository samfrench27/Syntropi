import { Hono } from 'hono';
import { z } from 'zod';
import { ok, pageInfo, pagination, validate, valid } from '../../http';
import { authenticate, authorizeSuperAdmin } from '../../middleware/auth';
import { logActivity } from '../../lib/activity';
import {
  ACCESS_STATUSES,
  getRequest,
  listRequests,
  optionalNoteBody,
  requiredNoteBody,
  review,
  uuidText,
} from '../../services/providerRequests';
import type { AppEnv } from '../../types';

export const providerRequestsRoutes = new Hono<AppEnv>();
providerRequestsRoutes.use('*', authenticate, authorizeSuperAdmin);

const listQuery = z.object({ status: z.enum(ACCESS_STATUSES).optional(), organizationId: uuidText.optional() });
const idParam = z.object({ id: uuidText });

/** The approval queue. `counts` covers every request, not just the filtered page, for the sidebar badge. */
providerRequestsRoutes.get('/', validate('query', listQuery), async (c) => {
  const { status, organizationId } = valid<z.infer<typeof listQuery>>(c, 'query');
  const { page, limit, offset } = pagination(c);
  const { requests, total, counts } = await listRequests(c.get('deps').db, { status, organizationId, limit, offset });
  return ok(c, { requests, pagination: pageInfo(total, page, limit), counts });
});

providerRequestsRoutes.get('/:id', validate('param', idParam), async (c) => {
  const { id } = valid<z.infer<typeof idParam>>(c, 'param');
  return ok(c, { request: await getRequest(c.get('deps').db, id) });
});

function decision(verb: 'approve' | 'reject' | 'revoke', body: typeof optionalNoteBody | typeof requiredNoteBody) {
  providerRequestsRoutes.post(`/:id/${verb}`, validate('param', idParam), validate('json', body), async (c) => {
    const user = c.get('user');
    const { id } = valid<z.infer<typeof idParam>>(c, 'param');
    const { note } = valid<{ note?: string }>(c, 'json');

    const result = await review(c.get('deps').db, { id, verb, reviewerId: user.userId, note });
    // The entry belongs to the organization that was decided on, so it shows in that organization's activity too
    await logActivity(c, {
      userId: user.userId,
      organizationId: result.organizationId,
      action: `admin.provider_access.${verb}`,
      details: { providerCode: result.providerCode, requestId: id, note: note || null },
    });
    return ok(c, { request: result.request }, `Request ${verb === 'approve' ? 'approved' : verb === 'reject' ? 'rejected' : 'revoked'}`);
  });
}
decision('approve', optionalNoteBody);
decision('reject', requiredNoteBody);
decision('revoke', requiredNoteBody);
