// apps/api/src/routes/public/payment.routes.ts
import { Router } from 'express';
import { 
  createPayment,
  getPayment,
  getPayments,
  cancelPayment,
  syncPaymentStatus,
  getSupportedProviders,
  getPaymentForHostedPages
} from '../../controllers/public/payment.controller';
import { apiKeyAuth } from '../../middleware/apiKeyAuth';
import { paymentTokenAuth } from '../../middleware/paymentTokenAuth';

const router = Router();

// Public routes for clients - require API key authentication
router.get('/providers', apiKeyAuth('read'), getSupportedProviders);
router.get('/', apiKeyAuth('read'), getPayments);
router.post('/', apiKeyAuth('write'), createPayment);
router.get('/:paymentId', apiKeyAuth('read'), getPayment);
router.post('/:paymentId/cancel', apiKeyAuth('write'), cancelPayment);
router.post('/:paymentId/sync', apiKeyAuth('read'), syncPaymentStatus);

// Hosted pages route - requires payment token authentication
router.get('/:paymentId/hosted', paymentTokenAuth, getPaymentForHostedPages);

export default router;
