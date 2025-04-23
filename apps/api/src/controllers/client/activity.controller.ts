import { Request, Response, NextFunction } from 'express';
import { Activity } from '../../models/activity.model';
import { createError } from '../../middleware/errorHandler';

// Get activities for the current organization
export const getActivities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Get the organization ID from the authenticated user
    const organizationId = (req as any).user.organizationId;
    
    // Process filters
    const filters: any = {
      organization: organizationId
    };
    
    if (req.query.action) {
      filters.action = req.query.action;
    }
    
    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filters.createdAt = {};
      
      if (req.query.startDate) {
        filters.createdAt.$gte = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.createdAt.$lte = new Date(req.query.endDate as string);
      }
    }
    
    // Get activities
    const activities = await Activity.find(filters)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await Activity.countDocuments(filters);
    
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