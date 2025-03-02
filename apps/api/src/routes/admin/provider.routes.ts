// apps/api/src/routes/admin/provider.routes.ts
import { Router } from 'express';
import { 
  getProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider
} from '../../controllers/admin/provider.controller';
import { authenticate, authorizeAdmin, authorizeSuperAdmin } from '../../middleware/auth';

const router = Router();

// All routes require admin authentication
router.use(authenticate, authorizeAdmin);

router.get('/', getProviders);
router.get('/:id', getProviderById);

// Provider creation/deletion limited to super admin
router.post('/', authorizeSuperAdmin, createProvider);
router.put('/:id', authorizeSuperAdmin, updateProvider);
router.delete('/:id', authorizeSuperAdmin, deleteProvider);

export default router;