import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { errorResponse } from '../utils/response';

type ValidationSource = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: ValidationSource = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[source];
    const result = schema.safeParse(data);

    if (!result.success) {
      const zodError = result.error as ZodError;
      const details = zodError.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      errorResponse(res, 'Validation failed', 400, details);
      return;
    }

    // Replace the source data with the parsed (and potentially transformed) data
    req[source] = result.data;
    next();
  };
}
