import { Router } from 'express';
import { validate } from '../../middleware/validation.middleware';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { createUserSchema, updateUserSchema } from './users.validation';
import * as usersController from './users.controller';

const router = Router();

// GET / - List users (paginated)
router.get(
  '/',
  authenticate,
  requireRole('admin'),
  usersController.getAll
);

// GET /:id - Get single user
router.get(
  '/:id',
  authenticate,
  requireRole('admin'),
  usersController.getById
);

// POST / - Create user
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validate(createUserSchema),
  usersController.create
);

// PUT /:id - Update user
router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(updateUserSchema),
  usersController.update
);

// PATCH /:id/toggle-active - Toggle active status
router.patch(
  '/:id/toggle-active',
  authenticate,
  requireRole('admin'),
  usersController.toggleActive
);

export default router;
