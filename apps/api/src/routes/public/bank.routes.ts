// apps/api/src/routes/public/bank.routes.ts
import { Router } from 'express';
import { 
  getBanks,
  getBank,
  getSupportedProviders,
  syncBanks
} from '../../controllers/public/bank.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth';
import { apiKeyAuth } from '../../middleware/apiKeyAuth';

const router = Router();

// Public routes for clients - require API key authentication
router.get('/', apiKeyAuth('read'), getBanks);
router.get('/providers', apiKeyAuth('read'), getSupportedProviders);
router.get('/:id', apiKeyAuth('read'), getBank);

// Admin routes
router.post('/sync', authenticate, authorizeAdmin, syncBanks);

export default router;