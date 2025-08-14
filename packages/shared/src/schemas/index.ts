// Placeholder for Zod validation schemas
// This will be populated in subsequent tasks

import { z } from 'zod';

export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});