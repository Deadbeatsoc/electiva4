import { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../utils/response';
import { getOverview } from './dashboard.service';

export async function overview(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await getOverview();
    successResponse(res, data, 'Dashboard overview retrieved successfully');
  } catch (error) {
    next(error);
  }
}
