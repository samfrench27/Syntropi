import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { ApiError, ok, validate, valid } from '../http';
import { apiKeyAuth } from '../middleware/apiKey';
import { verifyPaymentToken, type PaymentTokenClaims } from '../lib/paymentToken';
import { supportedPaymentProviders } from '../adapters/payments';
import { approvedProviderCodes } from '../services/providerAccess';
import {
  PAYMENT_STATUSES,
  cancelPayment,
  createPayment,
  createPaymentSchema,
  getPaymentView,
  hostedSession,
  hostedView,
  initiateHosted,
  initiateSchema,
  listPayments,
  syncPayment,
} from '../services/payments';
import type { AppEnv } from '../types';

export const paymentsRoutes = new Hono<AppEnv>();

/**
 * Payments are tenant-scoped by the API key's organization (Express scoped by the individual key,
 * which hid a payment from the organization's other keys). The hosted payment pages use a
 * payment token instead of a key: it names one payment, and the path must name the same one.
 */
async function hostedClaims(c: Context<AppEnv>, expectedPaymentId?: string): Promise<PaymentTokenClaims> {
  const header = c.req.header('authorization');
  if (!header?.startsWith('Bearer ')) throw new ApiError('Payment access token required', 401);
  let claims: PaymentTokenClaims;
  try {
    claims = await verifyPaymentToken(c.get('deps').config.hostedPagesJwtSecret, header.slice(7), 'hosted-pages-access');
  } catch {
    throw new ApiError('Invalid payment access token', 401);
  }
  if (expectedPaymentId !== undefined && claims.paymentId !== expectedPaymentId) {
    throw new ApiError('Token is not valid for this payment', 403);
  }
  return claims;
}

// Providers this organization can create payments with: approved by Syntropi, and with a payment adapter
paymentsRoutes.get('/providers', apiKeyAuth('read'), async (c) => {
  const { organizationId } = c.get('apiKey');
  const approved = await approvedProviderCodes(c.get('deps').db, organizationId);
  const supported = supportedPaymentProviders();
  return ok(c, { providers: approved.filter((p) => supported.includes(p)).map((p) => ({ id: p, name: p, supportsPayments: true })) });
});

const listQuery = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  provider: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

paymentsRoutes.get('/', apiKeyAuth('read'), validate('query', listQuery), async (c) => {
  const q = valid<z.infer<typeof listQuery>>(c, 'query');
  const limit = q.limit ?? 20;
  const offset = q.offset ?? 0;
  const result = await listPayments(c.get('deps').db, c.get('apiKey').organizationId, { status: q.status, provider: q.provider, limit, offset });
  return ok(c, { ...result, limit, offset });
});

paymentsRoutes.post('/', apiKeyAuth('write'), validate('json', createPaymentSchema), async (c) => {
  const key = c.get('apiKey');
  const body = valid<z.infer<typeof createPaymentSchema>>(c, 'json');
  const created = await createPayment(c.get('deps'), { organizationId: key.organizationId, clientId: key.id }, body);
  return ok(c, created, undefined, 201);
});

// Hosted pages: the customer picked a bank. Payment-token auth; the token's payment must be the one in the body.
paymentsRoutes.post('/initiate', validate('json', initiateSchema), async (c) => {
  const body = valid<z.infer<typeof initiateSchema>>(c, 'json');
  const claims = await hostedClaims(c, body.paymentId);
  return ok(c, await initiateHosted(c.get('deps'), claims.organizationId, body));
});

paymentsRoutes.get('/:paymentId', apiKeyAuth('read'), async (c) => {
  return ok(c, await getPaymentView(c.get('deps'), c.get('apiKey').organizationId, c.req.param('paymentId')));
});

paymentsRoutes.post('/:paymentId/sync', apiKeyAuth('read'), async (c) => {
  const { view } = await syncPayment(c.get('deps'), c.get('apiKey').organizationId, c.req.param('paymentId'));
  return ok(c, view);
});

// Cancel works for the merchant (API key) and for the customer on the hosted pages (payment token)
paymentsRoutes.post('/:paymentId/cancel', async (c) => {
  const paymentId = c.req.param('paymentId');
  if (c.req.header('x-api-key')) {
    await apiKeyAuth('write')(c, async () => {});
    const { view } = await cancelPayment(c.get('deps'), c.get('apiKey').organizationId, paymentId);
    return ok(c, view);
  }
  const claims = await hostedClaims(c, paymentId);
  const { row } = await cancelPayment(c.get('deps'), claims.organizationId, paymentId);
  return ok(c, hostedView(row));
});

// Hosted pages: what the customer sees. Payment-token auth.
paymentsRoutes.get('/:paymentId/hosted', async (c) => {
  const paymentId = c.req.param('paymentId');
  const claims = await hostedClaims(c, paymentId);
  return ok(c, await hostedSession(c.get('deps'), claims.organizationId, paymentId, { sync: false }));
});

// Hosted pages: poll for the result. Syncs with the provider when it can.
paymentsRoutes.get('/:paymentId/status', async (c) => {
  const paymentId = c.req.param('paymentId');
  const claims = await hostedClaims(c, paymentId);
  return ok(c, await hostedSession(c.get('deps'), claims.organizationId, paymentId, { sync: true }));
});
