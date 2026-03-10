import { Router } from 'express';
import { validate } from '../../middleware/validation.middleware';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { loginSchema, changePasswordSchema, resetPasswordSchema } from './auth.validation';
import * as authController from './auth.controller';

const router = Router();

// POST /login - Public
router.post('/login', validate(loginSchema), authController.login);

// POST /logout - Public (clears cookie)
router.post('/logout', authController.logout);

// POST /refresh - Public (uses cookie)
router.post('/refresh', authController.refreshToken);

// GET /me - Authenticated current user
router.get('/me', authenticate, authController.me);

// PUT /change-password - Authenticated users
router.put(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

// POST /reset-password/:userId - Admin only
router.post(
  '/reset-password/:userId',
  authenticate,
  requireRole('admin'),
  validate(resetPasswordSchema),
  authController.resetPassword
);

export default router;
