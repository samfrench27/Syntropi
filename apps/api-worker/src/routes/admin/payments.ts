import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, ok, pageInfo, pagination, validate, valid } from '../../http';
import { authenticate, authorizeAdmin } from '../../middleware/auth';
import { PAYMENT_STATUSES, adminAnalytics, adminGetPayment, adminListPayments, type AdminFilter } from '../../services/payments';
import { uuidText } from '../../services/providerRequests';
import type { AppEnv, AuthUser } from '../../types';

export const paymentsRoutes = new Hono<AppEnv>();
paymentsRoutes.use('*', authenticate, authorizeAdmin);

const date = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Must be a valid date')
  .transform((s) => new Date(s).toISOString());

const filterQuery = z.object({
  organizationId: uuidText.optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  provider: z.string().max(50).optional(),
  startDate: date.optional(),
  endDate: date.optional(),
});

/** Superadmins see everything (optionally one organization); an org admin only ever sees their own. */
function scope(user: AuthUser, requested?: string): string | undefined {
  if (user.role === 'superadmin') return requested;
  if (requested && requested !== user.organizationId) throw new ApiError('Access denied to this organization', 403);
  return user.organizationId;
}

function filterOf(user: AuthUser, q: z.infer<typeof filterQuery>): AdminFilter {
  return { organizationId: scope(user, q.organizationId), status: q.status, provider: q.provider, startDate: q.startDate, endDate: q.endDate };
}

// Aggregations for the analytics screens. Defaults to the last 30 days.
paymentsRoutes.get('/analytics', validate('query', filterQuery), async (c) => {
  const user = c.get('user');
  const q = valid<z.infer<typeof filterQuery>>(c, 'query');
  const end = q.endDate ?? c.get('deps').now().toISOString();
  const start = q.startDate ?? new Date(new Date(end).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const analytics = await adminAnalytics(c.get('deps').db, { ...filterOf(user, q), startDate: start, endDate: end });
  return ok(c, { analytics, period: { startDate: start, endDate: end } });
});

paymentsRoutes.get('/', validate('query', filterQuery), async (c) => {
  const q = valid<z.infer<typeof filterQuery>>(c, 'query');
  const { page, limit, offset } = pagination(c);
  const { payments, total } = await adminListPayments(c.get('deps').db, filterOf(c.get('user'), q), { limit, offset });
  return ok(c, { payments, pagination: pageInfo(total, page, limit) });
});

// The dashboard reads `data.payment`
paymentsRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const payment = await adminGetPayment(c.get('deps').db, user.role === 'superadmin' ? null : user.organizationId, c.req.param('id'));
  return ok(c, { payment });
});
