import { z } from 'zod';

export const listLoansQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'RENEWED']).optional(),
});

export const createLoanSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
});

export const renewLoanSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type RenewLoanInput = z.infer<typeof renewLoanSchema>;
