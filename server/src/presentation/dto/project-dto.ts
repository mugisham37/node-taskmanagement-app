import { z } from 'zod';
import {
  BaseDto,
  BaseQuerySchema,
  IdSchema,
  NameSchema,
  DescriptionSchema,
  OptionalDateSchema,
} from './base-dto';

// Project DTOs
export interface ProjectResponseDto extends BaseDto {
  name: string;
  description: string | null;
  workspaceId: string;
  workspaceName: string;
  managerId: string;
  managerName: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | 'ON_HOLD';
  startDate: Date | null;
  endDate: Date | null;
  memberCount: number;
  taskCount: number;
  completedTaskCount: number;
}

export interface CreateProjectRequestDto {
  name: string;
  description?: string;
  workspaceId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateProjectRequestDto {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | 'ON_HOLD';
  startDate?: Date;
  endDate?: Date;
}

export interface ProjectMemberResponseDto {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'MANAGER' | 'MEMBER' | 'VIEWER';
  joinedAt: Date;
}

export interface AddProjectMemberRequestDto {
  userId: string;
  role: 'MANAGER' | 'MEMBER' | 'VIEWER';
}

export interface UpdateProjectMemberRequestDto {
  role: 'MANAGER' | 'MEMBER' | 'VIEWER';
}

export interface ProjectStatsDto {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  averageTaskCompletionTime: number | null;
}

// Validation schemas
const ProjectStatusSchema = z.enum([
  'ACTIVE',
  'COMPLETED',
  'ARCHIVED',
  'ON_HOLD',
]);
const ProjectRoleSchema = z.enum(['MANAGER', 'MEMBER', 'VIEWER']);

export const CreateProjectSchema = z
  .object({
    name: NameSchema,
    description: DescriptionSchema,
    workspaceId: IdSchema,
    startDate: OptionalDateSchema,
    endDate: OptionalDateSchema,
  })
  .refine(
    data => !data.startDate || !data.endDate || data.startDate <= data.endDate,
    { message: 'End date must be after start date', path: ['endDate'] }
  );

export const UpdateProjectSchema = z
  .object({
    name: NameSchema.optional(),
    description: DescriptionSchema,
    status: ProjectStatusSchema.optional(),
    startDate: OptionalDateSchema,
    endDate: OptionalDateSchema,
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })
  .refine(
    data => !data.startDate || !data.endDate || data.startDate <= data.endDate,
    { message: 'End date must be after start date', path: ['endDate'] }
  );

export const AddProjectMemberSchema = z.object({
  userId: IdSchema,
  role: ProjectRoleSchema,
});

export const UpdateProjectMemberSchema = z.object({
  role: ProjectRoleSchema,
});

export const ProjectQuerySchema = BaseQuerySchema.extend({
  search: z.string().optional(),
  status: ProjectStatusSchema.optional(),
  workspaceId: IdSchema.optional(),
  managerId: IdSchema.optional(),
});

// Type exports
export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectSchema>;
export type AddProjectMemberRequest = z.infer<typeof AddProjectMemberSchema>;
export type UpdateProjectMemberRequest = z.infer<
  typeof UpdateProjectMemberSchema
>;
export type ProjectQuery = z.infer<typeof ProjectQuerySchema>;
