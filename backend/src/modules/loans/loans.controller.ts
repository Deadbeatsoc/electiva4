import { Request, Response, NextFunction } from 'express';
import * as loansService from './loans.service';
import { paginatedResponse, successResponse } from '../../utils/response';
import { registerCollectorActivity } from '../collector/collector.service';

export async function getAll(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { page, limit, search, status } = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      status?: string;
    };

    const result = await loansService.findAllForCollector(req.user!.id, {
      page,
      limit,
      search,
      status,
    });
    await registerCollectorActivity(req.user!.id, 'list_loans', 'loans');

    paginatedResponse(
      res,
      result.data,
      result.pagination,
      'Loans retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
}

export async function createForClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientId = String(req.params.clientId);
    const loan = await loansService.createForClient(req.user!.id, clientId, req.body);
    await registerCollectorActivity(req.user!.id, 'create_loan', 'loans', loan.id);
    successResponse(res, loan, 'Loan created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function renew(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const loanId = String(req.params.loanId);
    const loan = await loansService.renewLoan(req.user!.id, loanId, req.body);
    await registerCollectorActivity(req.user!.id, 'renew_loan', 'loans', loan.id);
    successResponse(res, loan, 'Loan renewed successfully', 201);
  } catch (error) {
    next(error);
  }
}
