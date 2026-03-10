import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { errorResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { config } from '../config';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle our custom AppError instances
  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.message} (status ${err.statusCode})`);
    errorResponse(res, err.message, err.statusCode);
    return;
  }

  // Handle Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[]) || [];
        const fields = target.join(', ');
        logger.warn(`Prisma unique constraint violation on: ${fields}`);
        errorResponse(
          res,
          `A record with that ${fields || 'value'} already exists.`,
          409
        );
        return;
      }
      case 'P2025': {
        logger.warn(`Prisma record not found: ${err.message}`);
        errorResponse(res, 'The requested resource was not found.', 404);
        return;
      }
      default: {
        logger.error(`Prisma error [${err.code}]: ${err.message}`);
        errorResponse(res, 'A database error occurred.', 500);
        return;
      }
    }
  }

  // Handle Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error(`Prisma validation error: ${err.message}`);
    errorResponse(res, 'Invalid data provided.', 400);
    return;
  }

  // Unknown / unhandled errors
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  errorResponse(
    res,
    config.nodeEnv === 'production'
      ? 'An unexpected error occurred.'
      : err.message,
    500
  );
}
