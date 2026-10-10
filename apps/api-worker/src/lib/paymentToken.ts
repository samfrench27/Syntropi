import { SignJWT, jwtVerify } from 'jose';

/**
 * Short-lived tokens that let a customer's browser act on ONE payment (hosted payment pages and
 * the Mock bank) without an API key. They carry no user identity and only work for that payment.
 */
export interface PaymentTokenClaims {
  paymentId: string;
  organizationId: string;
  clientId: string;
  /** What the token may be used for. */
  purpose: 'hosted-pages-access' | 'mock-bank-access';
}

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signPaymentToken(secret: string, claims: PaymentTokenClaims, expiresIn = '1h'): Promise<string> {
  if (secret.length < 32) throw new Error('HOSTED_PAGES_JWT_SECRET must be at least 32 characters');
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key(secret));
}

/** Throws if the token is invalid, expired, or for a different purpose. */
export async function verifyPaymentToken(secret: string, token: string, purpose: PaymentTokenClaims['purpose']): Promise<PaymentTokenClaims> {
  const { payload } = await jwtVerify(token, key(secret), { algorithms: ['HS256'] });
  if (payload.purpose !== purpose) throw new Error('Token is not valid for this use');
  if (typeof payload.paymentId !== 'string' || typeof payload.organizationId !== 'string') throw new Error('Token is missing claims');
  return {
    paymentId: payload.paymentId,
    organizationId: payload.organizationId,
    clientId: String(payload.clientId ?? ''),
    purpose,
  };
}
