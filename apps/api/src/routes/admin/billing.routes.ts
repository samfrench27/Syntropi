// apps/api/src/routes/admin/billing.routes.ts
import { Router } from 'express';
import {
  getAllSubscriptions,
  getRevenue,
  getStripeAccount,
  updateOrganizationPlan,
  getCustomers
} from '../../controllers/admin/billing.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

// Apply authentication and platform admin role requirement
router.use(authenticate);
router.use(requireRole('platform-admin'));

// Get all subscriptions
router.get('/subscriptions', getAllSubscriptions);

// Get revenue metrics
router.get('/revenue', getRevenue);

// Get Stripe account info
router.get('/stripe-account', getStripeAccount);

// Get all customers
router.get('/customers', getCustomers);

// Update organization plan (admin override)
router.put('/organizations/:organizationId/plan', updateOrganizationPlan);

export default router;
