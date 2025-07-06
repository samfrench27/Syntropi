// apps/api/src/routes/admin/payment.routes.ts
import { Router } from 'express';
import { 
  getPayments,
  getPaymentById
} from '../../controllers/admin/payment.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth';

const router = Router();

// All routes require admin authentication
router.use(authenticate, authorizeAdmin);

// Admin payment routes
router.get('/', getPayments);
router.get('/:id', getPaymentById);

export default router;
