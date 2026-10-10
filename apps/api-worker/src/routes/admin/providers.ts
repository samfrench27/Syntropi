import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, ok, validate, valid } from '../../http';
import { authenticate, authorizeAdmin, authorizeSuperAdmin } from '../../middleware/auth';
import { logActivity } from '../../lib/activity';
import { httpUrl, idParam, isForeignKeyViolation, isUniqueViolation, withId } from '../../services/adminCommon';
import { MOCK_PROVIDER } from '../../services/providerAccess';
import type { AppEnv } from '../../types';

export const providersRoutes = new Hono<AppEnv>();
providersRoutes.use('*', authenticate, authorizeAdmin);

const COLUMNS = `id, code, name, description, logo_url, api_spec, features, status, settings, created_at, updated_at`;

function providerOut(r: any) {
  return withId({
    id: r.id as string,
    code: r.code,
    name: r.name,
    description: r.description,
    logoUrl: r.logo_url ?? undefined,
    apiSpec: r.api_spec,
    features: r.features,
    status: r.status,
    settings: r.settings,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

const apiSpec = z.object({
  baseUrl: z.string().max(2048),
  version: z.string().max(50),
  documentation: z.string().max(2048).optional(),
});
const status = z.enum(['active', 'maintenance', 'inactive']);
const features = z.array(z.string().trim().min(1).max(100)).max(50);
const settings = z.record(z.string(), z.unknown());

// Reads: any admin
providersRoutes.get('/', async (c) => {
  const rows = await c.get('deps').db.query(`select ${COLUMNS} from providers order by name`);
  return ok(c, { providers: rows.map(providerOut) });
});

providersRoutes.get('/:id', validate('param', idParam), async (c) => {
  const [row] = await c.get('deps').db.query(`select ${COLUMNS} from providers where id = $1`, [valid<{ id: string }>(c, 'param').id]);
  if (!row) throw new ApiError('Provider not found', 404);
  return ok(c, { provider: providerOut(row) });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().regex(/^[a-z0-9_-]+$/, 'Lowercase letters, numbers, - and _ only').max(50),
  description: z.string().max(1000).default(''),
  logoUrl: httpUrl.optional(),
  apiSpec: apiSpec.default({ baseUrl: '', version: '1.0', documentation: '' }),
  features: features.default([]),
  status: status.default('inactive'),
  settings: settings.default({}),
});

// Writes: superadmin only
providersRoutes.post('/', authorizeSuperAdmin, validate('json', createSchema), async (c) => {
  const actor = c.get('user');
  const body = valid<z.infer<typeof createSchema>>(c, 'json');
  const db = c.get('deps').db;

  let row;
  try {
    [row] = await db.query<any>(
      `insert into providers (code, name, description, logo_url, api_spec, features, status, settings)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb) returning ${COLUMNS}`,
      [body.code, body.name, body.description, body.logoUrl ?? null, JSON.stringify(body.apiSpec), body.features, body.status, JSON.stringify(body.settings)],
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError('Provider with this code already exists', 400);
    throw error;
  }

  await logActivity(c, {
    userId: actor.userId,
    organizationId: actor.organizationId,
    action: 'admin.provider.create',
    details: { providerId: row.id, name: row.name, code: row.code },
  });
  return ok(c, { provider: providerOut(row) }, 'Provider created successfully', 201);
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  logoUrl: httpUrl.optional(),
  apiSpec: apiSpec.partial().optional(),
  features: features.optional(),
  status: status.optional(),
  settings: settings.optional(),
});

providersRoutes.put('/:id', authorizeSuperAdmin, validate('param', idParam), validate('json', updateSchema), async (c) => {
  const actor = c.get('user');
  const { id } = valid<{ id: string }>(c, 'param');
  const body = valid<z.infer<typeof updateSchema>>(c, 'json');
  const db = c.get('deps').db;

  // apiSpec is merged into the stored one, so a partial update keeps the other fields
  const [row] = await db.query<any>(
    `update providers set name = coalesce($2, name), description = coalesce($3, description),
            logo_url = coalesce($4, logo_url), api_spec = api_spec || coalesce($5::jsonb, '{}'::jsonb),
            features = coalesce($6, features), status = coalesce($7::provider_status, status),
            settings = coalesce($8::jsonb, settings)
      where id = $1 returning ${COLUMNS}`,
    [
      id,
      body.name ?? null,
      body.description ?? null,
      body.logoUrl ?? null,
      body.apiSpec ? JSON.stringify(body.apiSpec) : null,
      body.features ?? null,
      body.status ?? null,
      body.settings ? JSON.stringify(body.settings) : null,
    ],
  );
  if (!row) throw new ApiError('Provider not found', 404);

  await logActivity(c, {
    userId: actor.userId,
    organizationId: actor.organizationId,
    action: 'admin.provider.update',
    details: { providerId: id, updates: body },
  });
  return ok(c, { provider: providerOut(row) }, 'Provider updated successfully');
});

providersRoutes.delete('/:id', authorizeSuperAdmin, validate('param', idParam), async (c) => {
  const actor = c.get('user');
  const { id } = valid<{ id: string }>(c, 'param');
  const db = c.get('deps').db;

  const [provider] = await db.query<{ name: string; code: string }>(`select name, code from providers where id = $1`, [id]);
  if (!provider) throw new ApiError('Provider not found', 404);
  // Tightened: the Mock bank is every organization's default and payments point at it
  if (provider.code === MOCK_PROVIDER) throw new ApiError('The Mock bank cannot be deleted', 403);

  try {
    await db.query(`delete from providers where id = $1`, [id]);
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new ApiError('Cannot delete a provider that has payments', 409);
    throw error;
  }

  await logActivity(c, {
    userId: actor.userId,
    organizationId: actor.organizationId,
    action: 'admin.provider.delete',
    details: { providerId: id, name: provider.name, code: provider.code },
  });
  return ok(c, undefined, 'Provider deleted successfully');
});
