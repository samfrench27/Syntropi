import { Hono } from 'hono';
import { z } from 'zod';
import { ok, validate, valid } from '../../http';
import { authenticate, authorizeAdmin } from '../../middleware/auth';
import { logActivity } from '../../lib/activity';
import { listForOrganization, requestAccess, requestBody } from '../../services/providerRequests';
import type { AppEnv } from '../../types';

export const providersRoutes = new Hono<AppEnv>();
providersRoutes.use('*', authenticate);

/**
 * The provider catalogue as this organization sees it: every active provider with the organization's
 * access status (none | pending | approved | rejected | revoked). The Mock bank is always approved.
 */
providersRoutes.get('/', async (c) => {
  const { organizationId } = c.get('user');
  return ok(c, { providers: await listForOrganization(c.get('deps').db, organizationId) });
});

const codeParam = z.object({ code: z.string().min(1).max(50) });

// Only an organization's admin can ask for access on its behalf
providersRoutes.post('/:code/request', authorizeAdmin, validate('param', codeParam), validate('json', requestBody), async (c) => {
  const user = c.get('user');
  const { code } = valid<z.infer<typeof codeParam>>(c, 'param');
  const { note } = valid<z.infer<typeof requestBody>>(c, 'json');

  const result = await requestAccess(c.get('deps').db, { organizationId: user.organizationId, userId: user.userId, code, note });
  if (result.created) {
    await logActivity(c, {
      userId: user.userId,
      organizationId: user.organizationId,
      action: 'provider_access.request',
      details: { providerCode: code, requestId: result.requestId },
    });
  }
  return ok(c, { provider: result.provider }, result.created ? 'Access requested' : 'Access request is already pending', result.created ? 201 : 200);
});
