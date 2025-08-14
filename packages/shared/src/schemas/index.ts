import { z } from 'zod';

// Base entity schema
export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Export all schema modules
export * from './api.schemas';
export * from './auth.schemas';
export * from './task.schemas';
export * from './project.schemas';
export * from './user.schemas';