// apps/api/src/controllers/admin/provider.controller.ts
import { Request, Response, NextFunction } from 'express';
import { Provider } from '../../models/provider.model';
import { Activity } from '../../models/activity.model';
import { createError } from '../../middleware/errorHandler';

// Get all providers
export const getProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = await Provider.find().sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      data: { providers }
    });
  } catch (error) {
    next(error);
  }
};

// Get provider by ID
export const getProviderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const provider = await Provider.findById(id);
    if (!provider) {
      return next(createError('Provider not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: { provider }
    });
  } catch (error) {
    next(error);
  }
};

// Create new provider
export const createProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, code, description, apiSpec, features, status } = req.body;
    const userId = (req as any).user.userId;
    
    // Check if provider with code already exists
    const existingProvider = await Provider.findOne({ code });
    if (existingProvider) {
      return next(createError('Provider with this code already exists', 400));
    }
    
    // Create provider
    const provider = await Provider.create({
      name,
      code,
      description,
      logoUrl: req.body.logoUrl,
      apiSpec: apiSpec || {
        baseUrl: '',
        version: '1.0',
        documentation: ''
      },
      features: features || [],
      status: status || 'inactive',
      settings: req.body.settings || {}
    });
    
    // Log activity
    await Activity.create({
      user: userId,
      organization: (req as any).user.organizationId,
      action: 'admin.provider.create',
      details: {
        providerId: provider._id,
        name: provider.name,
        code: provider.code
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(201).json({
      success: true,
      message: 'Provider created successfully',
      data: { provider }
    });
  } catch (error) {
    next(error);
  }
};

// Update provider
export const updateProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, apiSpec, features, status, logoUrl, settings } = req.body;
    const userId = (req as any).user.userId;
    
    // Find provider
    const provider = await Provider.findById(id);
    if (!provider) {
      return next(createError('Provider not found', 404));
    }
    
    // Update provider
    const updatedProvider = await Provider.findByIdAndUpdate(
      id,
      {
        ...(name && { name }),
        ...(description && { description }),
        ...(apiSpec && { apiSpec }),
        ...(features && { features }),
        ...(status && { status }),
        ...(logoUrl && { logoUrl }),
        ...(settings && { settings })
      },
      { new: true }
    );
    
    // Log activity
    await Activity.create({
      user: userId,
      organization: (req as any).user.organizationId,
      action: 'admin.provider.update',
      details: {
        providerId: id,
        updates: req.body
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(200).json({
      success: true,
      message: 'Provider updated successfully',
      data: { provider: updatedProvider }
    });
  } catch (error) {
    next(error);
  }
};

// Delete provider
export const deleteProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    
    // Find provider
    const provider = await Provider.findById(id);
    if (!provider) {
      return next(createError('Provider not found', 404));
    }
    
    // Delete provider
    await Provider.findByIdAndDelete(id);
    
    // Log activity
    await Activity.create({
      user: userId,
      organization: (req as any).user.organizationId,
      action: 'admin.provider.delete',
      details: {
        providerId: id,
        name: provider.name,
        code: provider.code
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(200).json({
      success: true,
      message: 'Provider deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};