import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, ok, pageInfo, pagination, validate, valid } from '../../http';
import { authenticate, authorizeAdmin, authorizeSuperAdmin } from '../../middleware/auth';
import { logActivity } from '../../lib/activity';
import { likePattern } from '../../db';
import {
  KEY_SELECT,
  ORG_SELECT,
  USER_SELECT,
  activeStatus,
  address,
  allowedProvidersByOrg,
  httpUrl,
  idParam,
  isForeignKeyViolation,
  keyOut,
  listActivities,
  loadOrg,
  orgOut,
  orgPlan,
  orgScope,
  userOut,
  uuid,
  where,
} from '../../services/adminCommon';
import type { AppEnv } from '../../types';

export const organizationsRoutes = new Hono<AppEnv>();
organizationsRoutes.use('*', authenticate, authorizeAdmin);

const settingsSchema = z.object({
  rateLimit: z.number().int().min(1).max(1_000_000).optional(),
  webhookUrl: httpUrl.optional(),
  // Which providers an organization may use is decided by the provider approval queue, not here
  allowedProviders: z.array(z.string()).optional(),
});

const listQuery = z.object({
  plan: orgPlan.optional(),
  status: activeStatus.optional(),
  search: z.string().trim().max(100).optional(),
});

// Org admins see only their own organization; superadmins see all.
organizationsRoutes.get('/', validate('query', listQuery), async (c) => {
  const q = valid<z.infer<typeof listQuery>>(c, 'query');
  const { page, limit, offset } = pagination(c);
  const db = c.get('deps').db;

  const w = where();
  const scope = orgScope(c);
  if (scope) w.add('o.id = ?', scope);
  if (q.plan) w.add('o.plan = ?', q.plan);
  if (q.status) w.add('o.status = ?', q.status);
  if (q.search) w.add('(o.name ilike ? or o.contact_email ilike ?)', likePattern(q.search));
  const clause = w.sql();

  const [{ count }] = await db.query<{ count: string }>(`select count(*) as count from organizations o ${clause}`, [...w.params]);
  const lim = w.push(limit);
  const off = w.push(offset);
  const rows = await db.query<any>(`${ORG_SELECT} ${clause} order by o.created_at desc, o.id desc limit ${lim} offset ${off}`, w.params);
  const allowed = await allowedProvidersByOrg(db, rows.map((r) => r.id));

  return ok(c, {
    organizations: rows.map((r) => orgOut(r, allowed.get(r.id)!)),
    pagination: pageInfo(Number(count), page, limit),
  });
});

/** Organization-addressed routes: 403 for someone else's organization, 404 when it does not exist. */
async function requireOrg(c: Parameters<typeof orgScope>[0], id: string) {
  orgScope(c, id);
  const org = await loadOrg(c.get('deps').db, id);
  if (!org) throw new ApiError('Organization not found', 404);
  return org;
}

organizationsRoutes.get('/:id', validate('param', idParam), async (c) => {
  const { id } = valid<{ id: string }>(c, 'param');
  const organization = await requireOrg(c, id);
  const [stats] = await c.get('deps').db.query<{ user_count: string; api_key_count: string }>(
    `select (select count(*) from profiles where organization_id = $1) as user_count,
            (select count(*) from api_keys where organization_id = $1) as api_key_count`,
    [id],
  );
  return ok(c, { organization, stats: { userCount: Number(stats.user_count), apiKeyCount: Number(stats.api_key_count) } });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().toLowerCase().email().max(254),
  billingEmail: z.string().trim().toLowerCase().email().max(254).optional(),
  plan: orgPlan,
  ownerId: uuid.nullish(),
  address: address.optional(),
  settings: settingsSchema.optional(),
});

// Tightened: creating organizations is a platform operation, superadmin only (Express let any admin)
organizationsRoutes.post('/', authorizeSuperAdmin, validate('json', createSchema), async (c) => {
  const { db } = c.get('deps');
  const actor = c.get('user');
  const body = valid<z.infer<typeof createSchema>>(c, 'json');

  if (body.ownerId && (await db.query(`select 1 from profiles where id = $1`, [body.ownerId])).length === 0) {
    throw new ApiError('Owner user not found', 404);
  }

  const [{ id }] = await db.query<{ id: string }>(
    `insert into organizations (name, contact_email, billing_email, plan, status, owner_id, address, rate_limit, webhook_url)
     values ($1, $2, $3, $4, 'active', $5, $6::jsonb, coalesce($7, 100), $8) returning id`,
    [
      body.name,
      body.contactEmail,
      body.billingEmail ?? body.contactEmail,
      body.plan,
      body.ownerId ?? null,
      body.address ? JSON.stringify(body.address) : null,
      body.settings?.rateLimit ?? null,
      body.settings?.webhookUrl ?? null,
    ],
  );

  await logActivity(c, {
    userId: actor.userId,
    organizationId: actor.organizationId,
    action: 'admin.organization.create',
    details: { organizationId: id, name: body.name },
  });
  return ok(c, { organization: await loadOrg(db, id) }, 'Organization created successfully', 201);
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  contactEmail: z.string().trim().toLowerCase().email().max(254).optional(),
  billingEmail: z.string().trim().toLowerCase().email().max(254).optional(),
  plan: orgPlan.optional(),
  status: activeStatus.optional(),
  address: address.optional(),
  settings: settingsSchema.optional(),
});

organizationsRoutes.put('/:id', validate('param', idParam), validate('json', updateSchema), async (c) => {
  const { db } = c.get('deps');
  const actor = c.get('user');
  const { id } = valid<{ id: string }>(c, 'param');
  const body = valid<z.infer<typeof updateSchema>>(c, 'json');

  const current = await requireOrg(c, id);

  if (body.plan === 'enterprise' && actor.role !== 'superadmin') {
    throw new ApiError('Only super admins can assign enterprise plan', 403);
  }
  // Tightened: an org admin editing their own organization cannot change what they are billed or
  // allowed (plan, status, rate limit). The dashboard form resends unchanged values, which is fine.
  if (actor.role !== 'superadmin') {
    const changes: string[] = [];
    if (body.plan !== undefined && body.plan !== current.plan) changes.push('plan');
    if (body.status !== undefined && body.status !== current.status) changes.push('status');
    if (body.settings?.rateLimit !== undefined && body.settings.rateLimit !== current.settings.rateLimit) changes.push('rate limit');
    if (changes.length) throw new ApiError(`Only super admins can change the ${changes.join(', ')}`, 403);
  }

  await db.query(
    `update organizations set name = coalesce($2, name), contact_email = coalesce($3, contact_email),
            billing_email = coalesce($4, billing_email), plan = coalesce($5::org_plan, plan),
            status = coalesce($6::active_status, status), address = coalesce($7::jsonb, address),
            rate_limit = coalesce($8, rate_limit), webhook_url = coalesce($9, webhook_url)
      where id = $1`,
    [
      id,
      body.name ?? null,
      body.contactEmail ?? null,
      body.billingEmail ?? null,
      body.plan ?? null,
      body.status ?? null,
      body.address ? JSON.stringify(body.address) : null,
      body.settings?.rateLimit ?? null,
      body.settings?.webhookUrl ?? null,
    ],
  );

  await logActivity(c, {
    userId: actor.userId,
    organizationId: actor.organizationId,
    action: 'admin.organization.update',
    details: { organizationId: id, updates: body },
  });
  return ok(c, { organization: await loadOrg(db, id) }, 'Organization updated successfully');
});

organizationsRoutes.delete('/:id', authorizeSuperAdmin, validate('param', idParam), async (c) => {
  const { db } = c.get('deps');
  const actor = c.get('user');
  const { id } = valid<{ id: string }>(c, 'param');

  const [org] = await db.query<{ name: string }>(`select name from organizations where id = $1`, [id]);
  if (!org) throw new ApiError('Organization not found', 404);
  if (org.name === 'Syntropi Platform') throw new ApiError('Cannot delete the platform admin organization', 403);
  if ((await db.query(`select 1 from profiles where organization_id = $1 limit 1`, [id])).length > 0) {
    throw new ApiError('Cannot delete organization with existing users', 400);
  }

  try {
    // API keys, activity, provider access and billing rows go with it (ON DELETE CASCADE)
    await db.query(`delete from organizations where id = $1`, [id]);
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new ApiError('Cannot delete an organization that has payments', 400);
    throw error;
  }

  await logActivity(c, {
    userId: actor.userId,
    organizationId: actor.organizationId,
    action: 'admin.organization.delete',
    details: { organizationId: id, name: org.name },
  });
  return ok(c, undefined, 'Organization deleted successfully');
});

organizationsRoutes.get('/:id/users', validate('param', idParam), async (c) => {
  const { id } = valid<{ id: string }>(c, 'param');
  const { page, limit, offset } = pagination(c);
  await requireOrg(c, id);
  const db = c.get('deps').db;
  const [{ count }] = await db.query<{ count: string }>(`select count(*) as count from profiles where organization_id = $1`, [id]);
  const rows = await db.query(
    `${USER_SELECT} where p.organization_id = $1 order by p.created_at desc, p.id desc limit $2 offset $3`,
    [id, limit, offset],
  );
  return ok(c, { users: rows.map((r) => userOut(r)), pagination: pageInfo(Number(count), page, limit) });
});

// Revoked keys are included here, as in Express
organizationsRoutes.get('/:id/api-keys', validate('param', idParam), async (c) => {
  const { id } = valid<{ id: string }>(c, 'param');
  const { page, limit, offset } = pagination(c);
  await requireOrg(c, id);
  const db = c.get('deps').db;
  const [{ count }] = await db.query<{ count: string }>(`select count(*) as count from api_keys where organization_id = $1`, [id]);
  const rows = await db.query(
    `${KEY_SELECT} where k.organization_id = $1 order by k.created_at desc, k.id desc limit $2 offset $3`,
    [id, limit, offset],
  );
  return ok(c, { apiKeys: rows.map(keyOut), pagination: pageInfo(Number(count), page, limit) });
});

organizationsRoutes.get('/:id/activities', validate('param', idParam), async (c) => {
  const { id } = valid<{ id: string }>(c, 'param');
  const { page, limit, offset } = pagination(c);
  await requireOrg(c, id);
  const { activities, total } = await listActivities(c.get('deps').db, { organizationId: id }, { limit, offset });
  return ok(c, { activities, pagination: pageInfo(total, page, limit) });
});
