import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, ok, pageInfo, pagination, validate, valid } from '../../http';
import { authenticate, authorizeAdmin, canAccessOrganization } from '../../middleware/auth';
import { logActivity } from '../../lib/activity';
import { likePattern } from '../../db';
import {
  USER_SELECT,
  activeStatus,
  idParam,
  isUniqueViolation,
  listActivities,
  orgScope,
  userOut,
  userRole,
  uuid,
  where,
  withId,
} from '../../services/adminCommon';
import type { AppEnv } from '../../types';

export const usersRoutes = new Hono<AppEnv>();
usersRoutes.use('*', authenticate, authorizeAdmin);

const listQuery = z.object({
  role: userRole.optional(),
  status: activeStatus.optional(),
  organizationId: uuid.optional(),
  search: z.string().trim().max(100).optional(),
});

// Org admins see their own organization's users only; superadmins see everyone.
usersRoutes.get('/', validate('query', listQuery), async (c) => {
  const q = valid<z.infer<typeof listQuery>>(c, 'query');
  const { page, limit, offset } = pagination(c);
  const db = c.get('deps').db;

  const w = where();
  const org = orgScope(c, q.organizationId);
  if (org) w.add('p.organization_id = ?', org);
  if (q.role) w.add('p.role = ?', q.role);
  if (q.status) w.add('p.status = ?', q.status);
  if (q.search) w.add(`(p.first_name || ' ' || p.last_name || ' ' || p.email) ilike ?`, likePattern(q.search));
  const clause = w.sql();

  const [{ count }] = await db.query<{ count: string }>(`select count(*) as count from profiles p ${clause}`, [...w.params]);
  const lim = w.push(limit);
  const off = w.push(offset);
  const rows = await db.query(`${USER_SELECT} ${clause} order by p.created_at desc, p.id desc limit ${lim} offset ${off}`, w.params);

  return ok(c, { users: rows.map((r) => userOut(r)), pagination: pageInfo(Number(count), page, limit) });
});

/** The user, or a 404 when they do not exist or belong to an organization the caller cannot reach. */
async function findVisibleUser(c: Parameters<typeof orgScope>[0], id: string) {
  const [row] = await c.get('deps').db.query<any>(`${USER_SELECT} where p.id = $1`, [id]);
  if (!row || !canAccessOrganization(c.get('user'), row.organization_id)) throw new ApiError('User not found', 404);
  return row;
}

usersRoutes.get('/:id', validate('param', idParam), async (c) => {
  const row = await findVisibleUser(c, valid<{ id: string }>(c, 'param').id);
  return ok(c, { user: userOut(row, true) });
});

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  // Optional: without a password the new user is emailed an invite to set their own
  password: z.string().min(8).max(200).optional().or(z.literal('').transform(() => undefined)),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(['admin', 'user']),
  organizationId: uuid,
});

usersRoutes.post('/', validate('json', createSchema), async (c) => {
  const { db, identity, config } = c.get('deps');
  const actor = c.get('user');
  const body = valid<z.infer<typeof createSchema>>(c, 'json');

  // Tenant check first: an org admin can only add people to their own organization
  orgScope(c, body.organizationId);

  const [org] = await db.query<{ id: string; name: string }>(`select id, name from organizations where id = $1`, [body.organizationId]);
  if (!org) throw new ApiError('Organization not found', 404);
  if (body.role === 'admin' && actor.role !== 'superadmin') throw new ApiError('Only super admins can create admin users', 403);
  if ((await db.query(`select 1 from profiles where lower(email) = $1`, [body.email])).length > 0) {
    throw new ApiError('User already exists with this email', 400);
  }

  // Identity first (the profile id is the Supabase user id), then the profile in a transaction.
  // If the profile cannot be written the identity is removed again.
  const id = await identity.createUser({
    email: body.email,
    password: body.password,
    redirectTo: `${config.dashboardUrl}/reset-password`,
    meta: { role: body.role, organization_id: org.id },
  });
  try {
    await db.tx(async (tx) => {
      await tx.query(
        `insert into profiles (id, email, first_name, last_name, role, organization_id, status, created_by)
         values ($1, $2, $3, $4, $5, $6, 'active', $7)`,
        [id, body.email, body.firstName, body.lastName, body.role, org.id, actor.userId],
      );
    });
  } catch (error) {
    await identity.deleteUser(id).catch(() => undefined);
    if (isUniqueViolation(error)) throw new ApiError('User already exists with this email', 400);
    throw error;
  }

  await logActivity(c, {
    userId: actor.userId,
    organizationId: actor.organizationId,
    action: 'admin.user.create',
    details: { userId: id, email: body.email, organizationId: org.id },
  });

  return ok(
    c,
    {
      user: withId({
        id,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        organization: withId({ id: org.id, name: org.name }),
      }),
    },
    'User created successfully',
    201,
  );
});

const updateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  role: z.enum(['admin', 'user']).optional(),
  status: activeStatus.optional(),
});

usersRoutes.put('/:id', validate('param', idParam), validate('json', updateSchema), async (c) => {
  const { db, identity } = c.get('deps');
  const actor = c.get('user');
  const { id } = valid<{ id: string }>(c, 'param');
  const body = valid<z.infer<typeof updateSchema>>(c, 'json');

  const target = await findVisibleUser(c, id);

  if (actor.role !== 'superadmin' && (target.role === 'admin' || target.role === 'superadmin')) {
    throw new ApiError('You cannot update admin users', 403);
  }
  if (body.role === 'admin' && actor.role !== 'superadmin') throw new ApiError('Only super admins can assign admin role', 403);
  // Tightened: nobody can demote or lock out a super admin through the API
  if (target.role === 'superadmin' && (body.role !== undefined || body.status !== undefined)) {
    throw new ApiError('Super admin accounts cannot be changed here', 403);
  }

  const roleChanged = body.role !== undefined && body.role !== target.role;
  const statusChanged = body.status !== undefined && body.status !== target.status;
  const done: { role?: boolean; status?: boolean } = {};

  try {
    await db.tx(async (tx) => {
      await tx.query(
        `update profiles set first_name = coalesce($2, first_name), last_name = coalesce($3, last_name),
                role = coalesce($4::user_role, role), status = coalesce($5::active_status, status)
          where id = $1`,
        [id, body.firstName ?? null, body.lastName ?? null, body.role ?? null, body.status ?? null],
      );
      // Keep Supabase in step. A failure here rolls the profile change back.
      if (roleChanged) {
        await identity.setAppMetadata(id, { role: body.role, organization_id: target.organization_id });
        done.role = true;
      }
      if (statusChanged) {
        await identity.setActive(id, body.status === 'active');
        done.status = true;
      }
    });
  } catch (error) {
    // Put Supabase back as it was for whatever had already been applied
    if (done.role) await identity.setAppMetadata(id, { role: target.role, organization_id: target.organization_id }).catch(() => undefined);
    if (done.status) await identity.setActive(id, target.status === 'active').catch(() => undefined);
    throw error;
  }

  await logActivity(c, {
    userId: actor.userId,
    organizationId: actor.organizationId,
    action: 'admin.user.update',
    details: { userId: id, updates: body },
  });

  const [row] = await db.query(`${USER_SELECT} where p.id = $1`, [id]);
  return ok(c, { user: userOut(row) }, 'User updated successfully');
});

usersRoutes.delete('/:id', validate('param', idParam), async (c) => {
  const { db, identity } = c.get('deps');
  const actor = c.get('user');
  const { id } = valid<{ id: string }>(c, 'param');

  const target = await findVisibleUser(c, id);
  if (target.role === 'superadmin') throw new ApiError('Super admin users cannot be deleted', 403);
  if (actor.role !== 'superadmin' && target.role === 'admin') throw new ApiError('You cannot delete admin users', 403);
  if ((await db.query(`select 1 from organizations where owner_id = $1`, [id])).length > 0) {
    throw new ApiError('Cannot delete user who owns an organization', 400);
  }

  // API keys must keep a creator; hand the person's keys to the admin doing the deletion
  const moved = await db.query<{ id: string }>(`update api_keys set created_by = $2 where created_by = $1 returning id`, [id, actor.userId]);
  const reassigned = moved.length;
  try {
    // Deleting the Supabase user cascades to the profile (profiles.id references auth.users)
    await identity.deleteUser(id);
  } catch (error) {
    // Supabase refused: nothing is deleted, so give the keys back
    if (moved.length) {
      await db.query(`update api_keys set created_by = $1 where id = any($2::uuid[])`, [id, moved.map((k) => k.id)]).catch(() => undefined);
    }
    throw error;
  }
  // Normally a no-op (the cascade did it); makes sure the profile is gone whatever the identity layer does
  await db.query(`delete from profiles where id = $1`, [id]);

  await logActivity(c, {
    userId: actor.userId,
    organizationId: actor.organizationId,
    action: 'admin.user.delete',
    details: { userId: id, email: target.email, ...(reassigned ? { reassignedApiKeys: reassigned } : {}) },
  });

  return ok(c, undefined, 'User deleted successfully');
});

usersRoutes.get('/:id/activities', validate('param', idParam), async (c) => {
  const { id } = valid<{ id: string }>(c, 'param');
  const { page, limit, offset } = pagination(c);
  await findVisibleUser(c, id);
  const { activities, total } = await listActivities(c.get('deps').db, { userId: id }, { limit, offset });
  return ok(c, { activities, pagination: pageInfo(total, page, limit) });
});
