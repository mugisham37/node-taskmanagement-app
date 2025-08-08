import { z } from 'zod';
import {
  uuidSchema,
  projectStatusSchema,
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

// Project entity schema
export const projectSchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    status: projectStatusSchema,
    priority: prioritySchema,
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    budget: z.number().min(0).optional(),
    color: z
      .string()
      .regex(/^#[0-9A-F]{6}$/i)
      .optional(),
    ownerId: uuidSchema,
    workspaceId: uuidSchema,
    isArchived: z.boolean().default(false),
    archivedAt: z.date().optional(),
    completedAt: z.date().optional(),
    progress: z.number().min(0).max(100).default(0),
  })
  .merge(auditSchema);

// Project creation schema
export const createProjectSchema = createValidationSchema({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  priority: prioritySchema.default('MEDIUM'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budget: z.number().min(0).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
});

// Project update schema
export const updateProjectSchema = updateValidationSchema({
  name: z.string().min(1).max(100),
  description: z.string().max(2000),
  status: projectStatusSchema,
  priority: prioritySchema,
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  budget: z.number().min(0),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  isArchived: z.boolean(),
});

// Project query parameters schema
export const projectQuerySchema = paginationSchema
  .merge(dateRangeSchema)
  .merge(searchSchema)
  .extend({
    status: projectStatusSchema.optional(),
    priority: prioritySchema.optional(),
    ownerId: uuidSchema.optional(),
    isArchived: z.coerce.boolean().optional(),
    startDateFrom: z.string().datetime().optional(),
    startDateTo: z.string().datetime().optional(),
    endDateFrom: z.string().datetime().optional(),
    endDateTo: z.string().datetime().optional(),
  });

// Project member schema
export const projectMemberSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    userId: uuidSchema,
    role: z.enum(['OWNER', 'MANAGER', 'MEMBER', 'VIEWER']),
    joinedAt: z.date(),
  })
  .merge(auditSchema);

export const addProjectMemberSchema = createValidationSchema({
  userId: uuidSchema,
  role: z.enum(['MANAGER', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

export const updateProjectMemberSchema = updateValidationSchema({
  role: z.enum(['MANAGER', 'MEMBER', 'VIEWER']),
});

// Project statistics schema
export const projectStatsSchema = z.object({
  totalTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  inProgressTasks: z.number().int().min(0),
  overdueTasks: z.number().int().min(0),
  totalMembers: z.number().int().min(0),
  progress: z.number().min(0).max(100),
  estimatedHours: z.number().min(0).optional(),
  actualHours: z.number().min(0).optional(),
  budget: z.number().min(0).optional(),
  spentBudget: z.number().min(0).optional(),
});

// Project bulk operations schema
export const bulkProjectOperationSchema = bulkOperationSchema.extend({
  operation: z.enum(['delete', 'archive', 'unarchive', 'update_status']),
});

export const bulkProjectUpdateSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(100),
  data: z.object({
    status: projectStatusSchema.optional(),
    priority: prioritySchema.optional(),
    ownerId: uuidSchema.optional(),
  }),
});

// Route parameter schemas
export const projectParamsSchema = idParamSchema;
export const projectWithWorkspaceParamsSchema = idParamSchema.merge(
  workspaceContextSchema
);
export const projectMemberParamsSchema = z.object({
  projectId: uuidSchema,
  userId: uuidSchema,
});

// Export types
export type Project = z.infer<typeof projectSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectSchema>;
export type ProjectQueryParams = z.infer<typeof projectQuerySchema>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;
export type AddProjectMemberRequest = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectMemberRequest = z.infer<
  typeof updateProjectMemberSchema
>;
export type ProjectStats = z.infer<typeof projectStatsSchema>;
export type BulkProjectOperationRequest = z.infer<
  typeof bulkProjectOperationSchema
>;
export type BulkProjectUpdateRequest = z.infer<typeof bulkProjectUpdateSchema>;
