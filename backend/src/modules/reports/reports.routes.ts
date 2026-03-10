import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import * as reportsController from './reports.controller';
import {
  portfolioStatusQuerySchema,
  reportDateRangeQuerySchema,
} from './reports.validation';

const router = Router();

router.use(authenticate, requireRole('admin', 'auxiliar'));

router.get('/collectors', reportsController.collectors);

router.get(
  '/collection-summary',
  validate(reportDateRangeQuerySchema, 'query'),
  reportsController.collectionSummary
);

router.get(
  '/portfolio-status',
  validate(portfolioStatusQuerySchema, 'query'),
  reportsController.portfolioStatus
);

router.get(
  '/movements',
  validate(reportDateRangeQuerySchema, 'query'),
  reportsController.movementHistory
);

router.get(
  '/cash-closures',
  validate(reportDateRangeQuerySchema, 'query'),
  reportsController.cashClosures
);

export default router;
