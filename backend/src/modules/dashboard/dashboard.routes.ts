import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import * as dashboardController from './dashboard.controller';

const router = Router();

router.get(
  '/overview',
  authenticate,
  requireRole('admin', 'auxiliar'),
  dashboardController.overview
);

export default router;
