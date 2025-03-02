// apps/api/src/routes/client/organization.routes.ts
import { Router } from 'express';
import { 
  getOrganization,
  updateOrganization
} from '../../controllers/client/organization.controller';
import { authenticate } from '../../middleware/auth';
import { validateUpdateClientOrganization } from '../../middleware/validators';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getOrganization);
router.put('/', validateUpdateClientOrganization, updateOrganization);

export default router;