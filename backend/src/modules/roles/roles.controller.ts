import { Request, Response, NextFunction } from 'express';
import * as rolesService from './roles.service';
import { successResponse } from '../../utils/response';

export async function getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = await rolesService.findAll();

    successResponse(res, roles, 'Roles retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    const role = await rolesService.findById(id);

    successResponse(res, role, 'Role retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = await rolesService.create(req.body);

    successResponse(res, role, 'Role created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    const role = await rolesService.update(id, req.body);

    successResponse(res, role, 'Role updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function assignPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    const { permissionIds } = req.body;
    const role = await rolesService.assignPermissions(id, permissionIds);

    successResponse(res, role, 'Permissions assigned successfully');
  } catch (error) {
    next(error);
  }
}

export async function getAllPermissions(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const permissions = await rolesService.getAllPermissions();

    successResponse(res, permissions, 'Permissions retrieved successfully');
  } catch (error) {
    next(error);
  }
}
