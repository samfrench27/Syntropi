import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { User } from '../models/user.model';
import { createError } from './errorHandler';
import { getJwks, supabaseIssuer, type AppMetadata } from '../lib/supabase';

const ROLES = ['superadmin', 'admin', 'user'];

/**
 * Verify a Supabase access token and return its trusted claims.
 * Signature, issuer, audience and expiry are all checked. Only app_metadata is trusted for
 * authorisation: user_metadata can be edited by the user.
 */
export async function verifyAccessToken(token: string): Promise<{ sub: string; email?: string; meta: AppMetadata }> {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: supabaseIssuer(),
    audience: 'authenticated',
  });
  if (!payload.sub) throw new Error('Token has no subject');
  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    meta: (payload.app_metadata as AppMetadata) || {},
  };
}

// Authenticate any user (admin or client) from a Supabase session token
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError('Authentication required', 401));
    }

    const token = authHeader.split(' ')[1];

    let claims;
    try {
      claims = await verifyAccessToken(token);
    } catch {
      return next(createError('Invalid or expired token', 401));
    }

    // The Mongo user holds the profile and is the check that the account still exists and is active
    const user = await User.findOne({ supabaseId: claims.sub });
    if (!user) {
      return next(createError('User not found', 401));
    }
    if (user.status !== 'active') {
      return next(createError('Account is not active', 403));
    }

    const role = claims.meta.role;
    if (!role || !ROLES.includes(role)) {
      return next(createError('Account is not fully set up', 403));
    }
    // A role changed after this token was issued: ask the client to refresh its session
    if (role !== user.role) {
      return next(createError('Session out of date. Refresh and try again.', 401));
    }

    (req as any).user = {
      userId: String(user._id),
      supabaseId: claims.sub,
      email: user.email,
      role,
      organizationId: claims.meta.organization_id || user.organization,
    };

    next();
  } catch (error) {
    next(createError('Invalid or expired token', 401));
  }
};

// Authorize admin access only
export const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    
    if (!user || user.role !== 'admin' && user.role !== 'superadmin') {
      return next(createError('Admin access required', 403));
    }
    
    next();
  } catch (error) {
    next(createError('Access denied', 403));
  }
};

// Authorize super admin access only (platform admins)
export const authorizeSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    
    if (!user || user.role !== 'superadmin') {
      return next(createError('Super admin access required', 403));
    }
    
    next();
  } catch (error) {
    next(createError('Access denied', 403));
  }
};

// Require specific role
export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return next(createError('Authentication required', 401));
      }
      
      if (user.role !== requiredRole && user.role !== 'superadmin') {
        return next(createError(`${requiredRole} access required`, 403));
      }
      
      next();
    } catch (error) {
      next(createError('Access denied', 403));
    }
  };
};

// Authorize organization access (client can only access their own org)
export const authorizeOrganizationAccess = (orgId: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return next(createError('Authentication required', 401));
      }
      
      // Admin can access any organization
      if (user.role === 'admin' || user.role === 'superadmin') {
        return next();
      }
      
      // Client can only access their own organization
      if (user.organizationId.toString() !== orgId) {
        return next(createError('Unauthorized organization access', 403));
      }
      
      next();
    } catch (error) {
      next(createError('Access denied', 403));
    }
  };
};