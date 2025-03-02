import { Router } from 'express';
import { 
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationUsers,
  getOrganizationApiKeys,
  getOrganizationActivities
} from '../../controllers/admin/organization.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth';
import { validateCreateOrganization, validateUpdateOrganization } from '../../middleware/validators';

const router = Router();

// All routes require admin authentication
router.use(authenticate, authorizeAdmin);

router.get('/', getOrganizations);
router.get('/:id', getOrganizationById);
router.post('/', validateCreateOrganization, createOrganization);
router.put('/:id', validateUpdateOrganization, updateOrganization);
router.delete('/:id', deleteOrganization);
router.get('/:id/users', getOrganizationUsers);
router.get('/:id/api-keys', getOrganizationApiKeys);
router.get('/:id/activities', getOrganizationActivities);

export default router;