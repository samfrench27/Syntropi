import { Hono } from 'hono';
import { z } from 'zod';
import { likePattern } from '../db';
import { ApiError, ok, pageInfo, pagination, validate, valid } from '../http';
import { authenticate, authorizeSuperAdmin } from '../middleware/auth';
import { callerOf, flexibleAuth } from '../middleware/flexibleAuth';
import { allowedProviderScope, getBank, listBanks, listProviderCodes, syncBanksFromProviders } from '../services/banks';
import type { AppEnv } from '../types';

export const banksRoutes = new Hono<AppEnv>();

const listQuery = z.object({
  provider: z.string().trim().min(1).max(50).optional(),
  paymentMethod: z.string().trim().min(1).max(50).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  country: z.string().trim().length(2).optional(),
});

const syncQuery = z.object({ provider: z.string().trim().min(1).max(50).optional() });

// Banks and the provider list, for merchants (API key), hosted pages (payment token) and the dashboard (signed in)
banksRoutes.get('/', flexibleAuth('read'), validate('query', listQuery), async (c) => {
  const deps = c.get('deps');
  const q = valid<z.infer<typeof listQuery>>(c, 'query');
  const { page, limit, offset } = pagination(c, 100, 100);

  const allowed = await allowedProviderScope(deps.db, callerOf(c));
  const { banks, total } = await listBanks(
    deps.db,
    allowed,
    { country: q.country, provider: q.provider, paymentMethod: q.paymentMethod, search: q.search ? likePattern(q.search) : undefined },
    { limit, offset },
  );
  return ok(c, { banks, pagination: pageInfo(total, page, limit) });
});

banksRoutes.get('/providers', flexibleAuth('read'), async (c) => {
  const deps = c.get('deps');
  const allowed = await allowedProviderScope(deps.db, callerOf(c));
  return ok(c, { providers: await listProviderCodes(deps.db, allowed) });
});

// Admin: run the import now. Superadmin only (the Express version allowed any admin).
banksRoutes.post('/sync', authenticate, authorizeSuperAdmin, validate('query', syncQuery), async (c) => {
  const { provider } = valid<z.infer<typeof syncQuery>>(c, 'query');
  const result = await syncBanksFromProviders(c.get('deps'), provider ? [provider] : undefined);
  return ok(c, result, 'Bank synchronization completed');
});

banksRoutes.get('/:id', flexibleAuth('read'), async (c) => {
  const deps = c.get('deps');
  const id = c.req.param('id');
  if (!id || id.length > 100) throw new ApiError('Bank not found', 404);
  const allowed = await allowedProviderScope(deps.db, callerOf(c));
  return ok(c, { bank: await getBank(deps.db, allowed, id) });
});
