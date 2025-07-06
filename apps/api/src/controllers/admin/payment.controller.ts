// apps/api/src/controllers/admin/payment.controller.ts
import { Request, Response, NextFunction } from 'express';
import { Payment } from '../../models/payment.model';
import { createError } from '../../middleware/errorHandler';

// Get all payments (admin only - no API key required)
export const getPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Process filters
    const filters: any = {};
    
    if (req.query.organizationId) {
      filters.organizationId = req.query.organizationId;
    }
    
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.provider) {
      filters.provider = req.query.provider;
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
    
    // Get payments
    const payments = await Payment.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await Payment.countDocuments(filters);
    
    res.status(200).json({
      success: true,
      data: {
        payments,
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

// Get payment by ID (admin only)
export const getPaymentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Search by paymentId field, not MongoDB _id
    const payment = await Payment.findOne({ paymentId: id });
    
    if (!payment) {
      return next(createError('Payment not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: payment // Return payment directly, not wrapped in another object
    });
  } catch (error) {
    next(error);
  }
};
