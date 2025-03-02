import { Router } from 'express';
import { 
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserActivities
} from '../../controllers/admin/user.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth';
import { validateCreateUser, validateUpdateUser } from '../../middleware/validators';

const router = Router();

// All routes require admin authentication
router.use(authenticate, authorizeAdmin);

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', validateCreateUser, createUser);
router.put('/:id', validateUpdateUser, updateUser);
router.delete('/:id', deleteUser);
router.get('/:id/activities', getUserActivities);

export default router;