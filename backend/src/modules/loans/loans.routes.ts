import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import * as loansController from './loans.controller';
import {
  createLoanSchema,
  listLoansQuerySchema,
  renewLoanSchema,
} from './loans.validation';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRole('cobrador'),
  validate(listLoansQuerySchema, 'query'),
  loansController.getAll
);

router.post(
  '/client/:clientId',
  authenticate,
  requireRole('cobrador'),
  validate(createLoanSchema),
  loansController.createForClient
);

router.post(
  '/:loanId/renew',
  authenticate,
  requireRole('cobrador'),
  validate(renewLoanSchema),
  loansController.renew
);

export default router;
