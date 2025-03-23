// apps/api/src/routes/public/stubbed-bank.routes.ts
import { Router } from 'express';
import { 
  getBanks,
  getBank,
  getSupportedProviders,
  syncBanks
} from '../../controllers/public/stubbed-bank.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth';
import { apiKeyAuth } from '../../middleware/apiKeyAuth';

const router = Router();

// Public routes accessible with API key
router.get('/', apiKeyAuth, getBanks);
router.get('/providers', apiKeyAuth, getSupportedProviders);
router.get('/:id', apiKeyAuth, getBank);

// Admin routes requiring admin authentication
router.post('/sync', authenticate, authorizeAdmin, syncBanks);

export default router;