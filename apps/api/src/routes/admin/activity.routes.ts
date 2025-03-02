// apps/api/src/routes/admin/activity.routes.ts
import { Router } from 'express';
import { 
  getActivities,
  getActivityById 
} from '../../controllers/admin/activity.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth';

const router = Router();

// All routes require admin authentication
router.use(authenticate, authorizeAdmin);

router.get('/', getActivities);
router.get('/:id', getActivityById);

export default router;