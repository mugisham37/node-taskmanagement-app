import { z } from 'zod';
import { UserRole } from '../types/auth';

// User preferences schema
export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(true),
    desktop: z.boolean().default(true),
    taskAssigned: z.boolean().default(true),
    taskDue: z.boolean().default(true),
    projectUpdates: z.boolean().default(true),
    mentions: z.boolean().default(true),
  }).default({}),
  dashboard: z.object({
    defaultView: z.enum(['list', 'board', 'calendar']).default('list'),
    showCompletedTasks: z.boolean().default(false),
    tasksPerPage: z.number().min(10).max(100).default(25),
  }).default({}),
  privacy: z.object({
    showOnlineStatus: z.boolean().default(true),
    allowDirectMessages: z.boolean().default(true),
    showProfile: z.boolean().default(true),
  }).default({}),
});

// User stats schema
export const userStatsSchema = z.object({
  totalTasks: z.number().nonnegative().default(0),
  completedTasks: z.number().nonnegative().default(0),
  overdueTasks: z.number().nonnegative().default(0),
  totalProjects: z.number().nonnegative().default(0),
  activeProjects: z.number().nonnegative().default(0),
  hoursLogged: z.number().nonnegative().default(0),
  averageTaskCompletionTime: z.number().nonnegative().default(0),
  productivityScore: z.number().min(0).max(100).default(0),
});

// User profile schema
export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(50),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  timezone: z.string().min(1).default('UTC'),
  language: z.string().min(2).max(10).default('en'),
  role: z.nativeEnum(UserRole),
  isActive: z.boolean().default(true),
  isEmailVerified: z.boolean().default(false),
  preferences: userPreferencesSchema.default({}),
  stats: userStatsSchema.default({}),
  lastLoginAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Update user profile request schema
export const updateUserProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  timezone: z.string().min(1).optional(),
  language: z.string().min(2).max(10).optional(),
  avatar: z.string().url().optional(),
});

// Update user preferences request schema
export const updateUserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifications: userPreferencesSchema.shape.notifications.partial().optional(),
  dashboard: userPreferencesSchema.shape.dashboard.partial().optional(),
  privacy: userPreferencesSchema.shape.privacy.partial().optional(),
});

// User filter schema
export const userFilterSchema = z.object({
  role: z.array(z.nativeEnum(UserRole)).optional(),
  isActive: z.boolean().optional(),
  isEmailVerified: z.boolean().optional(),
  search: z.string().max(255).optional(),
  createdFrom: z.date().optional(),
  createdTo: z.date().optional(),
  lastLoginFrom: z.date().optional(),
  lastLoginTo: z.date().optional(),
});

// User invitation schema
export const userInvitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  invitedBy: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  token: z.string().min(1),
  expiresAt: z.date(),
  acceptedAt: z.date().optional(),
  createdAt: z.date(),
});

// Invite user request schema
export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.nativeEnum(UserRole),
  projectId: z.string().uuid().optional(),
  message: z.string().max(500).optional(),
});