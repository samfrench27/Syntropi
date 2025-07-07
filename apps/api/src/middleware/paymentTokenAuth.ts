// apps/api/src/middleware/paymentTokenAuth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyPaymentAccessToken } from '../utils/jwt';
import { createError } from './errorHandler';
import { winstonLogger as logger } from '../utils/logger';

export interface PaymentTokenRequest extends Request {
  paymentToken?: {
    paymentId: string;
    organizationId: string;
    clientId: string;
    purpose: string;
  };
}

/**
 * Middleware to authenticate requests using payment access tokens
 * Used for hosted pages to access specific payment data
 */
export const paymentTokenAuth = (req: PaymentTokenRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError('Payment access token required', 401));
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return next(createError('Payment access token required', 401));
    }

    // Verify the token
    const decoded = verifyPaymentAccessToken(token);
    
    // Check if token is for the requested payment
    const requestedPaymentId = req.params.paymentId;
    if (requestedPaymentId && decoded.paymentId !== requestedPaymentId) {
      logger.warn('Token payment ID mismatch', {
        tokenPaymentId: decoded.paymentId,
        requestedPaymentId
      });
      return next(createError('Token is not valid for this payment', 403));
    }

    // Attach decoded token to request
    req.paymentToken = decoded;
    
    logger.debug('Payment token authentication successful', {
      paymentId: decoded.paymentId,
      organizationId: decoded.organizationId
    });

    next();
  } catch (error: any) {
    logger.warn('Payment token authentication failed:', error.message);
    return next(createError('Invalid payment access token', 401));
  }
};
