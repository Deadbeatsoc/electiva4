import { z } from 'zod';

const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const baseReportSchema = z
  .object({
    from: dateKeySchema.optional(),
    to: dateKeySchema.optional(),
    collectorId: z.string().uuid('Invalid collector ID').optional(),
  })
  .refine(
    (value) => {
      if (!value.from || !value.to) return true;
      return value.from <= value.to;
    },
    {
      message: 'from date must be less than or equal to to date',
      path: ['from'],
    }
  );

export const reportDateRangeQuerySchema = baseReportSchema;

export const portfolioStatusQuerySchema = z.object({
  collectorId: z.string().uuid('Invalid collector ID').optional(),
});

export type ReportDateRangeQuery = z.infer<typeof reportDateRangeQuerySchema>;
export type PortfolioStatusQuery = z.infer<typeof portfolioStatusQuerySchema>;
