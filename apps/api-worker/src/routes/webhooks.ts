import { Hono } from 'hono';
import { ApiError } from '../http';
import { handleTokenEvent, verifyWebhookAuth } from '../services/webhooks';
import type { AppEnv } from '../types';

export const webhooksRoutes = new Hono<AppEnv>();

const MAX_BODY = 256 * 1024;

webhooksRoutes.get('/health', (c) =>
  c.json({ success: true, message: 'Webhook endpoint is active', timestamp: c.get('deps').now().toISOString() }),
);

/**
 * Token.io payment events. Authenticated with a shared secret (see verifyWebhookAuth), idempotent
 * per event, and the answer is the same for known and unknown payments.
 */
webhooksRoutes.post('/token', async (c) => {
  const deps = c.get('deps');
  const raw = await c.req.text();
  if (raw.length > MAX_BODY) throw new ApiError('Payload too large', 413);

  await verifyWebhookAuth(deps, c.req.raw.headers, raw);
  await handleTokenEvent(deps, raw);
  return c.json({ success: true, message: 'Webhook received' });
});
