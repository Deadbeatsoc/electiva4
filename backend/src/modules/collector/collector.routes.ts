import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import * as collectorController from './collector.controller';

const router = Router();

router.get(
  '/day-overview',
  authenticate,
  requireRole('cobrador'),
  collectorController.dayOverview
);

router.post(
  '/close-cash',
  authenticate,
  requireRole('cobrador'),
  collectorController.closeCash
);

export default router;
