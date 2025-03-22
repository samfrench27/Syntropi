// apps/api/src/routes/public/bank.routes.ts
import { Router } from 'express';
import { 
  getBanks,
  getBank,
  getSupportedProviders,
  syncBanks
} from '../../controllers/public/bank.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth';

const router = Router();

// Public routes for clients
router.get('/', getBanks);
router.get('/providers', getSupportedProviders);
router.get('/:id', getBank);

// Admin routes
router.post('/sync', authenticate, authorizeAdmin, syncBanks);

export default router;