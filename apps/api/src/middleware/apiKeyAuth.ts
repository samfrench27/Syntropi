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
  user?: {
    userId: string;
    role: string;
    organizationId: string | Types.ObjectId;
  };
}

// Define explicit interface for ApiKey document with _id typed
interface ApiKeyDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  key: string;
  organization: Types.ObjectId | { _id: Types.ObjectId; name: string };
  environment: string;
  permissions: string[];
  createdBy: Types.ObjectId;
  lastUsed?: Date;
  isActive: boolean;
}

/**
 * API Key authentication middleware
 * @param requiredPermission Optional permission that the API key must have ('read', 'write', or 'webhooks')
 */
export const apiKeyAuth = (requiredPermission?: string) => {
  return async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
      // Get API key from header
      const apiKeyHeader = req.headers['x-api-key'] as string;
      
      if (!apiKeyHeader) {
        return next(createError('API key is required', 401));
      }
      
      // Find API key in database with explicit typing
      const apiKey = await ApiKey.findOne({ 
        key: apiKeyHeader,
        isActive: true
      }).populate('organization');
      
      if (!apiKey) {
        return next(createError('Invalid API key', 401));
      }
      
      // Cast to our explicit type with _id
      const typedApiKey = apiKey as unknown as ApiKeyDocument;
      
      // Get organization
      const organization = await Organization.findById(
        typeof typedApiKey.organization === 'object' && typedApiKey.organization._id
          ? typedApiKey.organization._id
          : typedApiKey.organization
      );
      
      if (!organization) {
        return next(createError('Organization not found', 404));
      }
      
      // Check organization status
      if (organization.status !== 'active') {
        return next(createError('Organization account is inactive', 403));
      }
      
      // Check permissions if required
      if (requiredPermission) {
        const hasRequiredPermission = typedApiKey.permissions.includes(requiredPermission);
        
        if (!hasRequiredPermission) {
          return next(createError(`Insufficient permissions for this operation. Required: ${requiredPermission}`, 403));
        }
      }
      
      // Update last used timestamp
      typedApiKey.lastUsed = new Date();
      await typedApiKey.save();
      
      // Extract organization ID safely
      const organizationId = typeof typedApiKey.organization === 'object' && typedApiKey.organization._id
        ? typedApiKey.organization._id.toString()
        : typedApiKey.organization.toString();
      
      // Attach API key and organization info to request for later use
      req.apiKey = {
        id: typedApiKey._id.toString(),
        name: typedApiKey.name,
        organizationId,
        permissions: typedApiKey.permissions,
        environment: typedApiKey.environment
      };
      
      // Log API usage (asynchronously)
      Activity.create({
        user: typedApiKey.createdBy,
        organization: typeof typedApiKey.organization === 'object' && typedApiKey.organization._id
          ? typedApiKey.organization._id
          : typedApiKey.organization,
        action: 'api.access',
        details: {
          endpoint: req.originalUrl,
          method: req.method,
          apiKeyId: typedApiKey._id.toString()
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