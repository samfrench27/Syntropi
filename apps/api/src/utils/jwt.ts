// apps/api/src/utils/jwt.ts
import * as jwt from 'jsonwebtoken';
import { winstonLogger as logger } from './logger';

// JWT secret for hosted pages (should be in environment variables)
const HOSTED_PAGES_JWT_SECRET = process.env.HOSTED_PAGES_JWT_SECRET || 'your-secret-key-change-in-production';

export interface PaymentTokenPayload {
  paymentId: string;
  organizationId: string;
  clientId: string;
  purpose: 'hosted-pages-access';
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for hosted pages access to a specific payment
 */
export const generatePaymentAccessToken = (
  paymentId: string,
  organizationId: string,
  clientId: string,
  expiresIn: string = '1h'
): string => {
  try {
    const payload: PaymentTokenPayload = {
      paymentId,
      organizationId,
      clientId,
      purpose: 'hosted-pages-access'
    };

    const token = jwt.sign(payload, HOSTED_PAGES_JWT_SECRET, {
      expiresIn,
      issuer: 'syntropi-api',
      audience: 'syntropi-hosted-pages'
    } as jwt.SignOptions);

    logger.debug('Generated payment access token', { 
      paymentId, 
      organizationId,
      expiresIn 
    });

    return token;
  } catch (error) {
    logger.error('Error generating payment access token:', error);
    throw new Error('Failed to generate payment access token');
  }
};

/**
 * Verify and decode a payment access token
 */
export const verifyPaymentAccessToken = (token: string): PaymentTokenPayload => {
  try {
    const decoded = jwt.verify(token, HOSTED_PAGES_JWT_SECRET, {
      issuer: 'syntropi-api',
      audience: 'syntropi-hosted-pages'
    }) as PaymentTokenPayload;

    if (decoded.purpose !== 'hosted-pages-access') {
      throw new Error('Invalid token purpose');
    }

    return decoded;
  } catch (error) {
    logger.warn('Payment access token verification failed:', error);
    throw new Error('Invalid or expired payment access token');
  }
};

/**
 * Generate hosted page URL with access token
 */
export const generateHostedPageUrl = (
  paymentId: string,
  organizationId: string,
  clientId: string,
  redirectUri?: string,
  baseUrl: string = process.env.HOSTED_PAGES_URL || 'https://hosted-pages-c3j7ob1pv-samfrench27s-projects.vercel.app'
): string => {
  // Generate access token valid for 1 hour
  const accessToken = generatePaymentAccessToken(paymentId, organizationId, clientId, '1h');
  
  // Build URL with token and optional redirect
  const url = new URL(`/sessions/${paymentId}`, baseUrl);
  url.searchParams.set('token', accessToken);
  
  if (redirectUri) {
    url.searchParams.set('redirect_uri', redirectUri);
  }
  
  return url.toString();
};
