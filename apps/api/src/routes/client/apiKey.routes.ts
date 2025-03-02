// apps/api/src/routes/client/apiKey.routes.ts
import { Router } from 'express';
import { 
  getApiKeys, 
  getApiKey, 
  createApiKey, 
  revokeApiKey 
} from '../../controllers/client/apiKey.controller';
import { authenticate } from '../../middleware/auth';
import { validateCreateApiKey } from '../../middleware/validators';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getApiKeys);
router.get('/:id', getApiKey);
router.post('/', validateCreateApiKey, createApiKey);
router.delete('/:id', revokeApiKey);

export default router;