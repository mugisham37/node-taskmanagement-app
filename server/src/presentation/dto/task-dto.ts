import { z } from 'zod';
import {
  BaseDto,
  BaseQuerySchema,
  IdSchema,
  NameSchema,
  DescriptionSchema,
  OptionalDateSchema,
} from './base-dto';

// Task DTOs
export interface TaskResponseDto extends BaseDto {
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId: string | null;
  assigneeName: string | null;
  projectId: string;
  projectName: string;
  createdById: string;
  createdByName: string;
  dueDate: Date | null;
  estimatedHours: number | null;
  actualHours: number | null;
  completedAt: Date | null;
}

export interface CreateTaskRequestDto {
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  projectId: string;
  assigneeId?: string;
  dueDate?: Date;
  estimatedHours?: number;
}

export interface UpdateTaskRequestDto {
  title?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId?: string;
  dueDate?: Date;
  estimatedHours?: number;
}

export interface AssignTaskRequestDto {
  assigneeId: string;
}

export interface CompleteTaskRequestDto {
  actualHours?: number;
}

export interface TaskFiltersDto {
  status?: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId?: string;
  projectId?: string;
  createdById?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  isOverdue?: boolean;
}

// Validation schemas
const TaskStatusSchema = z.enum([
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'COMPLETED',
  'CANCELLED',
]);
const PrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const CreateTaskSchema = z.object({
  title: NameSchema,
  description: DescriptionSchema,
  priority: PrioritySchema,
  projectId: IdSchema,
  assigneeId: IdSchema.optional(),
  dueDate: OptionalDateSchema,
  estimatedHours: z.number().min(0).max(1000).optional(),
});

export const UpdateTaskSchema = z
  .object({
    title: NameSchema.optional(),
    description: DescriptionSchema,
    priority: PrioritySchema.optional(),
    assigneeId: IdSchema.optional(),
    dueDate: OptionalDateSchema,
    estimatedHours: z.number().min(0).max(1000).optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const AssignTaskSchema = z.object({
  assigneeId: IdSchema,
});

export const CompleteTaskSchema = z.object({
  actualHours: z.number().min(0).max(1000).optional(),
});

export const TaskFiltersSchema = z.object({
  status: TaskStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  assigneeId: IdSchema.optional(),
  projectId: IdSchema.optional(),
  createdById: IdSchema.optional(),
  dueDateFrom: OptionalDateSchema,
  dueDateTo: OptionalDateSchema,
  isOverdue: z.coerce.boolean().optional(),
});

export const TaskQuerySchema = BaseQuerySchema.merge(TaskFiltersSchema).extend({
  search: z.string().optional(),
});

// Type exports
export type CreateTaskRequest = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskRequest = z.infer<typeof UpdateTaskSchema>;
export type AssignTaskRequest = z.infer<typeof AssignTaskSchema>;
export type CompleteTaskRequest = z.infer<typeof CompleteTaskSchema>;
export type TaskFilters = z.infer<typeof TaskFiltersSchema>;
export type TaskQuery = z.infer<typeof TaskQuerySchema>;
