// apps/api/src/middleware/flexibleAuth.ts
import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';
import { apiKeyAuth } from './apiKeyAuth';
import { paymentTokenAuth } from './paymentTokenAuth';

/**
 * Flexible authentication middleware that allows either API key OR payment JWT token
 * This is useful for endpoints that need to be accessible both by API clients and hosted pages
 */
export const flexibleAuth = (requiredPermission?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if there's an API key in the headers
    const apiKeyHeader = req.headers['x-api-key'] as string;
    
    // Check if there's a JWT token in the headers
    const authHeader = req.headers['authorization'] as string;
    const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (apiKeyHeader) {
      // If API key is present, use API key authentication
      return apiKeyAuth(requiredPermission)(req, res, next);
    } else if (jwtToken) {
      // If JWT token is present, use payment token authentication
      return paymentTokenAuth(req, res, next);
    } else {
      // No authentication provided
      return next(createError('Authentication required. Provide either an API key (x-api-key header) or a JWT token (Authorization: Bearer header)', 401));
    }
  };
};
