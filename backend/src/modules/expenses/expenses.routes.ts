import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { createExpenseSchema } from './expenses.validation';
import * as expensesController from './expenses.controller';

const router = Router();

router.post(
  '/',
  authenticate,
  requireRole('cobrador'),
  validate(createExpenseSchema),
  expensesController.create
);

export default router;
