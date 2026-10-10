import { Router } from 'express';
import { me } from '../../controllers/admin/auth.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth';

const router = Router();

// Sign-in, password reset and first-admin setup are handled by Supabase Auth.
// The first superadmin is created with `npm run bootstrap:superadmin`.
router.get('/me', authenticate, authorizeAdmin, me);

export default router;
