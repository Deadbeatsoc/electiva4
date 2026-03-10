import { Request, Response, NextFunction } from 'express';
import * as clientsService from './clients.service';
import { paginatedResponse, successResponse } from '../../utils/response';
import { registerCollectorActivity } from '../collector/collector.service';

export async function getAll(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { page, limit, search } = req.query as {
      page?: string;
      limit?: string;
      search?: string;
    };

    const result = await clientsService.findAllForCollector(req.user!.id, {
      page,
      limit,
      search,
    });
    await registerCollectorActivity(req.user!.id, 'list_clients', 'clients');

    paginatedResponse(
      res,
      result.data,
      result.pagination,
      'Clients retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
}

export async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const client = await clientsService.createForCollector(req.user!.id, req.body);
    await registerCollectorActivity(req.user!.id, 'create_client', 'clients', client.id);
    successResponse(res, client, 'Client created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function getById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientId = String(req.params.id);
    const client = await clientsService.findDetailForCollector(req.user!.id, clientId);
    await registerCollectorActivity(req.user!.id, 'view_client_detail', 'clients', clientId);
    successResponse(res, client, 'Client detail retrieved successfully');
  } catch (error) {
    next(error);
  }
}
