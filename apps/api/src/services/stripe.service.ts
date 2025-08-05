// apps/api/src/services/stripe.service.ts
import Stripe from 'stripe';
import { Organization } from '../models/organization.model';
import { Subscription } from '../models/subscription.model';
import { BillingUsage } from '../models/billing.model';
import { winstonLogger as logger } from '../utils/logger';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil'
});

// Plan configurations matching your Stripe products
export const PLANS = {
  starter: {
    name: 'Syntropi Starter plan',
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
    productId: process.env.STRIPE_STARTER_PRODUCT_ID!,
    limits: {
      payments: 100,
      apiCalls: 1000,
      users: 5
    }
  },
  growth: {
    name: 'Syntropi Growth plan',
    priceId: process.env.STRIPE_GROWTH_PRICE_ID!,
    productId: process.env.STRIPE_GROWTH_PRODUCT_ID!,
    limits: {
      payments: 1000,
      apiCalls: 10000,
      users: 25
    }
  },
  enterprise: {
    name: 'Syntropi Enterprise plan',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    productId: process.env.STRIPE_ENTERPRISE_PRODUCT_ID!,
    limits: {
      payments: -1, // Unlimited
      apiCalls: -1, // Unlimited
      users: -1 // Unlimited
    }
  }
};

export class StripeService {
  // Create or retrieve Stripe customer
  static async createOrGetCustomer(organizationId: string): Promise<Stripe.Customer> {
    try {
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Check if customer already exists
      if (organization.stripeCustomerId) {
        const customer = await stripe.customers.retrieve(organization.stripeCustomerId);
        if (!customer.deleted) {
          return customer as Stripe.Customer;
        }
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email: organization.contactEmail,
        name: organization.name,
        metadata: {
          organizationId: organizationId
        }
      });

      // Update organization with customer ID
      organization.stripeCustomerId = customer.id;
      await organization.save();

      logger.info(`Created Stripe customer ${customer.id} for organization ${organizationId}`);
      return customer;
    } catch (error) {
      logger.error('Error creating/getting Stripe customer:', error);
      throw error;
    }
  }

  // Create subscription
  static async createSubscription(organizationId: string, plan: keyof typeof PLANS): Promise<Stripe.Subscription> {
    try {
      const customer = await this.createOrGetCustomer(organizationId);
      const planConfig = PLANS[plan];

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price: planConfig.priceId
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          organizationId: organizationId,
          plan: plan
        }
      });

      // Save subscription to database
      await this.saveSubscriptionToDatabase(subscription, organizationId, plan);

      logger.info(`Created subscription ${subscription.id} for organization ${organizationId}`);
      return subscription;
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  // Update subscription
  static async updateSubscription(organizationId: string, newPlan: keyof typeof PLANS): Promise<Stripe.Subscription> {
    try {
      const existingSubscription = await Subscription.findOne({ organizationId });
      if (!existingSubscription) {
        throw new Error('No existing subscription found');
      }

      const newPlanConfig = PLANS[newPlan];
      
      const subscription = await stripe.subscriptions.update(existingSubscription.stripeSubscriptionId, {
        items: [{
          id: (await stripe.subscriptions.retrieve(existingSubscription.stripeSubscriptionId)).items.data[0].id,
          price: newPlanConfig.priceId
        }],
        proration_behavior: 'create_prorations'
      });

      // Update database
      await this.saveSubscriptionToDatabase(subscription, organizationId, newPlan);

      logger.info(`Updated subscription ${subscription.id} to ${newPlan} plan`);
      return subscription;
    } catch (error) {
      logger.error('Error updating subscription:', error);
      throw error;
    }
  }

  // Cancel subscription
  static async cancelSubscription(organizationId: string, cancelAtPeriodEnd: boolean = true): Promise<Stripe.Subscription> {
    try {
      const existingSubscription = await Subscription.findOne({ organizationId });
      if (!existingSubscription) {
        throw new Error('No existing subscription found');
      }

      const subscription = await stripe.subscriptions.update(existingSubscription.stripeSubscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd
      });

      // Update database
      existingSubscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
      if (!cancelAtPeriodEnd) {
        existingSubscription.status = 'canceled';
        existingSubscription.canceledAt = new Date();
      }
      await existingSubscription.save();

      logger.info(`${cancelAtPeriodEnd ? 'Scheduled cancellation' : 'Cancelled'} subscription ${subscription.id}`);
      return subscription;
    } catch (error) {
      logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  // Get subscription details
  static async getSubscription(organizationId: string): Promise<{ subscription: any; stripeSubscription: Stripe.Subscription | null }> {
    try {
      const subscription = await Subscription.findOne({ organizationId }).populate('organizationId');
      if (!subscription) {
        return { subscription: null, stripeSubscription: null };
      }

      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      
      return { subscription, stripeSubscription };
    } catch (error) {
      logger.error('Error getting subscription:', error);
      throw error;
    }
  }

  // Create billing portal session
  static async createBillingPortalSession(organizationId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    try {
      const customer = await this.createOrGetCustomer(organizationId);
      
      const session = await stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: returnUrl
      });

      return session;
    } catch (error) {
      logger.error('Error creating billing portal session:', error);
      throw error;
    }
  }

  // Get all customers (for platform admin)
  static async getAllCustomers(limit: number = 100): Promise<Stripe.Customer[]> {
    try {
      const customers = await stripe.customers.list({ limit });
      return customers.data;
    } catch (error) {
      logger.error('Error getting all customers:', error);
      throw error;
    }
  }

  // Get revenue metrics (for platform admin)
  static async getRevenueMetrics(startDate: Date, endDate: Date): Promise<{
    totalRevenue: number;
    subscriptionRevenue: number;
    refunds: number;
    netRevenue: number;
  }> {
    try {
      const charges = await stripe.charges.list({
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000)
        },
        limit: 100
      });

      const totalRevenue = charges.data
        .filter(charge => charge.paid && !charge.refunded)
        .reduce((sum, charge) => sum + charge.amount, 0) / 100; // Convert from cents

      const refunds = charges.data
        .filter(charge => charge.refunded)
        .reduce((sum, charge) => sum + charge.amount_refunded, 0) / 100;

      return {
        totalRevenue,
        subscriptionRevenue: totalRevenue, // For simplicity, assuming all revenue is subscription
        refunds,
        netRevenue: totalRevenue - refunds
      };
    } catch (error) {
      logger.error('Error getting revenue metrics:', error);
      throw error;
    }
  }

  // Save subscription to database
  private static async saveSubscriptionToDatabase(
    stripeSubscription: Stripe.Subscription, 
    organizationId: string, 
    plan: keyof typeof PLANS
  ): Promise<void> {
    try {
      const planConfig = PLANS[plan];
      
      await Subscription.findOneAndUpdate(
        { organizationId },
        {
          organizationId,
          stripeCustomerId: stripeSubscription.customer as string,
          stripeSubscriptionId: stripeSubscription.id,
          stripePriceId: planConfig.priceId,
          stripeProductId: planConfig.productId,
          plan,
          status: stripeSubscription.status as any,
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: (stripeSubscription as any).cancel_at_period_end,
          canceledAt: (stripeSubscription as any).canceled_at ? new Date((stripeSubscription as any).canceled_at * 1000) : undefined,
          trialStart: (stripeSubscription as any).trial_start ? new Date((stripeSubscription as any).trial_start * 1000) : undefined,
          trialEnd: (stripeSubscription as any).trial_end ? new Date((stripeSubscription as any).trial_end * 1000) : undefined,
          metadata: stripeSubscription.metadata
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      logger.error('Error saving subscription to database:', error);
      throw error;
    }
  }
}

export default StripeService;
