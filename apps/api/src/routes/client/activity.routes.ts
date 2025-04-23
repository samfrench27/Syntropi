import { Router } from 'express';
import { getActivities } from '../../controllers/client/activity.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All routes require client authentication
router.use(authenticate);

// Get activities for the current organization
router.get('/', getActivities);

export default router; 