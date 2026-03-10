import { z } from 'zod';

export const createExpenseSchema = z.object({
  category: z.string().min(2, 'Category is required'),
  amount: z.number().positive('Amount must be greater than zero'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
}).strict();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
