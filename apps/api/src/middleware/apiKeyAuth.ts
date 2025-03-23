// apps/api/src/middleware/apiKeyAuth.ts
import { Request, Response, NextFunction } from 'express';
import { ApiKey } from '../models/apiKey.model';
import { Organization } from '../models/organization.model';
import { Activity } from '../models/activity.model';
import { createError } from './errorHandler';
import mongoose, { Document, Types } from 'mongoose';


// Extended Request interface to add apiKey property
interface ExtendedRequest extends Request {
  apiKey?: {
    id: string;
    name: string;
    organizationId: string;
    permissions: string[];
    environment: string;
  };
}

/**
 * API Key authentication middleware
 * @param requiredPermissions Optional array of permissions that the API key must have
 */
export const apiKeyAuth = (requiredPermissions?: string[]) => {
  return async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
      // Get API key from header
      const apiKeyHeader = req.headers['x-api-key'] as string;
      
      if (!apiKeyHeader) {
        return next(createError('API key is required', 401));
      }
      
      // Find API key in database
      const apiKey = await ApiKey.findOne({ 
        key: apiKeyHeader,
        isActive: true
      }).populate('organization');
      
      if (!apiKey) {
        return next(createError('Invalid API key', 401));
      }
      
      // Get organization
      const organization = await Organization.findById(apiKey.organization);
      
      if (!organization) {
        return next(createError('Organization not found', 404));
      }
      
      // Check organization status
      if (organization.status !== 'active') {
        return next(createError('Organization account is inactive', 403));
      }
      
      // Check permissions if required
      if (requiredPermissions && requiredPermissions.length > 0) {
        // Check if API key has all required permissions
        const hasAllPermissions = requiredPermissions.every(permission => 
          apiKey.permissions.includes(permission)
        );
        
        // If key has 'all' permission, allow access regardless
        const hasAllAccess = apiKey.permissions.includes('all');
        
        if (!hasAllPermissions && !hasAllAccess) {
          return next(createError('Insufficient permissions for this operation', 403));
        }
      }
      
      // Update last used timestamp
      apiKey.lastUsed = new Date();
      await apiKey.save();
      
      // Attach API key and organization info to request for later use
      req.apiKey = {
        id: (apiKey._id as Types.ObjectId).toString(),
        name: apiKey.name,
        organizationId: (organization._id as Types.ObjectId).toString(),
        permissions: apiKey.permissions,
        environment: apiKey.environment
      };
      
      // Log API usage (asynchronously)
      Activity.create({
        user: apiKey.createdBy,
        organization: organization._id,
        action: 'api.access',
        details: {
          endpoint: req.originalUrl,
          method: req.method,
          apiKeyId: apiKey._id,
          permissions: apiKey.permissions
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }).catch(err => console.error('Error logging API activity:', err));
      
      next();
    } catch (error) {
      next(createError('API key authentication failed', 401));
    }
  };
};