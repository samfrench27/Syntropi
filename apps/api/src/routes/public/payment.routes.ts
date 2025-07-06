// apps/api/src/routes/public/payment.routes.ts
import { Router } from 'express';
import { 
  createPayment,
  getPayment,
  getPayments,
  cancelPayment,
  syncPaymentStatus,
  getSupportedProviders
} from '../../controllers/public/payment.controller';
import { apiKeyAuth } from '../../middleware/apiKeyAuth';

const router = Router();

// Public routes for clients - require API key authentication
router.get('/providers', apiKeyAuth('read'), getSupportedProviders);
router.post('/', apiKeyAuth('write'), createPayment);
router.get('/', apiKeyAuth('read'), getPayments);
router.get('/:paymentId', apiKeyAuth('read'), getPayment);
router.post('/:paymentId/cancel', apiKeyAuth('write'), cancelPayment);
router.post('/:paymentId/sync', apiKeyAuth('read'), syncPaymentStatus);

export default router;
