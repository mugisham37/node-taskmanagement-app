import { z } from 'zod';
import {
  uuidSchema,
  taskStatusSchema,
  prioritySchema,
  paginationSchema,
  dateRangeSchema,
  searchSchema,
  createValidationSchema,
  updateValidationSchema,
  idParamSchema,
  workspaceContextSchema,
  bulkOperationSchema,
  auditSchema,
} from './common.schemas';

// Task entity schema
export const taskSchema = z
  .object({
    id: uuidSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    status: taskStatusSchema,
    priority: prioritySchema,
    dueDate: z.date().optional(),
    estimatedHours: z.number().min(0).max(1000).optional(),
    actualHours: z.number().min(0).max(1000).optional(),
    tags: z.array(z.string().max(50)).max(10).default([]),
    assigneeId: uuidSchema.optional(),
    creatorId: uuidSchema,
    projectId: uuidSchema.optional(),
    workspaceId: uuidSchema,
    parentTaskId: uuidSchema.optional(),
    position: z.number().int().min(0).default(0),
    isArchived: z.boolean().default(false),
    completedAt: z.date().optional(),
    archivedAt: z.date().optional(),
  })
  .merge(auditSchema);

// Task creation schema
export const createTaskSchema = createValidationSchema({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: prioritySchema.default('MEDIUM'),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  assigneeId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
  parentTaskId: uuidSchema.optional(),
  position: z.number().int().min(0).optional(),
});

// Task update schema
export const updateTaskSchema = updateValidationSchema({
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  status: taskStatusSchema,
  priority: prioritySchema,
  dueDate: z.string().datetime(),
  estimatedHours: z.number().min(0).max(1000),
  actualHours: z.number().min(0).max(1000),
  tags: z.array(z.string().max(50)).max(10),
  assigneeId: uuidSchema,
  projectId: uuidSchema,
  parentTaskId: uuidSchema,
  position: z.number().int().min(0),
  isArchived: z.boolean(),
});

// Task query parameters schema
export const taskQuerySchema = paginationSchema
  .merge(dateRangeSchema)
  .merge(searchSchema)
  .extend({
    status: taskStatusSchema.optional(),
    priority: prioritySchema.optional(),
    assigneeId: uuidSchema.optional(),
    projectId: uuidSchema.optional(),
    creatorId: uuidSchema.optional(),
    tags: z.string().optional(), // Comma-separated tags
    isArchived: z.coerce.boolean().optional(),
    dueDateFrom: z.string().datetime().optional(),
    dueDateTo: z.string().datetime().optional(),
    hasParent: z.coerce.boolean().optional(),
    parentTaskId: uuidSchema.optional(),
  });

// Task assignment schema
export const assignTaskSchema = z.object({
  assigneeId: uuidSchema.optional(),
});

// Task status update schema
export const updateTaskStatusSchema = z.object({
  status: taskStatusSchema,
  actualHours: z.number().min(0).max(1000).optional(),
});

// Task position update schema
export const updateTaskPositionSchema = z.object({
  position: z.number().int().min(0),
  projectId: uuidSchema.optional(),
});

// Task bulk operations schema
export const bulkTaskOperationSchema = bulkOperationSchema.extend({
  operation: z.enum([
    'delete',
    'archive',
    'unarchive',
    'assign',
    'update_status',
    'move_to_project',
  ]),
});

export const bulkTaskUpdateSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(100),
  data: z.object({
    status: taskStatusSchema.optional(),
    priority: prioritySchema.optional(),
    assigneeId: uuidSchema.optional(),
    projectId: uuidSchema.optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),
});

// Task comment schema
export const taskCommentSchema = z
  .object({
    id: uuidSchema,
    content: z.string().min(1).max(2000),
    taskId: uuidSchema,
    authorId: uuidSchema,
    parentCommentId: uuidSchema.optional(),
    isEdited: z.boolean().default(false),
    editedAt: z.date().optional(),
  })
  .merge(auditSchema);

export const createTaskCommentSchema = createValidationSchema({
  content: z.string().min(1).max(2000),
  parentCommentId: uuidSchema.optional(),
});

export const updateTaskCommentSchema = updateValidationSchema({
  content: z.string().min(1).max(2000),
});

// Task attachment schema
export const taskAttachmentSchema = z
  .object({
    id: uuidSchema,
    filename: z.string().min(1).max(255),
    originalName: z.string().min(1).max(255),
    mimetype: z.string(),
    size: z.number().min(0),
    url: z.string().url(),
    taskId: uuidSchema,
    uploadedBy: uuidSchema,
  })
  .merge(auditSchema);

// Task activity schema
export const taskActivitySchema = z
  .object({
    id: uuidSchema,
    type: z.enum([
      'created',
      'updated',
      'assigned',
      'status_changed',
      'commented',
      'archived',
      'deleted',
    ]),
    description: z.string(),
    taskId: uuidSchema,
    userId: uuidSchema,
    metadata: z.record(z.any()).optional(),
  })
  .merge(auditSchema);

// Task statistics schema
export const taskStatsSchema = z.object({
  total: z.number().int().min(0),
  byStatus: z.record(taskStatusSchema, z.number().int().min(0)),
  byPriority: z.record(prioritySchema, z.number().int().min(0)),
  overdue: z.number().int().min(0),
  completedThisWeek: z.number().int().min(0),
  completedThisMonth: z.number().int().min(0),
  averageCompletionTime: z.number().min(0).optional(),
});

// Route parameter schemas
export const taskParamsSchema = idParamSchema;
export const taskWithWorkspaceParamsSchema = idParamSchema.merge(
  workspaceContextSchema
);

// Export types
export type Task = z.infer<typeof taskSchema>;
export type CreateTaskRequest = z.infer<typeof createTaskSchema>;
export type UpdateTaskRequest = z.infer<typeof updateTaskSchema>;
export type TaskQueryParams = z.infer<typeof taskQuerySchema>;
export type AssignTaskRequest = z.infer<typeof assignTaskSchema>;
export type UpdateTaskStatusRequest = z.infer<typeof updateTaskStatusSchema>;
export type UpdateTaskPositionRequest = z.infer<
  typeof updateTaskPositionSchema
>;
export type BulkTaskOperationRequest = z.infer<typeof bulkTaskOperationSchema>;
export type BulkTaskUpdateRequest = z.infer<typeof bulkTaskUpdateSchema>;
export type TaskComment = z.infer<typeof taskCommentSchema>;
export type CreateTaskCommentRequest = z.infer<typeof createTaskCommentSchema>;
export type UpdateTaskCommentRequest = z.infer<typeof updateTaskCommentSchema>;
export type TaskAttachment = z.infer<typeof taskAttachmentSchema>;
export type TaskActivity = z.infer<typeof taskActivitySchema>;
export type TaskStats = z.infer<typeof taskStatsSchema>;
