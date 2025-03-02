import { Request, Response, NextFunction } from 'express';
import { Organization } from '../../models/organization.model';
import { User } from '../../models/user.model';
import { ApiKey } from '../../models/apiKey.model';
import { Activity } from '../../models/activity.model';
import { createError } from '../../middleware/errorHandler';

// Get all organizations (with pagination and filters)
export const getOrganizations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Process filters
    const filters: any = {};
    
    if (req.query.plan) {
      filters.plan = req.query.plan;
    }
    
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      filters.$or = [
        { name: searchRegex },
        { contactEmail: searchRegex }
      ];
    }
    
    // Get organizations
    const organizations = await Organization.find(filters)
      .populate('ownerId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await Organization.countDocuments(filters);
    
    res.status(200).json({
      success: true,
      data: {
        organizations,
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

// Get organization by ID
export const getOrganizationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const organization = await Organization.findById(id)
      .populate('ownerId', 'firstName lastName email');
    
    if (!organization) {
      return next(createError('Organization not found', 404));
    }
    
    // Get counts
    const userCount = await User.countDocuments({ organization: id });
    const apiKeyCount = await ApiKey.countDocuments({ organization: id });
    
    res.status(200).json({
      success: true,
      data: { 
        organization,
        stats: {
          userCount,
          apiKeyCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create new organization
export const createOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, contactEmail, plan, ownerId } = req.body;
    const adminId = (req as any).user.userId;
    
    // Check if owner exists
    if (ownerId) {
      const owner = await User.findById(ownerId);
      if (!owner) {
        return next(createError('Owner user not found', 404));
      }
    }
    
    // Create organization
    const organization = await Organization.create({
      name,
      contactEmail,
      billingEmail: req.body.billingEmail || contactEmail,
      plan: plan || 'free',
      status: 'active',
      ownerId: ownerId || null,
      address: req.body.address,
      settings: req.body.settings || {
        allowedProviders: [],
        rateLimit: 100
      }
    });
    
    // Log activity
    await Activity.create({
      user: adminId,
      organization: (req as any).user.organizationId,
      action: 'admin.organization.create',
      details: {
        organizationId: organization._id,
        name: organization.name
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: { organization }
    });
  } catch (error) {
    next(error);
  }
};

// Update organization
export const updateOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, contactEmail, billingEmail, plan, status, address, settings } = req.body;
    const adminId = (req as any).user.userId;
    
    // Find organization
    const organization = await Organization.findById(id);
    if (!organization) {
      return next(createError('Organization not found', 404));
    }
    
    // Only superadmin can change plan to enterprise
    if (plan === 'enterprise' && (req as any).user.role !== 'superadmin') {
      return next(createError('Only super admins can assign enterprise plan', 403));
    }
    
    // Update organization
    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      {
        ...(name && { name }),
        ...(contactEmail && { contactEmail }),
        ...(billingEmail && { billingEmail }),
        ...(plan && { plan }),
        ...(status && { status }),
        ...(address && { address }),
        ...(settings && { settings })
      },
      { new: true }
    );
    
    // Log activity
    await Activity.create({
      user: adminId,
      organization: (req as any).user.organizationId,
      action: 'admin.organization.update',
      details: {
        organizationId: id,
        updates: req.body
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(200).json({
      success: true,
      message: 'Organization updated successfully',
      data: { organization: updatedOrganization }
    });
  } catch (error) {
    next(error);
  }
};

// Delete organization
export const deleteOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user.userId;
    
    // Only superadmin can delete organizations
    if ((req as any).user.role !== 'superadmin') {
      return next(createError('Only super admins can delete organizations', 403));
    }
    
    // Find organization
    const organization = await Organization.findById(id);
    if (!organization) {
      return next(createError('Organization not found', 404));
    }
    
    // Check if it's the admin organization
    if (organization.name === 'Syntropi Platform') {
      return next(createError('Cannot delete the platform admin organization', 403));
    }
    
    // Check if organization has users
    const userCount = await User.countDocuments({ organization: id });
    if (userCount > 0) {
      return next(createError('Cannot delete organization with existing users', 400));
    }
    
    // Delete organization
    await Organization.findByIdAndDelete(id);
    
    // Delete associated API keys
    await ApiKey.deleteMany({ organization: id });
    
    // Log activity
    await Activity.create({
      user: adminId,
      organization: (req as any).user.organizationId,
      action: 'admin.organization.delete',
      details: {
        organizationId: id,
        name: organization.name
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(200).json({
      success: true,
      message: 'Organization deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get organization users
export const getOrganizationUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Check if organization exists
    const organization = await Organization.findById(id);
    if (!organization) {
      return next(createError('Organization not found', 404));
    }
    
    // Get users
    const users = await User.find({ organization: id })
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await User.countDocuments({ organization: id });
    
    res.status(200).json({
      success: true,
      data: {
        users,
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

// Get organization API keys
export const getOrganizationApiKeys = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Check if organization exists
    const organization = await Organization.findById(id);
    if (!organization) {
      return next(createError('Organization not found', 404));
    }
    
    // Get API keys
    const apiKeys = await ApiKey.find({ organization: id })
      .select('-key') // Don't return actual key value
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await ApiKey.countDocuments({ organization: id });
    
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

// Get organization activities
export const getOrganizationActivities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Check if organization exists
    const organization = await Organization.findById(id);
    if (!organization) {
      return next(createError('Organization not found', 404));
    }
    
    // Get activities
    const activities = await Activity.find({ organization: id })
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await Activity.countDocuments({ organization: id });
    
    res.status(200).json({
      success: true,
      data: {
        activities,
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