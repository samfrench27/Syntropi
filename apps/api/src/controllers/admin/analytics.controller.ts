// apps/api/src/controllers/admin/analytics.controller.ts
import { Request, Response, NextFunction } from 'express';
import { winstonLogger as logger } from '../../utils/logger';
import { createError } from '../../middleware/errorHandler';
import * as activityService from '../../services/activity.service';
import * as paymentService from '../../services/payment.service';

// Get endpoint analytics data
export const getEndpointAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      startDate, 
      endDate, 
      endpoint, // 'banks' or 'payments' or 'all'
      organizationId 
    } = req.query;

    // Default to last 30 days if no dates provided
    // Always include today (real-time)
    const now = new Date();
    const end = endDate ? new Date(endDate as string) : now;
    const start = startDate ? new Date(startDate as string) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Build filter for activities (use createdAt for real-time)
    const filter: any = {
      createdAt: { $gte: start, $lte: end }
    };

    // Filter by organization if provided (for org admin)
    if (organizationId) {
      filter.organizationId = organizationId;
    }

    // Filter by endpoint type
    if (endpoint && endpoint !== 'all') {
      if (endpoint === 'banks') {
        filter.action = { $in: ['LIST_BANKS', 'GET_BANK', 'SYNC_BANKS'] };
      } else if (endpoint === 'payments') {
        filter.action = { $in: ['CREATE_PAYMENT', 'GET_PAYMENT', 'LIST_PAYMENTS', 'CANCEL_PAYMENT', 'SYNC_PAYMENT'] };
      }
    }

    // Get daily aggregated data
    const analytics = await activityService.getAnalyticsData(filter, start, end);

    res.json({
      success: true,
      data: {
        analytics,
        period: {
          startDate: start,
          endDate: end
        }
      }
    });

  } catch (error: any) {
    logger.error('Error fetching endpoint analytics:', error);
    next(error);
  }
};

// Get payment analytics
export const getPaymentAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      startDate, 
      endDate, 
      status,
      provider,
      organizationId 
    } = req.query;

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Build filter for payments
    const filter: any = {
      createdAt: { $gte: start, $lte: end }
    };

    // Filter by organization if provided (for org admin)
    if (organizationId) {
      filter.organizationId = organizationId;
    }

    // Filter by status if provided
    if (status) {
      filter.status = status;
    }

    // Filter by provider if provided
    if (provider) {
      filter.provider = provider;
    }

    // Get payment analytics
    const analytics = await paymentService.getPaymentAnalytics(filter, start, end);

    res.json({
      success: true,
      data: {
        analytics,
        period: {
          startDate: start,
          endDate: end
        }
      }
    });

  } catch (error: any) {
    logger.error('Error fetching payment analytics:', error);
    next(error);
  }
};

// Get payments with audit trail for the table
export const getPaymentsWithAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status,
      provider,
      organizationId,
      startDate,
      endDate
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {};
    
    if (organizationId) {
      filter.organizationId = organizationId;
    }

    if (status) {
      filter.status = status;
    }

    if (provider) {
      filter.provider = provider;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    const result = await paymentService.getPaymentsWithAudit(filter, limitNum, offset);

    res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    logger.error('Error fetching payments with audit:', error);
    next(error);
  }
};
