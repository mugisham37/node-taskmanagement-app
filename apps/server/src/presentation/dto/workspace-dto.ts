import { z } from 'zod';
import {
  BaseDto,
  BaseQuerySchema,
  IdSchema,
  NameSchema,
  DescriptionSchema,
} from './base-dto';

// Workspace DTOs
export interface WorkspaceResponseDto extends BaseDto {
  name: string;
  description: string | null;
  ownerId: string;
  ownerName: string;
  isActive: boolean;
  memberCount: number;
  projectCount: number;
}

export interface CreateWorkspaceRequestDto {
  name: string;
  description?: string;
}

export interface UpdateWorkspaceRequestDto {
  name?: string;
  description?: string;
}

export interface WorkspaceMemberResponseDto {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: Date;
  isActive: boolean;
}

export interface InviteWorkspaceMemberRequestDto {
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface UpdateWorkspaceMemberRequestDto {
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  isActive?: boolean;
}

export interface WorkspaceStatsDto {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  totalMembers: number;
  activeMembers: number;
}

export interface WorkspaceInvitationResponseDto {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  invitedById: string;
  invitedByName: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  expiresAt: Date;
  createdAt: Date;
}

// Validation schemas
const WorkspaceRoleSchema = z.enum(['ADMIN', 'MEMBER', 'VIEWER']);

export const CreateWorkspaceSchema = z.object({
  name: NameSchema,
  description: DescriptionSchema,
});

export const UpdateWorkspaceSchema = z
  .object({
    name: NameSchema.optional(),
    description: DescriptionSchema,
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const InviteWorkspaceMemberSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: WorkspaceRoleSchema,
});

export const UpdateWorkspaceMemberSchema = z
  .object({
    role: WorkspaceRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const WorkspaceQuerySchema = BaseQuerySchema.extend({
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  ownerId: IdSchema.optional(),
});

export const WorkspaceMemberQuerySchema = BaseQuerySchema.extend({
  search: z.string().optional(),
  role: WorkspaceRoleSchema.optional(),
  isActive: z.coerce.boolean().optional(),
});

// Type exports
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceRequest = z.infer<typeof UpdateWorkspaceSchema>;
export type InviteWorkspaceMemberRequest = z.infer<
  typeof InviteWorkspaceMemberSchema
>;
export type UpdateWorkspaceMemberRequest = z.infer<
  typeof UpdateWorkspaceMemberSchema
>;
export type WorkspaceQuery = z.infer<typeof WorkspaceQuerySchema>;
export type WorkspaceMemberQuery = z.infer<typeof WorkspaceMemberQuerySchema>;
