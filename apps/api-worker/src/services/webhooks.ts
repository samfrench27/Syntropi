import { z } from 'zod';
import { mapTokenIso } from '../adapters/payments/token';
import { sha256Hex } from '../lib/crypto';
import { ApiError } from '../http';
import type { AppDeps } from '../types';
import { applyIso } from './payments';
import { isoToSyntropi } from './isoStatus';

const enc = new TextEncoder();

/** Compare two strings without stopping at the first difference. Both are hashed first so lengths match. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The provider proves it sent the call with the shared secret, either directly in
 * `x-webhook-secret` or as an HMAC-SHA256 of the raw body in `x-webhook-signature`
 * (hex, optionally prefixed `sha256=`). No secret configured means no webhook is accepted.
 */
export async function verifyWebhookAuth(deps: AppDeps, headers: { get(name: string): string | null }, rawBody: string): Promise<void> {
  // TOKEN_WEBHOOK_SECRET is not in Bindings yet (types.ts is not ours), hence the cast
  const secret = (deps.env as Record<string, string | undefined>).TOKEN_WEBHOOK_SECRET;
  if (!secret) throw new ApiError('Webhook authentication failed', 401);

  const direct = headers.get('x-webhook-secret');
  if (direct && (await safeEqual(direct, secret))) return;

  const signature = headers.get('x-webhook-signature')?.replace(/^sha256=/i, '').toLowerCase();
  if (signature && (await safeEqual(signature, await hmacHex(secret, rawBody)))) return;

  throw new ApiError('Webhook authentication failed', 401);
}

const eventSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  data: z.object({
    object: z.object({
      id: z.string().min(1).max(200),
      status: z.string().min(1).max(100),
      statusReasonInformation: z.string().max(500).optional(),
      execution: z.object({ statusDetail: z.string().max(500).optional() }).partial().optional(),
    }),
  }),
});

export type WebhookResult = 'processed' | 'duplicate' | 'ignored';

/**
 * Apply one Token.io event. The body is trusted only to say which provider payment it is about and
 * what that payment's status now is. Replays and unknown payments do nothing.
 */
export async function handleTokenEvent(deps: AppDeps, rawBody: string): Promise<WebhookResult> {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new ApiError('Invalid webhook payload', 400);
  }
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) throw new ApiError('Invalid webhook payload', 400);
  const event = parsed.data;
  const object = event.data.object;

  // Providers that send no event id are de-duplicated on the content of the message
  const eventId = event.id ?? `sha256:${await sha256Hex(rawBody)}`;
  const iso = mapTokenIso(object.status);
  const mapped = isoToSyntropi(iso);

  return deps.db.tx(async (tx) => {
    const [payment] = await tx.query<{ id: string }>(
      `select id from payments where provider_code = 'token' and provider_payment_id = $1 limit 1`,
      [object.id],
    );

    // Unknown payments are not recorded: the event may simply have beaten our own write of the provider's id
    if (!payment) return 'ignored';

    const [recorded] = await tx.query<{ id: number }>(
      `insert into webhook_events (provider, event_id, payment_id) values ('token', $1, $2)
       on conflict (provider, event_id) do nothing returning id`,
      [eventId, payment.id],
    );
    if (!recorded) return 'duplicate';

    const detail = object.execution?.statusDetail;
    await applyIso(tx, deps.now(), payment.id, iso, {
      details: [`Token.io webhook: ${object.status}`, detail ? `Detail: ${detail}` : null].filter(Boolean).join(' | '),
      ...(mapped === 'FAILED'
        ? { error: { code: 'PROVIDER_FAILED', message: object.statusReasonInformation ?? detail ?? null } }
        : {}),
      providerData: { providerStatus: object.status, lastWebhookEventId: eventId },
    });
    return 'processed';
  });
}
