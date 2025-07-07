// apps/api/src/routes/admin/analytics.routes.ts
import express from 'express';
import { 
  getEndpointAnalytics, 
  getPaymentAnalytics,
  getPaymentsWithAudit 
} from '../../controllers/admin/analytics.controller';

const router = express.Router();

// Get endpoint analytics (banks vs payments traffic)
router.get('/endpoints', getEndpointAnalytics);

// Get payment analytics
router.get('/payments', getPaymentAnalytics);

// Get payments with audit trail for table
router.get('/payments/audit', getPaymentsWithAudit);

export default router;
