import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';
import { successResponse, paginatedResponse } from '../../utils/response';

export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, search } = req.query as {
      page?: string;
      limit?: string;
      search?: string;
    };

    const result = await usersService.findAll({ page, limit, search });

    paginatedResponse(res, result.data, result.pagination, 'Users retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    const user = await usersService.findById(id);

    successResponse(res, user, 'User retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await usersService.create(req.body);

    successResponse(res, user, 'User created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    const user = await usersService.update(id, req.body);

    successResponse(res, user, 'User updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function toggleActive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    const user = await usersService.toggleActive(id);

    successResponse(
      res,
      user,
      `User ${user.isActive ? 'activated' : 'deactivated'} successfully`
    );
  } catch (error) {
    next(error);
  }
}
