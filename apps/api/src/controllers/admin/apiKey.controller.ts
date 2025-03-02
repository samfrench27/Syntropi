// apps/api/src/controllers/admin/apiKey.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ApiKey, generateApiKey } from '../../models/apiKey.model';
import { User } from '../../models/user.model';
import { Activity } from '../../models/activity.model';
import { createError } from '../../middleware/errorHandler';

// Create a new API key
export const createApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, environment, permissions, organizationId } = req.body;
    const userId = (req as any).user.userId;

    // Validate required fields
    if (!name || !organizationId) {
      return next(createError('Name and organizationId are required', 400));
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
      organization: (req as any).user.organizationId,
      action: 'admin.apiKey.create',
      details: {
        apiKeyId: apiKey._id,
        name: apiKey.name,
        organizationId,
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

// Get all API keys
export const getApiKeys = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Process filters
    const filters: any = {};
    
    if (req.query.organizationId) {
      filters.organization = req.query.organizationId;
    }
    
    if (req.query.environment) {
      filters.environment = req.query.environment;
    }
    
    if (req.query.isActive) {
      filters.isActive = req.query.isActive === 'true';
    }
    
    // Only show active keys by default
    if (filters.isActive === undefined) {
      filters.isActive = true;
    }
    
    // Get API keys
    const apiKeys = await ApiKey.find(filters)
      .select('-key') // Don't return actual keys
      .populate('createdBy', 'firstName lastName email')
      .populate('organization', 'name')
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

// Get API key by ID
export const getApiKeyById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const apiKey = await ApiKey.findById(id)
      .select('-key')
      .populate('createdBy', 'firstName lastName email')
      .populate('organization', 'name');
    
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

// Revoke (delete) API key
export const revokeApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    
    // Find API key
    const apiKey = await ApiKey.findById(id);
    if (!apiKey) {
      return next(createError('API key not found', 404));
    }
    
    // Deactivate the key instead of deleting it
    apiKey.isActive = false;
    await apiKey.save();
    
    // Log activity
    await Activity.create({
      user: userId,
      organization: (req as any).user.organizationId,
      action: 'admin.apiKey.revoke',
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