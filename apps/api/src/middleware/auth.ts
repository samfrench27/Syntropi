import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { createError } from './errorHandler';

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: string;
  role: string;
  iat: number;
  exp: number;
}

// Authenticate any user (admin or client)
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError('Authentication required', 401));
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    
    // Check if user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(createError('User not found', 401));
    }
    
    // Attach user to request
    (req as any).user = {
      userId: decoded.userId,
      role: decoded.role,
      organizationId: user.organization,
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