import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export function auditLog(module: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      // Only log successful write operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.id || null;
        const entityId = req.params?.id || body?.data?.id || null;

        prisma.auditLog
          .create({
            data: {
              userId,
              action,
              module,
              entityId: entityId ? String(entityId) : null,
              newData: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
              ipAddress: req.ip || req.socket.remoteAddress || null,
            },
          })
          .catch((err) => {
            logger.error('Failed to create audit log:', err);
          });
      }

      return originalJson(body);
    };

    next();
  };
}
