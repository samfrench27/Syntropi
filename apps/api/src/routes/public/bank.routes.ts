// apps/api/src/routes/public/bank.routes.ts
import { Router } from 'express';
import { 
  getBanks,
  getBank,
  getSupportedProviders,
  syncBanks
} from '../../controllers/public/bank.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth';
import { flexibleAuth } from '../../middleware/flexibleAuth';

const router = Router();

// Public routes for clients - require API key OR JWT token authentication
router.get('/', flexibleAuth('read'), getBanks);
router.get('/providers', flexibleAuth('read'), getSupportedProviders);
router.get('/:id', flexibleAuth('read'), getBank);

// Admin routes
router.post('/sync', authenticate, authorizeAdmin, syncBanks);

export default router;