'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { billingAPI } from '@/lib/api';
import toast from 'react-hot-toast';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  limits: {
    payments: number;
    apiCalls: number;
    users: number;
  };
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

const PLANS: Record<string, Plan> = {
  starter: {
    id: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || 'price_starter_placeholder',
    name: 'Starter',
    price: 10,
    currency: 'GBP',
    interval: 'month',
    features: [
      'Up to 100 payments per month',
      'Basic API access',
      'Email support',
      'Standard reporting'
    ],
    limits: {
      payments: 100,
      apiCalls: 1000,
      users: 5
    }
  },
  growth: {
    id: process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID || 'price_growth_placeholder',
    name: 'Growth',
    price: 50,
    currency: 'GBP',
    interval: 'month',
    features: [
      'Up to 1,000 payments per month',
      'Advanced API features',
      'Priority support',
      'Advanced reporting',
      'Webhooks'
    ],
    limits: {
      payments: 1000,
      apiCalls: 10000,
      users: 25
    }
  },
  enterprise: {
    id: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder',
    name: 'Enterprise',
    price: 150,
    currency: 'GBP',
    interval: 'month',
    features: [
      'Unlimited payments',
      'Full API access',
      'Dedicated support',
      'Custom reporting',
      'Advanced webhooks',
      'SLA guarantee'
    ],
    limits: {
      payments: -1,
      apiCalls: -1,
      users: -1
    }
  }
};

// Debug: Log environment variables
console.log('Stripe Environment Variables:', {
  STARTER: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID,
  GROWTH: process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID,
  ENTERPRISE: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID
});

// Debug: Log actual plan IDs being used
console.log('Plan IDs being used:', {
  starter: PLANS.starter.id,
  growth: PLANS.growth.id,
  enterprise: PLANS.enterprise.id
});

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await billingAPI.getCurrentSubscription();
      
      if (response.data.success) {
        setSubscription(response.data.data.subscription);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = async (planKey: string) => {
    if (subscription?.plan === planKey) return;

    setIsUpgrading(true);
    try {
      const response = subscription 
        ? await billingAPI.updateSubscription({ plan: planKey })
        : await billingAPI.createSubscription({ plan: planKey });

      if (response.data.success) {
        const data = response.data.data;
        
        if (data.clientSecret) {
          // For incomplete subscriptions, redirect to Stripe's hosted invoice page
          if (data.hostedInvoiceUrl) {
            toast.success('Redirecting to payment...');
            window.location.href = data.hostedInvoiceUrl;
          } else {
            // Fallback to payment intent confirmation
            const stripe = await stripePromise;
            if (stripe) {
              const { error } = await stripe.confirmPayment({
                clientSecret: data.clientSecret,
                confirmParams: {
                  return_url: `${window.location.origin}/org-admin/billing?success=true`
                }
              });

              if (error) {
                toast.error('Payment failed: ' + error.message);
              }
            }
          }
        } else {
          // Subscription updated successfully
          toast.success('Plan updated successfully');
          fetchSubscription();
        }
      } else {
        toast.error(response.data.message || 'Failed to update plan');
      }
    } catch (error: any) {
      console.error('Error updating plan:', error);
      toast.error(error?.response?.data?.message || 'Failed to update plan');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    if (!confirm('Are you sure you want to cancel your subscription? It will remain active until the end of your billing period.')) {
      return;
    }

    try {
      const response = await billingAPI.cancelSubscription();

      if (response.data.success) {
        toast.success('Subscription cancelled successfully');
        fetchSubscription();
      } else {
        toast.error(response.data.message || 'Failed to cancel subscription');
      }
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      toast.error(error?.response?.data?.message || 'Failed to cancel subscription');
    }
  };

  const openBillingPortal = async () => {
    try {
      const response = await billingAPI.createBillingPortalSession();

      if (response.data.success) {
        window.location.href = response.data.data.url;
      } else {
        toast.error('Failed to open billing portal');
      }
    } catch (error: any) {
      console.error('Error opening billing portal:', error);
      toast.error(error?.response?.data?.message || 'Failed to open billing portal');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600">Manage your subscription and billing information</p>
        </div>

        {/* Current Subscription */}
        {subscription && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Current Subscription</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Plan</p>
                <p className="font-semibold capitalize">{subscription.plan}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  subscription.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {subscription.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Next billing date</p>
                <p className="font-semibold">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Auto-renewal</p>
                <p className="font-semibold">
                  {subscription.cancelAtPeriodEnd ? 'Cancelled' : 'Active'}
                </p>
              </div>
            </div>
            
            <div className="mt-4 flex space-x-4">
              {subscription.status === 'incomplete' ? (
                <div className="space-y-2">
                  <p className="text-sm text-orange-600">
                    ⚠️ Payment required to activate your subscription
                  </p>
                  <button
                    onClick={() => handlePlanSelect(subscription.plan)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                    disabled={isUpgrading}
                  >
                    {isUpgrading ? 'Processing...' : 'Complete Payment'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={openBillingPortal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Manage Billing
                </button>
              )}
              {!subscription.cancelAtPeriodEnd && subscription.status !== 'incomplete' && (
                <button
                  onClick={handleCancelSubscription}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        )}

        {/* Plan Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-6">
            {subscription ? 'Change Plan' : 'Choose Your Plan'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(PLANS).map(([planKey, plan]) => (
              <div
                key={planKey}
                className={`border rounded-lg p-6 ${
                  subscription?.plan === planKey
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">£{plan.price}</span>
                    <span className="text-gray-600">/{plan.interval}</span>
                  </div>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePlanSelect(planKey)}
                  disabled={subscription?.plan === planKey || isUpgrading}
                  className={`mt-6 w-full py-3 px-4 rounded-md font-semibold ${
                    subscription?.plan === planKey
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {subscription?.plan === planKey 
                    ? 'Current Plan' 
                    : isUpgrading 
                      ? 'Processing...' 
                      : subscription 
                        ? 'Switch to this plan' 
                        : 'Get Started'
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Elements>
  );
}
