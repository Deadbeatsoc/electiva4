import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(7, 'Phone must be at least 7 characters'),
  cedula: z.string().min(5, 'Cedula must be at least 5 characters').optional(),
  roleId: z.string().uuid('Invalid role ID'),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().min(7, 'Phone must be at least 7 characters').optional(),
  cedula: z.string().min(5, 'Cedula must be at least 5 characters').optional(),
  roleId: z.string().uuid('Invalid role ID').optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
