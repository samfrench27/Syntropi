// apps/api/src/controllers/admin/billing.controller.ts
import { Request, Response, NextFunction } from 'express';
import StripeService from '../../services/stripe.service';
import { Subscription } from '../../models/subscription.model';
import { Organization } from '../../models/organization.model';
import { BillingUsage } from '../../models/billing.model';
import { createError } from '../../middleware/errorHandler';
import { winstonLogger as logger } from '../../utils/logger';

// Get all subscriptions
export const getAllSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, plan, limit = 50, offset = 0 } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (plan) filter.plan = plan;

    const subscriptions = await Subscription.find(filter)
      .populate('organizationId', 'name contactEmail plan status')
      .limit(Number(limit))
      .skip(Number(offset))
      .sort({ createdAt: -1 });

    const total = await Subscription.countDocuments(filter);

    res.json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: total > Number(offset) + Number(limit)
        }
      }
    });
  } catch (error: any) {
    logger.error('Error getting all subscriptions:', error);
    next(createError(error.message || 'Failed to get subscriptions', 500));
  }
};

// Get revenue metrics
export const getRevenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate as string) : new Date();

    const revenue = await StripeService.getRevenueMetrics(start, end);

    // Get subscription metrics
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
    const totalSubscriptions = await Subscription.countDocuments();

    // Get plan distribution
    const planDistribution = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        revenue,
        subscriptions: {
          active: activeSubscriptions,
          total: totalSubscriptions,
          planDistribution
        }
      }
    });
  } catch (error: any) {
    logger.error('Error getting revenue metrics:', error);
    next(createError(error.message || 'Failed to get revenue metrics', 500));
  }
};

// Get Stripe account information
export const getStripeAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // This would require Stripe Connect for full account details
    // For now, return basic info
    const subscriptions = await Subscription.find({ status: 'active' });
    const customers = await StripeService.getAllCustomers();

    res.json({
      success: true,
      data: {
        totalCustomers: customers.length,
        activeSubscriptions: subscriptions.length,
        // Add more Stripe account details as needed
      }
    });
  } catch (error: any) {
    logger.error('Error getting Stripe account info:', error);
    next(createError(error.message || 'Failed to get Stripe account info', 500));
  }
};

// Get all customers
export const getCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customers = await StripeService.getAllCustomers();
    
    // Enhance with organization data
    const enhancedCustomers = await Promise.all(
      customers.map(async (customer) => {
        const organization = await Organization.findOne({ stripeCustomerId: customer.id });
        const subscription = await Subscription.findOne({ stripeCustomerId: customer.id });
        
        return {
          ...customer,
          organization,
          subscription
        };
      })
    );

    res.json({
      success: true,
      data: enhancedCustomers
    });
  } catch (error: any) {
    logger.error('Error getting customers:', error);
    next(createError(error.message || 'Failed to get customers', 500));
  }
};

// Update organization plan (admin override)
export const updateOrganizationPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.params;
    const { plan } = req.body;

    if (!plan || !['starter', 'growth', 'enterprise'].includes(plan)) {
      return next(createError('Valid plan is required', 400));
    }

    // Update organization
    const organization = await Organization.findByIdAndUpdate(
      organizationId,
      { plan },
      { new: true }
    );

    if (!organization) {
      return next(createError('Organization not found', 404));
    }

    // Update subscription if it exists
    const existingSubscription = await Subscription.findOne({ organizationId });
    if (existingSubscription) {
      await StripeService.updateSubscription(organizationId, plan as any);
    }

    res.json({
      success: true,
      data: organization
    });
  } catch (error: any) {
    logger.error('Error updating organization plan:', error);
    next(createError(error.message || 'Failed to update organization plan', 500));
  }
};
