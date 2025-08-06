// apps/api/src/controllers/client/billing.controller.ts
import { Request, Response, NextFunction } from 'express';
import StripeService, { PLANS } from '../../services/stripe.service';
import { BillingUsage } from '../../models/billing.model';
import { createError } from '../../middleware/errorHandler';
import { winstonLogger as logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
    organizationId: string;
  };
}

// Get current subscription
export const getSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;

    const { subscription, stripeSubscription } = await StripeService.getSubscription(organizationId);

    res.json({
      success: true,
      data: {
        subscription,
        stripeSubscription,
        plans: PLANS
      }
    });
  } catch (error: any) {
    logger.error('Error getting subscription:', error);
    next(createError(error.message || 'Failed to get subscription', 500));
  }
};

// Create new subscription
export const createSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { plan } = req.body;

    if (!plan || !PLANS[plan as keyof typeof PLANS]) {
      return next(createError('Valid plan is required', 400));
    }

    const checkoutSession = await StripeService.createSubscription(organizationId, plan);

    res.json({
      success: true,
      data: {
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.id
      }
    });
  } catch (error: any) {
    logger.error('Error creating subscription:', error);
    next(createError(error.message || 'Failed to create subscription', 500));
  }
};

// Update subscription plan
export const updateSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { plan } = req.body;

    if (!plan || !PLANS[plan as keyof typeof PLANS]) {
      return next(createError('Valid plan is required', 400));
    }

    const subscription = await StripeService.updateSubscription(organizationId, plan);

    res.json({
      success: true,
      data: subscription
    });
  } catch (error: any) {
    logger.error('Error updating subscription:', error);
    next(createError(error.message || 'Failed to update subscription', 500));
  }
};

// Cancel subscription
export const cancelSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { cancelAtPeriodEnd = true } = req.body;

    const subscription = await StripeService.cancelSubscription(organizationId, cancelAtPeriodEnd);

    res.json({
      success: true,
      data: subscription
    });
  } catch (error: any) {
    logger.error('Error cancelling subscription:', error);
    next(createError(error.message || 'Failed to cancel subscription', 500));
  }
};

// Get billing usage
export const getBillingUsage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { months = 6 } = req.query;

    // Get usage for the last N months
    const now = new Date();
    const usageData = [];

    for (let i = 0; i < Number(months); i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.toISOString().slice(0, 7); // YYYY-MM format
      
      const usage = await BillingUsage.findOne({
        organizationId,
        month
      });

      usageData.push(
        usage?.toObject() || {
          month,
          usage: { payments: 0, apiCalls: 0, successfulPayments: 0, failedPayments: 0 },
          costs: { paymentFees: 0, apiCallFees: 0, subscriptionFee: 0, totalFees: 0 },
          limits: { paymentsLimit: 100, apiCallsLimit: 1000, usersLimit: 5 }
        }
      );
    }

    res.json({
      success: true,
      data: usageData.reverse() // Show oldest to newest
    });
  } catch (error: any) {
    logger.error('Error getting billing usage:', error);
    next(createError(error.message || 'Failed to get billing usage', 500));
  }
};

// Create billing portal session
export const createBillingPortalSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { returnUrl } = req.body;

    if (!returnUrl) {
      return next(createError('Return URL is required', 400));
    }

    const session = await StripeService.createBillingPortalSession(organizationId, returnUrl);

    res.json({
      success: true,
      data: {
        url: session.url
      }
    });
  } catch (error: any) {
    logger.error('Error creating billing portal session:', error);
    next(createError(error.message || 'Failed to create billing portal session', 500));
  }
};

// Handle successful checkout session
export const handleCheckoutSuccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return next(createError('Session ID is required', 400));
    }

    await StripeService.handleSuccessfulCheckout(sessionId);

    res.json({
      success: true,
      message: 'Subscription activated successfully'
    });
  } catch (error: any) {
    logger.error('Error handling checkout success:', error);
    next(createError(error.message || 'Failed to process checkout success', 500));
  }
};
