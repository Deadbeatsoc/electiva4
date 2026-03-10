import { z } from 'zod';

export const listClientsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

export const createClientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  cedula: z.string().min(5, 'Cedula must be at least 5 characters'),
  phone: z.string().min(7, 'Phone must be at least 7 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  notes: z.string().max(500, 'Notes must be at most 500 characters').optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
