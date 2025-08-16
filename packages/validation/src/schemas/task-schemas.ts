import { z } from 'zod';
import { TASK_VALIDATION } from '../constants';

/**
 * Task validation schemas using Zod
 */

export const TaskTitleSchema = z
  .string()
  .min(TASK_VALIDATION.TITLE_MIN_LENGTH, `Title must be at least ${TASK_VALIDATION.TITLE_MIN_LENGTH} character(s)`)
  .max(TASK_VALIDATION.TITLE_MAX_LENGTH, `Title must not exceed ${TASK_VALIDATION.TITLE_MAX_LENGTH} characters`)
  .trim();

export const TaskDescriptionSchema = z
  .string()
  .max(TASK_VALIDATION.DESCRIPTION_MAX_LENGTH, `Description must not exceed ${TASK_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`)
  .optional();

export const TaskEstimatedHoursSchema = z
  .number()
  .min(TASK_VALIDATION.MIN_ESTIMATED_HOURS, `Estimated hours must be at least ${TASK_VALIDATION.MIN_ESTIMATED_HOURS}`)
  .max(TASK_VALIDATION.MAX_ESTIMATED_HOURS, `Estimated hours must not exceed ${TASK_VALIDATION.MAX_ESTIMATED_HOURS}`)
  .optional();

export const TaskActualHoursSchema = z
  .number()
  .min(TASK_VALIDATION.MIN_ACTUAL_HOURS, `Actual hours must be at least ${TASK_VALIDATION.MIN_ACTUAL_HOURS}`)
  .max(TASK_VALIDATION.MAX_ACTUAL_HOURS, `Actual hours must not exceed ${TASK_VALIDATION.MAX_ACTUAL_HOURS}`)
  .optional();

export const TaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'ON_HOLD']);

export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']);

export const TaskIdSchema = z.string().uuid('Invalid task ID format');

export const CreateTaskSchema = z.object({
  title: TaskTitleSchema,
  description: TaskDescriptionSchema,
  estimatedHours: TaskEstimatedHoursSchema,
  priority: TaskPrioritySchema.default('MEDIUM'),
  projectId: z.string().uuid('Invalid project ID format'),
  assigneeId: z.string().uuid('Invalid assignee ID format').optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

export const UpdateTaskSchema = z.object({
  title: TaskTitleSchema.optional(),
  description: TaskDescriptionSchema,
  estimatedHours: TaskEstimatedHoursSchema,
  actualHours: TaskActualHoursSchema,
  priority: TaskPrioritySchema.optional(),
  status: TaskStatusSchema.optional(),
  assigneeId: z.string().uuid('Invalid assignee ID format').optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

export const TaskQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['title', 'priority', 'status', 'dueDate', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  assigneeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().min(1).max(255).optional(),
});

export const TaskParamsSchema = z.object({
  id: TaskIdSchema,
});

export const BulkTaskOperationSchema = z.object({
  taskIds: z.array(TaskIdSchema).min(1).max(100),
  operation: z.enum(['delete', 'complete', 'assign', 'updateStatus']),
  data: z.record(z.any()).optional(),
});

// Type exports
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type TaskQuery = z.infer<typeof TaskQuerySchema>;
export type TaskParams = z.infer<typeof TaskParamsSchema>;
export type BulkTaskOperation = z.infer<typeof BulkTaskOperationSchema>;