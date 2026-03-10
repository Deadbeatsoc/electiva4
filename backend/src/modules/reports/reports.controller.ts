import { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../utils/response';
import * as reportsService from './reports.service';
import type {
  PortfolioStatusQuery,
  ReportDateRangeQuery,
} from './reports.validation';

export async function collectors(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await reportsService.listCollectors();
    successResponse(res, data, 'Collectors retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function collectionSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await reportsService.getCollectionSummary(
      req.query as ReportDateRangeQuery
    );
    successResponse(res, data, 'Collection summary report generated successfully');
  } catch (error) {
    next(error);
  }
}

export async function portfolioStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await reportsService.getPortfolioStatus(
      req.query as PortfolioStatusQuery
    );
    successResponse(res, data, 'Portfolio status report generated successfully');
  } catch (error) {
    next(error);
  }
}

export async function movementHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await reportsService.getMovementHistory(
      req.query as ReportDateRangeQuery
    );
    successResponse(res, data, 'Movement history report generated successfully');
  } catch (error) {
    next(error);
  }
}

export async function cashClosures(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await reportsService.getCashClosures(
      req.query as ReportDateRangeQuery
    );
    successResponse(res, data, 'Cash closure report generated successfully');
  } catch (error) {
    next(error);
  }
}
