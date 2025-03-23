// apps/api/src/middleware/apiKeyAuth.ts
import { Request, Response, NextFunction } from 'express';
import { ApiKey } from '../models/apiKey.model';
import { Organization } from '../models/organization.model';
import { Activity } from '../models/activity.model';
import { createError } from './errorHandler';

// Authentication middleware for API key-based access
export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get API key from header
    const apiKeyHeader = req.headers['x-api-key'];
    
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
    
    // Check rate limiting (simplified for stubbed implementation)
    const rateLimitOk = true; // In a real implementation, check against organization.settings.rateLimit
    
    if (!rateLimitOk) {
      return next(createError('Rate limit exceeded', 429));
    }
    
    // Update last used timestamp
    apiKey.lastUsed = new Date();
    await apiKey.save();
    
    // Attach API key and organization info to request for later use
    (req as any).apiKey = {
      id: apiKey._id,
      name: apiKey.name,
      organizationId: organization._id,
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
        apiKeyId: apiKey._id
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch(err => console.error('Error logging API activity:', err));
    
    next();
  } catch (error) {
    next(createError('API key authentication failed', 401));
  }
};