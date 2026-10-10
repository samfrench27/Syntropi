import { Hono, type Context } from 'hono';
import { ApiError, ok, validate, valid } from '../http';
import { verifyPaymentToken, type PaymentTokenClaims } from '../lib/paymentToken';
import { decisionSchema, mockBankDecision, mockBankPayment } from '../services/mockBank';
import type { AppEnv } from '../types';
import type { MiddlewareHandler } from 'hono';
import type { z } from 'zod';

export const mockBankRoutes = new Hono<AppEnv>();

const CLAIMS = 'mockBankClaims';
const claimsOf = (c: Context<AppEnv>) => c.get(CLAIMS as never) as PaymentTokenClaims;

/** The Mock bank page has no sign-in: the token in its link is the only credential, and it is for one payment. */
const bankAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('authorization');
  if (!header?.startsWith('Bearer ')) throw new ApiError('Payment access token required', 401);
  let claims: PaymentTokenClaims;
  try {
    claims = await verifyPaymentToken(c.get('deps').config.hostedPagesJwtSecret, header.slice(7), 'mock-bank-access');
  } catch {
    throw new ApiError('Invalid payment access token', 401);
  }
  if (claims.paymentId !== c.req.param('id')) throw new ApiError('Token is not valid for this payment', 403);
  c.set(CLAIMS as never, claims as never);
  await next();
};

mockBankRoutes.get('/payments/:id', bankAuth, async (c) => ok(c, await mockBankPayment(c.get('deps'), claimsOf(c))));

mockBankRoutes.post('/payments/:id/decision', bankAuth, validate('json', decisionSchema), async (c) => {
  const { decision } = valid<z.infer<typeof decisionSchema>>(c, 'json');
  return ok(c, await mockBankDecision(c.get('deps'), claimsOf(c), decision));
});
