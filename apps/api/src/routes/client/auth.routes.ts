// apps/api/src/routes/client/auth.routes.ts
import { Router } from 'express';
import { me } from '../../controllers/client/auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Sign-in and password changes are handled by Supabase Auth. Signup is POST /api/auth/signup.
router.get('/me', authenticate, me);

export default router;
