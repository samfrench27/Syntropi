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

// Public routes accessible with API key and specific permissions
router.get('/', apiKeyAuth(['banks:read']), getBanks);
router.get('/providers', apiKeyAuth(['banks:read']), getSupportedProviders);
router.get('/:id', apiKeyAuth(['banks:read']), getBank);

// Admin routes requiring admin authentication
router.post('/sync', authenticate, authorizeAdmin, syncBanks);

export default router;