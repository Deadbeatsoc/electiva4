import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import * as clientsController from './clients.controller';
import { createClientSchema, listClientsQuerySchema } from './clients.validation';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRole('cobrador'),
  validate(listClientsQuerySchema, 'query'),
  clientsController.getAll
);

router.post(
  '/',
  authenticate,
  requireRole('cobrador'),
  validate(createClientSchema),
  clientsController.create
);

router.get(
  '/:id',
  authenticate,
  requireRole('cobrador'),
  clientsController.getById
);

export default router;
