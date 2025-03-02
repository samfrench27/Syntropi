import { Router } from 'express';
import { 
  login, 
  forgotPassword, 
  resetPassword, 
  me, 
  createFirstAdmin,
  checkSetupStatus 
} from '../../controllers/admin/auth.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth';
import { validateLogin, validateResetPassword, validateCreateAdmin } from '../../middleware/validators';

const router = Router();

// Public admin routes
router.post('/login', validateLogin, login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', validateResetPassword, resetPassword);
router.post('/create-first-admin', validateCreateAdmin, createFirstAdmin);
router.get('/setup-status', checkSetupStatus);

// Protected admin routes
router.get('/me', authenticate, authorizeAdmin, me);

export default router;