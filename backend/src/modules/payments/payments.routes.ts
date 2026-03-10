import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { createPaymentSchema } from './payments.validation';
import * as paymentsController from './payments.controller';

const router = Router();

router.post(
  '/',
  authenticate,
  requireRole('cobrador'),
  validate(createPaymentSchema),
  paymentsController.create
);

export default router;
