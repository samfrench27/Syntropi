import type { Context } from 'hono';
import { z } from 'zod';
import type { Db } from '../db';
import { ApiError } from '../http';
import { canAccessOrganization } from '../middleware/auth';
import type { AppEnv } from '../types';
import { MOCK_PROVIDER } from './providerAccess';

/**
 * Shared pieces for the admin and client CRUD routes: id validation, tenant scoping, a tiny WHERE
 * builder (values only ever travel as parameters) and the JSON shapes the dashboard expects.
 */

/**
 * Any canonical-looking uuid. zod's own `.uuid()` insists on RFC version bits, which Postgres does
 * not, so ids like 00000000-...-a1 would be refused although the database accepts them.
 */
export const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Must be a valid id');
export const idParam = z.object({ id: uuid });

/** An ISO date or date-time. Anything else is a 400, never an invalid-timestamp database error. */
export const dateString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Must be a valid date')
  .transform((s) => new Date(s).toISOString());

export const userRole = z.enum(['superadmin', 'admin', 'user']);
export const activeStatus = z.enum(['active', 'inactive', 'suspended']);
export const orgPlan = z.enum(['free', 'starter', 'growth', 'enterprise']);
export const environment = z.enum(['sandbox', 'production']);
export const permission = z.enum(['read', 'write', 'webhooks']);

export const address = z
  .object({
    street: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    zipCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
  })
  .strict();

export const httpUrl = z
  .string()
  .max(2048)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Must be an http or https URL');

/** Where `c.get('user')` may look. Superadmin: anywhere (undefined). Everyone else: their own organization. */
export function orgScope(c: Context<AppEnv>, requested?: string): string | undefined {
  const user = c.get('user');
  if (requested) {
    if (!canAccessOrganization(user, requested)) throw new ApiError('You can only access your own organization', 403);
    return requested;
  }
  return user.role === 'superadmin' ? undefined : user.organizationId;
}

export const isSuperadmin = (c: Context<AppEnv>) => c.get('user').role === 'superadmin';

/** Builds `where a = $1 and b ilike $2` without ever putting a value in the SQL text. */
export function where() {
  const params: unknown[] = [];
  const parts: string[] = [];
  return {
    params,
    /** `template` is fixed SQL; every `?` in it becomes this value's placeholder. */
    add(template: string, value: unknown) {
      params.push(value);
      parts.push(template.replaceAll('?', `$${params.length}`));
    },
    sql: () => (parts.length ? `where ${parts.join(' and ')}` : ''),
    /** Append a value (for limit/offset) and get its placeholder. */
    push(value: unknown) {
      params.push(value);
      return `$${params.length}`;
    },
  };
}

export const isUniqueViolation = (e: any) => e?.code === '23505';
export const isForeignKeyViolation = (e: any) => e?.code === '23503';

/** An object plus the `_id` alias the Mongo-era dashboard reads. */
export const withId = <T extends { id: string }>(o: T): T & { _id: string } => ({ ...o, _id: o.id });

const ref = (id: string | null, fields: Record<string, unknown>) => (id ? withId({ id, ...fields }) : null);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const USER_SELECT = `
  select p.id, p.email, p.first_name, p.last_name, p.role, p.status, p.is_verified, p.last_login,
         p.created_at, p.updated_at, p.organization_id, p.created_by,
         o.name as org_name, o.plan as org_plan, o.status as org_status,
         cb.first_name as cb_first, cb.last_name as cb_last, cb.email as cb_email
    from profiles p
    join organizations o on o.id = p.organization_id
    left join profiles cb on cb.id = p.created_by`;

export function userOut(r: any, detail = false) {
  return withId({
    id: r.id as string,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    role: r.role,
    status: r.status,
    isVerified: r.is_verified,
    lastLogin: r.last_login,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    organizationId: r.organization_id,
    organization: withId({
      id: r.organization_id as string,
      name: r.org_name,
      ...(detail ? { plan: r.org_plan, status: r.org_status } : {}),
    }),
    createdBy: ref(r.created_by, { firstName: r.cb_first, lastName: r.cb_last, email: r.cb_email }),
  });
}

/** The person behind an activity or API key, as `{id,_id,firstName,lastName,email}` (or null). */
export const personRef = (id: string | null, first: string | null, last: string | null, email: string | null) =>
  ref(id, { firstName: first, lastName: last, email });

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------
export const ORG_SELECT = `
  select o.id, o.name, o.owner_id, o.plan, o.status, o.contact_email, o.billing_email, o.address,
         o.rate_limit, o.webhook_url, o.created_at, o.updated_at,
         ow.first_name as ow_first, ow.last_name as ow_last, ow.email as ow_email
    from organizations o
    left join profiles ow on ow.id = o.owner_id`;

/** Provider codes each organization may use (the Mock bank plus approved, non-inactive providers). */
export async function allowedProvidersByOrg(db: Db, orgIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(orgIds.map((id) => [id, [MOCK_PROVIDER]]));
  if (orgIds.length === 0) return out;
  const rows = await db.query<{ organization_id: string; provider_code: string }>(
    `select pa.organization_id, pa.provider_code
       from provider_access pa join providers p on p.code = pa.provider_code
      where pa.organization_id = any($1::uuid[]) and pa.status = 'approved' and p.status <> 'inactive'
      order by pa.provider_code`,
    [orgIds],
  );
  for (const r of rows) out.get(r.organization_id)?.push(r.provider_code);
  return out;
}

export function orgOut(r: any, allowedProviders: string[]) {
  return withId({
    id: r.id as string,
    name: r.name,
    ownerId: ref(r.owner_id, { firstName: r.ow_first, lastName: r.ow_last, email: r.ow_email }),
    plan: r.plan,
    status: r.status,
    contactEmail: r.contact_email,
    billingEmail: r.billing_email,
    address: r.address ?? undefined,
    settings: { allowedProviders, rateLimit: r.rate_limit, webhookUrl: r.webhook_url ?? undefined },
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

export async function loadOrg(db: Db, id: string) {
  const [row] = await db.query<any>(`${ORG_SELECT} where o.id = $1`, [id]);
  if (!row) return undefined;
  const allowed = await allowedProvidersByOrg(db, [id]);
  return orgOut(row, allowed.get(id)!);
}

// ---------------------------------------------------------------------------
// API keys (never the key or its hash)
// ---------------------------------------------------------------------------
export const KEY_SELECT = `
  select k.id, k.name, k.key_prefix, k.environment, k.permissions, k.is_active, k.last_used, k.expires_at,
         k.created_at, k.updated_at, k.organization_id, k.created_by,
         o.name as org_name,
         cb.first_name as cb_first, cb.last_name as cb_last, cb.email as cb_email
    from api_keys k
    join organizations o on o.id = k.organization_id
    left join profiles cb on cb.id = k.created_by`;

export function keyOut(r: any) {
  return withId({
    id: r.id as string,
    name: r.name,
    keyPrefix: r.key_prefix,
    environment: r.environment,
    permissions: r.permissions,
    isActive: r.is_active,
    lastUsed: r.last_used,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    organizationId: r.organization_id,
    organization: withId({ id: r.organization_id as string, name: r.org_name }),
    createdBy: personRef(r.created_by, r.cb_first, r.cb_last, r.cb_email),
  });
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------
export const ACTIVITY_SELECT = `
  select a.id, a.user_id, a.organization_id, a.action, a.details, a.ip_address, a.user_agent, a.created_at,
         u.first_name as u_first, u.last_name as u_last, u.email as u_email, o.name as org_name
    from activities a
    join organizations o on o.id = a.organization_id
    left join profiles u on u.id = a.user_id`;

export function activityOut(r: any) {
  return withId({
    id: r.id as string,
    user: personRef(r.user_id, r.u_first, r.u_last, r.u_email),
    organization: withId({ id: r.organization_id as string, name: r.org_name }),
    organizationId: r.organization_id,
    action: r.action,
    details: r.details,
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  });
}

/** Shared by every activity listing. `scope` is the organization the caller is confined to, if any. */
export async function listActivities(
  db: Db,
  f: { organizationId?: string; userId?: string; action?: string; startDate?: string; endDate?: string },
  page: { limit: number; offset: number },
) {
  const w = where();
  if (f.organizationId) w.add('a.organization_id = ?', f.organizationId);
  if (f.userId) w.add('a.user_id = ?', f.userId);
  if (f.action) w.add('a.action = ?', f.action);
  if (f.startDate) w.add('a.created_at >= ?::timestamptz', f.startDate);
  if (f.endDate) w.add('a.created_at <= ?::timestamptz', f.endDate);
  const clause = w.sql();
  const [{ count }] = await db.query<{ count: string }>(`select count(*) as count from activities a ${clause}`, [...w.params]);
  const limit = w.push(page.limit);
  const offset = w.push(page.offset);
  const rows = await db.query(
    `${ACTIVITY_SELECT} ${clause} order by a.created_at desc, a.id desc limit ${limit} offset ${offset}`,
    w.params,
  );
  return { activities: rows.map(activityOut), total: Number(count) };
}
