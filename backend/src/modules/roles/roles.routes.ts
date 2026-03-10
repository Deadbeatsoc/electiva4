import { Router } from 'express';
import { validate } from '../../middleware/validation.middleware';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
} from './roles.validation';
import * as rolesController from './roles.controller';

const router = Router();

// GET / - List all roles
router.get(
  '/',
  authenticate,
  requirePermission('roles.read'),
  rolesController.getAll
);

// GET /permissions - List all permissions
router.get(
  '/permissions',
  authenticate,
  requirePermission('roles.read'),
  rolesController.getAllPermissions
);

// GET /:id - Get single role with permissions
router.get(
  '/:id',
  authenticate,
  requirePermission('roles.read'),
  rolesController.getById
);

// POST / - Create role
router.post(
  '/',
  authenticate,
  requirePermission('roles.create'),
  validate(createRoleSchema),
  rolesController.create
);

// PUT /:id - Update role
router.put(
  '/:id',
  authenticate,
  requirePermission('roles.update'),
  validate(updateRoleSchema),
  rolesController.update
);

// PUT /:id/permissions - Assign permissions to role
router.put(
  '/:id/permissions',
  authenticate,
  requirePermission('roles.update'),
  validate(assignPermissionsSchema),
  rolesController.assignPermissions
);

export default router;
