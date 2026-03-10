import { Request, Response, NextFunction } from 'express';
import {
  closeCashForToday,
  getDayOverview,
  registerCollectorActivity,
} from './collector.service';
import { successResponse } from '../../utils/response';

export async function dayOverview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const collectorId = req.user!.id;
    const overview = await getDayOverview(collectorId);
    await registerCollectorActivity(collectorId, 'view_day_overview', 'collector');
    successResponse(res, overview, 'Collector day overview retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function closeCash(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const collectorId = req.user!.id;
    const result = await closeCashForToday(collectorId);
    await registerCollectorActivity(collectorId, 'close_cash', 'cashRegister', result.shiftId);
    successResponse(res, result, 'Cash register closed successfully');
  } catch (error) {
    next(error);
  }
}
