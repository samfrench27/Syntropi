// apps/api/src/controllers/admin/activity.controller.ts
import { Request, Response, NextFunction } from 'express';
import { Activity } from '../../models/activity.model';
import { createError } from '../../middleware/errorHandler';

// Get all activities with filters and pagination
export const getActivities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Process filters
    const filters: any = {};
    
    if (req.query.userId) {
      filters.user = req.query.userId;
    }
    
    if (req.query.organizationId) {
      filters.organization = req.query.organizationId;
    }
    
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
      .populate('organization', 'name')
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

// Get activity by ID
export const getActivityById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const activity = await Activity.findById(id)
      .populate('user', 'firstName lastName email')
      .populate('organization', 'name');
    
    if (!activity) {
      return next(createError('Activity not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: { activity }
    });
  } catch (error) {
    next(error);
  }
};