import { z } from 'zod';
import { PROJECT_VALIDATION } from '../constants';

/**
 * Project validation schemas using Zod
 */

export const ProjectNameSchema = z
  .string()
  .min(PROJECT_VALIDATION.NAME_MIN_LENGTH, `Project name must be at least ${PROJECT_VALIDATION.NAME_MIN_LENGTH} character(s)`)
  .max(PROJECT_VALIDATION.NAME_MAX_LENGTH, `Project name must not exceed ${PROJECT_VALIDATION.NAME_MAX_LENGTH} characters`)
  .trim();

export const ProjectDescriptionSchema = z
  .string()
  .max(PROJECT_VALIDATION.DESCRIPTION_MAX_LENGTH, `Project description must not exceed ${PROJECT_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`)
  .optional();

export const ProjectStatusSchema = z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED']);

export const ProjectRoleSchema = z.enum(['OWNER', 'MANAGER', 'MEMBER', 'VIEWER']);

export const ProjectIdSchema = z.string().uuid('Invalid project ID format');

export const CreateProjectSchema = z.object({
  name: ProjectNameSchema,
  description: ProjectDescriptionSchema,
  workspaceId: z.string().uuid('Invalid workspace ID format'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budget: z.number().min(0).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color format').optional(),
});

export const UpdateProjectSchema = z.object({
  name: ProjectNameSchema.optional(),
  description: ProjectDescriptionSchema,
  status: ProjectStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budget: z.number().min(0).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color format').optional(),
});

export const ProjectQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'status', 'startDate', 'endDate', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: ProjectStatusSchema.optional(),
  workspaceId: z.string().uuid().optional(),
  search: z.string().min(1).max(255).optional(),
});

export const ProjectParamsSchema = z.object({
  id: ProjectIdSchema,
});

export const ProjectMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  role: ProjectRoleSchema,
});

export const AddProjectMemberSchema = z.object({
  members: z.array(ProjectMemberSchema).min(1).max(50),
});

export const UpdateProjectMemberSchema = z.object({
  role: ProjectRoleSchema,
});

export const ProjectMemberParamsSchema = z.object({
  projectId: ProjectIdSchema,
  userId: z.string().uuid('Invalid user ID format'),
});

// Type exports
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ProjectQuery = z.infer<typeof ProjectQuerySchema>;
export type ProjectParams = z.infer<typeof ProjectParamsSchema>;
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
export type AddProjectMemberInput = z.infer<typeof AddProjectMemberSchema>;
export type UpdateProjectMemberInput = z.infer<typeof UpdateProjectMemberSchema>;
export type ProjectMemberParams = z.infer<typeof ProjectMemberParamsSchema>;