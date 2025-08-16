import { z } from 'zod';
import { WORKSPACE_VALIDATION } from '../constants';

/**
 * Workspace validation schemas using Zod
 */

export const WorkspaceNameSchema = z
  .string()
  .min(WORKSPACE_VALIDATION.NAME_MIN_LENGTH, `Workspace name must be at least ${WORKSPACE_VALIDATION.NAME_MIN_LENGTH} character(s)`)
  .max(WORKSPACE_VALIDATION.NAME_MAX_LENGTH, `Workspace name must not exceed ${WORKSPACE_VALIDATION.NAME_MAX_LENGTH} characters`)
  .trim();

export const WorkspaceDescriptionSchema = z
  .string()
  .max(WORKSPACE_VALIDATION.DESCRIPTION_MAX_LENGTH, `Workspace description must not exceed ${WORKSPACE_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`)
  .optional();

export const WorkspaceSlugSchema = z
  .string()
  .min(3, 'Workspace slug must be at least 3 characters')
  .max(50, 'Workspace slug must not exceed 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Workspace slug can only contain lowercase letters, numbers, and hyphens')
  .refine(slug => !slug.startsWith('-') && !slug.endsWith('-'), {
    message: 'Workspace slug cannot start or end with a hyphen',
  });

export const WorkspaceStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'PENDING_VERIFICATION', 'DELETED']);

export const WorkspaceRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']);

export const WorkspaceIdSchema = z.string().uuid('Invalid workspace ID format');

export const CreateWorkspaceSchema = z.object({
  name: WorkspaceNameSchema,
  slug: WorkspaceSlugSchema,
  description: WorkspaceDescriptionSchema,
  isPublic: z.boolean().default(false),
  settings: z.record(z.any()).optional(),
});

export const UpdateWorkspaceSchema = z.object({
  name: WorkspaceNameSchema.optional(),
  slug: WorkspaceSlugSchema.optional(),
  description: WorkspaceDescriptionSchema,
  isPublic: z.boolean().optional(),
  settings: z.record(z.any()).optional(),
});

export const WorkspaceQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'slug', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: WorkspaceStatusSchema.optional(),
  isPublic: z.boolean().optional(),
  search: z.string().min(1).max(255).optional(),
});

export const WorkspaceParamsSchema = z.object({
  id: WorkspaceIdSchema,
});

export const WorkspaceSlugParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
});

export const WorkspaceMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  role: WorkspaceRoleSchema,
});

export const AddWorkspaceMemberSchema = z.object({
  members: z.array(WorkspaceMemberSchema).min(1).max(100),
});

export const UpdateWorkspaceMemberSchema = z.object({
  role: WorkspaceRoleSchema,
});

export const WorkspaceMemberParamsSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  userId: z.string().uuid('Invalid user ID format'),
});

export const WorkspaceInviteSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: WorkspaceRoleSchema.default('MEMBER'),
  message: z.string().max(500).optional(),
});

export const WorkspaceInvitesSchema = z.object({
  invites: z.array(WorkspaceInviteSchema).min(1).max(50),
});

export const AcceptInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
});

export const WorkspaceSettingsSchema = z.object({
  allowPublicProjects: z.boolean().default(false),
  requireApprovalForMembers: z.boolean().default(true),
  defaultProjectVisibility: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),
  allowGuestAccess: z.boolean().default(false),
  maxProjectsPerMember: z.number().min(1).max(1000).default(100),
  maxTasksPerProject: z.number().min(1).max(10000).default(1000),
  timezone: z.string().default('UTC'),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).default('MM/DD/YYYY'),
  timeFormat: z.enum(['12h', '24h']).default('12h'),
  language: z.string().length(2).default('en'),
});

// Type exports
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;
export type WorkspaceQuery = z.infer<typeof WorkspaceQuerySchema>;
export type WorkspaceParams = z.infer<typeof WorkspaceParamsSchema>;
export type WorkspaceSlugParams = z.infer<typeof WorkspaceSlugParamsSchema>;
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof AddWorkspaceMemberSchema>;
export type UpdateWorkspaceMemberInput = z.infer<typeof UpdateWorkspaceMemberSchema>;
export type WorkspaceMemberParams = z.infer<typeof WorkspaceMemberParamsSchema>;
export type WorkspaceInvite = z.infer<typeof WorkspaceInviteSchema>;
export type WorkspaceInvitesInput = z.infer<typeof WorkspaceInvitesSchema>;
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;