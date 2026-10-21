import { Router } from 'express';
import { register, login, getMe, demoLogin } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/demo', authRateLimiter, demoLogin);
router.get('/me', requireAuth, getMe);

export default router;
