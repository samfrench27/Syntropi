import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, ok, validate, valid } from '../../http';
import { authenticate } from '../../middleware/auth';
import { logActivity } from '../../lib/activity';
import { address, httpUrl, loadOrg } from '../../services/adminCommon';
import type { AppEnv } from '../../types';

export const organizationRoutes = new Hono<AppEnv>();
organizationRoutes.use('*', authenticate);

organizationRoutes.get('/', async (c) => {
  const { db } = c.get('deps');
  const { organizationId } = c.get('user');
  const organization = await loadOrg(db, organizationId);
  if (!organization) throw new ApiError('Organization not found', 404);
  const [stats] = await db.query<{ user_count: string; api_key_count: string }>(
    `select (select count(*) from profiles where organization_id = $1) as user_count,
            (select count(*) from api_keys where organization_id = $1 and is_active) as api_key_count`,
    [organizationId],
  );
  return ok(c, { organization, stats: { userCount: Number(stats.user_count), apiKeyCount: Number(stats.api_key_count) } });
});

const updateSchema = z.object({
  contactEmail: z.string().trim().toLowerCase().email().max(254).optional(),
  billingEmail: z.string().trim().toLowerCase().email().max(254).optional(),
  address: address.optional(),
  settings: z.object({ webhookUrl: httpUrl.optional() }).optional(),
});

// Clients cannot change plan, status or limits: only contact details and the webhook URL.
organizationRoutes.put('/', validate('json', updateSchema), async (c) => {
  const { db } = c.get('deps');
  const user = c.get('user');
  const body = valid<z.infer<typeof updateSchema>>(c, 'json');

  if (user.role !== 'admin') throw new ApiError('Only organization admins can update organization details', 403);

  const [updated] = await db.query(
    `update organizations set contact_email = coalesce($2, contact_email), billing_email = coalesce($3, billing_email),
            address = coalesce($4::jsonb, address), webhook_url = coalesce($5, webhook_url)
      where id = $1 returning id`,
    [
      user.organizationId,
      body.contactEmail ?? null,
      body.billingEmail ?? null,
      body.address ? JSON.stringify(body.address) : null,
      body.settings?.webhookUrl ?? null,
    ],
  );
  if (!updated) throw new ApiError('Organization not found', 404);

  await logActivity(c, {
    userId: user.userId,
    organizationId: user.organizationId,
    action: 'client.organization.update',
    details: { updates: body },
  });
  return ok(c, { organization: await loadOrg(db, user.organizationId) }, 'Organization updated successfully');
});
