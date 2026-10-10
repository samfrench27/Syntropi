import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { me, signup } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validateSignup } from '../middleware/validators';

const router = Router();

// Signup sends an email and creates records, so it is limited per IP
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many signup attempts. Try again later.' } },
});

router.post('/signup', signupLimiter, validateSignup, signup);
router.get('/me', authenticate, me);

export default router;
