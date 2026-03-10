import { z } from 'zod';

export const createPaymentSchema = z.object({
  loanId: z.string().uuid('Invalid loan ID'),
  amount: z.number().positive('Amount must be greater than zero'),
}).strict();

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
