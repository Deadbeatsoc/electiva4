import { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../utils/response';
import { createForCollector } from './payments.service';
import { registerCollectorActivity } from '../collector/collector.service';

export async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const collectorId = req.user!.id;
    const result = await createForCollector(collectorId, req.body);
    await registerCollectorActivity(
      collectorId,
      'register_payment',
      'payments',
      result.loan.id
    );
    successResponse(res, result, 'Payment registered successfully', 201);
  } catch (error) {
    next(error);
  }
}
