// apps/api/src/routes/admin/apiKey.routes.ts
import { Router } from 'express';
import { 
  createApiKey, 
  getApiKeys, 
  getApiKeyById, 
  revokeApiKey 
} from '../../controllers/admin/apiKey.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth';

const router = Router();

// All routes require admin authentication
router.use(authenticate, authorizeAdmin);

router.post('/', createApiKey);
router.get('/', getApiKeys);
router.get('/:id', getApiKeyById);
router.delete('/:id', revokeApiKey);

export default router;