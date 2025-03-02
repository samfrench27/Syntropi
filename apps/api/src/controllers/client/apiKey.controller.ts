// apps/api/src/controllers/client/apiKey.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ApiKey, generateApiKey } from '../../models/apiKey.model';
import { Activity } from '../../models/activity.model';
import { createError } from '../../middleware/errorHandler';

// Get all API keys for the current organization
export const getApiKeys = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    const organizationId = (req as any).user.organizationId;
    
    // Process filters
    const filters: any = {
      organization: organizationId
    };
    
    if (req.query.environment) {
      filters.environment = req.query.environment;
    }
    
    // Only show active keys by default
    filters.isActive = true;
    
    // Get API keys
    const apiKeys = await ApiKey.find(filters)
      .select('-key') // Don't return actual keys for security
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await ApiKey.countDocuments(filters);
    
    res.status(200).json({
      success: true,
      data: {
        apiKeys,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get a specific API key
export const getApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user.organizationId;
    
    const apiKey = await ApiKey.findOne({
      _id: id,
      organization: organizationId
    })
    .select('-key')
    .populate('createdBy', 'firstName lastName email');
    
    if (!apiKey) {
      return next(createError('API key not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: { apiKey }
    });
  } catch (error) {
    next(error);
  }
};

// Create a new API key for the current organization
export const createApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, environment, permissions } = req.body;
    const userId = (req as any).user.userId;
    const organizationId = (req as any).user.organizationId;

    // Validate required fields
    if (!name) {
      return next(createError('Name is required', 400));
    }

    // Generate key
    const key = generateApiKey();

    // Create API key
    const apiKey = await ApiKey.create({
      name,
      key,
      organization: organizationId,
      environment: environment || 'sandbox',
      permissions: permissions || [],
      createdBy: userId,
      isActive: true,
    });

    // Log activity
    await Activity.create({
      user: userId,
      organization: organizationId,
      action: 'client.apiKey.create',
      details: {
        apiKeyId: apiKey._id,
        name: apiKey.name,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Don't return the actual key in the response data,
    // only in the initial creation response
    res.status(201).json({
      success: true,
      message: 'API key created successfully',
      data: {
        id: apiKey._id,
        name: apiKey.name,
        key, // Only return full key on creation
        environment: apiKey.environment,
        permissions: apiKey.permissions,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Revoke (disable) an API key
export const revokeApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const organizationId = (req as any).user.organizationId;
    
    // Find API key
    const apiKey = await ApiKey.findOne({
      _id: id,
      organization: organizationId
    });
    
    if (!apiKey) {
      return next(createError('API key not found', 404));
    }
    
    // Deactivate the key instead of deleting it
    apiKey.isActive = false;
    await apiKey.save();
    
    // Log activity
    await Activity.create({
      user: userId,
      organization: organizationId,
      action: 'client.apiKey.revoke',
      details: {
        apiKeyId: id,
        name: apiKey.name,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(200).json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    next(error);
  }
};