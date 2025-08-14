import { z } from 'zod';
import { ProjectStatus, ProjectPriority, ProjectRole } from '../types/projects';

// Project permission schema
export const projectPermissionSchema = z.object({
  resource: z.string().min(1).max(50),
  actions: z.array(z.string().min(1).max(50)),
});

// Project member schema
export const projectMemberSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.nativeEnum(ProjectRole),
  joinedAt: z.date(),
  permissions: z.array(projectPermissionSchema).default([]),
});

// Project settings schema
export const projectSettingsSchema = z.object({
  isPublic: z.boolean().default(false),
  allowGuestAccess: z.boolean().default(false),
  taskAutoAssignment: z.boolean().default(false),
  notificationSettings: z.object({
    taskUpdates: z.boolean().default(true),
    deadlineReminders: z.boolean().default(true),
    memberJoined: z.boolean().default(true),
    projectUpdates: z.boolean().default(true),
  }).default({}),
  workflowSettings: z.object({
    allowStatusTransitions: z.record(z.string(), z.array(z.string())).default({}),
    requireApprovalForCompletion: z.boolean().default(false),
    autoCloseCompletedTasks: z.boolean().default(false),
  }).default({}),
});

// Main project schema
export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Project name is required').max(255, 'Project name must be less than 255 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  status: z.nativeEnum(ProjectStatus),
  priority: z.nativeEnum(ProjectPriority),
  ownerId: z.string().uuid('Invalid owner ID'),
  members: z.array(projectMemberSchema).default([]),
  tags: z.array(z.string().min(1).max(50)).default([]),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  budget: z.number().positive().optional(),
  progress: z.number().min(0).max(100).default(0),
  settings: projectSettingsSchema.default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Create project request schema
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255, 'Project name must be less than 255 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  priority: z.nativeEnum(ProjectPriority).default(ProjectPriority.MEDIUM),
  tags: z.array(z.string().min(1).max(50)).default([]),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  budget: z.number().positive().optional(),
  settings: projectSettingsSchema.partial().optional(),
});

// Update project request schema
export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255, 'Project name must be less than 255 characters').optional(),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  priority: z.nativeEnum(ProjectPriority).optional(),
  tags: z.array(z.string().min(1).max(50)).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  budget: z.number().positive().optional(),
  progress: z.number().min(0).max(100).optional(),
  settings: projectSettingsSchema.partial().optional(),
});

// Project filter schema
export const projectFilterSchema = z.object({
  status: z.array(z.nativeEnum(ProjectStatus)).optional(),
  priority: z.array(z.nativeEnum(ProjectPriority)).optional(),
  ownerId: z.array(z.string().uuid()).optional(),
  memberId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  startDateFrom: z.date().optional(),
  startDateTo: z.date().optional(),
  endDateFrom: z.date().optional(),
  endDateTo: z.date().optional(),
  search: z.string().max(255).optional(),
});

// Project stats schema
export const projectStatsSchema = z.object({
  total: z.number().nonnegative(),
  byStatus: z.record(z.nativeEnum(ProjectStatus), z.number().nonnegative()),
  byPriority: z.record(z.nativeEnum(ProjectPriority), z.number().nonnegative()),
  totalTasks: z.number().nonnegative(),
  completedTasks: z.number().nonnegative(),
  overdueTasks: z.number().nonnegative(),
  totalMembers: z.number().nonnegative(),
  averageProgress: z.number().min(0).max(100),
});

// Validation for date ranges
export const projectDateRangeSchema = createProjectSchema.refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: 'Start date must be before end date',
    path: ['startDate'],
  }
);