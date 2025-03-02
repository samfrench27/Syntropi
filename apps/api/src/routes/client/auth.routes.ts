// apps/api/src/routes/client/auth.routes.ts
import { Router } from 'express';
import { 
  login, 
  me,
  updatePassword
} from '../../controllers/client/auth.controller';
import { authenticate } from '../../middleware/auth';
import { validateLogin, validateUpdatePassword } from '../../middleware/validators';

const router = Router();

// Public client routes
router.post('/login', validateLogin, login);

// Protected client routes
router.get('/me', authenticate, me);
router.post('/update-password', authenticate, validateUpdatePassword, updatePassword);

export default router;