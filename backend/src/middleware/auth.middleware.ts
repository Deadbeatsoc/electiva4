import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { config } from '../config';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

interface JwtPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token is required');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;

    prisma.user
      .findFirst({
        where: { id: decoded.userId, isActive: true },
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      })
      .then((user) => {
        if (!user) {
          return next(new UnauthorizedError('User not found or inactive'));
        }

        req.user = user;
        next();
      })
      .catch(() => {
        next(new UnauthorizedError('Authentication failed'));
      });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid or expired token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token has expired'));
    } else {
      next(error);
    }
  }
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userPermissions = req.user.role.permissions.map(
      (rp) => rp.permission.name
    );

    const hasAll = permissions.every((perm) => userPermissions.includes(perm));

    if (!hasAll) {
      throw new ForbiddenError('You do not have the required permissions');
    }

    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userRole = req.user.role.name.toLowerCase();
    const normalizedRoles = roles.map((role) => role.toLowerCase());

    if (!normalizedRoles.includes(userRole)) {
      throw new ForbiddenError('You do not have the required role');
    }

    next();
  };
}
