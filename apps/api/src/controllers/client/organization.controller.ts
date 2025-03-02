// apps/api/src/controllers/client/organization.controller.ts
import { Request, Response, NextFunction } from 'express';
import { Organization } from '../../models/organization.model';
import { User } from '../../models/user.model';
import { ApiKey } from '../../models/apiKey.model';
import { Activity } from '../../models/activity.model';
import { createError } from '../../middleware/errorHandler';

// Get current organization details
export const getOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = (req as any).user.organizationId;
    
    const organization = await Organization.findById(organizationId);
    
    if (!organization) {
      return next(createError('Organization not found', 404));
    }
    
    // Get counts for stats
    const userCount = await User.countDocuments({ organization: organizationId });
    const apiKeyCount = await ApiKey.countDocuments({ 
      organization: organizationId,
      isActive: true 
    });
    
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

// Update organization details
export const updateOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const organizationId = (req as any).user.organizationId;
    const role = (req as any).user.role;
    
    // Find organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return next(createError('Organization not found', 404));
    }
    
    // Only admin users can update organization details
    if (role !== 'admin') {
      return next(createError('Only organization admins can update organization details', 403));
    }
    
    // Limit what fields can be updated by clients
    // They cannot change plan, status, or other sensitive fields
    const { contactEmail, billingEmail, address, settings } = req.body;
    
    const updatedOrganization = await Organization.findByIdAndUpdate(
      organizationId,
      {
        ...(contactEmail && { contactEmail }),
        ...(billingEmail && { billingEmail }),
        ...(address && { address }),
        ...(settings?.webhookUrl && { 
          'settings.webhookUrl': settings.webhookUrl 
        })
      },
      { new: true }
    );
    
    // Log activity
    await Activity.create({
      user: userId,
      organization: organizationId,
      action: 'client.organization.update',
      details: {
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