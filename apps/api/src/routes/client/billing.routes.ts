// apps/api/src/routes/client/billing.routes.ts
import { Router } from 'express';
import {
  getSubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  getBillingUsage,
  createBillingPortalSession,
  handleCheckoutSuccess
} from '../../controllers/client/billing.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Get current subscription
router.get('/subscription', getSubscription);

// Create new subscription
router.post('/subscription', createSubscription);

// Update subscription plan
router.put('/subscription', updateSubscription);

// Cancel subscription
router.delete('/subscription', cancelSubscription);

// Get billing usage
router.get('/usage', getBillingUsage);

// Create billing portal session
router.post('/portal', createBillingPortalSession);

// Handle successful checkout
router.post('/checkout/success', handleCheckoutSuccess);

export default router;
