import { Hono } from 'hono';
import type { AppEnv } from '../types';

// Stripe's own webhook: verified with the signing secret over the raw body. Mounted at /api/webhooks/stripe.
export const stripeWebhookRoutes = new Hono<AppEnv>();
