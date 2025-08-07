import { z } from 'zod';
import {
  uuidSchema,
  emailSchema,
  passwordSchema,
  userRoleSchema,
  paginationSchema,
  searchSchema,
  createValidationSchema,
  updateValidationSchema,
  idParamSchema,
  auditSchema,
} from './common.schemas';

// User entity schema
export const userSchema = z
  .object({
    id: uuidSchema,
    email: emailSchema,
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    displayName: z.string().min(1).max(100).optional(),
    avatar: z.string().url().optional(),
    role: userRoleSchema,
    isActive: z.boolean().default(true),
    isEmailVerified: z.boolean().default(false),
    lastLoginAt: z.date().optional(),
    timezone: z.string().default('UTC'),
    language: z.string().default('en'),
    preferences: z.record(z.any()).default({}),
    bio: z.string().max(500).optional(),
    phoneNumber: z.string().max(20).optional(),
    location: z.string().max(100).optional(),
    website: z.string().url().optional(),
    twoFactorEnabled: z.boolean().default(false),
    emailNotifications: z.boolean().default(true),
    pushNotifications: z.boolean().default(true),
  })
  .merge(auditSchema);

// User registration schema
export const registerUserSchema = createValidationSchema({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  timezone: z.string().optional(),
  language: z.string().optional(),
});

// User login schema
export const loginUserSchema = createValidationSchema({
  email: emailSchema,
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

// User update schema
export const updateUserSchema = updateValidationSchema({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  avatar: z.string().url(),
  timezone: z.string(),
  language: z.string(),
  bio: z.string().max(500),
  phoneNumber: z.string().max(20),
  location: z.string().max(100),
  website: z.string().url(),
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
});

// User preferences schema
export const updateUserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
  startOfWeek: z.enum(['sunday', 'monday']).optional(),
  defaultView: z.enum(['list', 'board', 'calendar']).optional(),
  autoSave: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  showCompletedTasks: z.boolean().optional(),
  taskGrouping: z
    .enum(['none', 'status', 'priority', 'assignee', 'project'])
    .optional(),
});

// Password change schema
export const changePasswordSchema = createValidationSchema({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Password reset schemas
export const requestPasswordResetSchema = createValidationSchema({
  email: emailSchema,
});

export const resetPasswordSchema = createValidationSchema({
  token: z.string().min(1),
  password: passwordSchema,
  confirmPassword: z.string().min(1),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Email verification schema
export const verifyEmailSchema = createValidationSchema({
  token: z.string().min(1),
});

// Two-factor authentication schemas
export const enable2FASchema = createValidationSchema({
  password: z.string().min(1),
});

export const verify2FASchema = createValidationSchema({
  token: z.string().length(6).regex(/^\d+$/, 'Token must be 6 digits'),
  backupCode: z.string().optional(),
});

export const disable2FASchema = createValidationSchema({
  password: z.string().min(1),
  token: z
    .string()
    .length(6)
    .regex(/^\d+$/, 'Token must be 6 digits')
    .optional(),
  backupCode: z.string().optional(),
});

// User query parameters schema
export const userQuerySchema = paginationSchema.merge(searchSchema).extend({
  role: userRoleSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  isEmailVerified: z.coerce.boolean().optional(),
  workspaceId: uuidSchema.optional(),
});

// User profile schema (public view)
export const userProfileSchema = userSchema.omit({
  email: true,
  role: true,
  isEmailVerified: true,
  lastLoginAt: true,
  preferences: true,
  phoneNumber: true,
  twoFactorEnabled: true,
  emailNotifications: true,
  pushNotifications: true,
  createdBy: true,
  updatedBy: true,
});

// User session schema
export const userSessionSchema = z
  .object({
    id: uuidSchema,
    userId: uuidSchema,
    deviceId: z.string(),
    deviceName: z.string().optional(),
    ipAddress: z.string().ip(),
    userAgent: z.string(),
    isActive: z.boolean().default(true),
    lastActivityAt: z.date(),
    expiresAt: z.date(),
  })
  .merge(auditSchema);

// User activity schema
export const userActivitySchema = z
  .object({
    id: uuidSchema,
    userId: uuidSchema,
    action: z.string(),
    resource: z.string().optional(),
    resourceId: uuidSchema.optional(),
    ipAddress: z.string().ip(),
    userAgent: z.string(),
    metadata: z.record(z.any()).optional(),
  })
  .merge(auditSchema);

// User statistics schema
export const userStatsSchema = z.object({
  totalTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  overdueTasks: z.number().int().min(0),
  totalProjects: z.number().int().min(0),
  activeProjects: z.number().int().min(0),
  totalWorkspaces: z.number().int().min(0),
  hoursLogged: z.number().min(0),
  tasksCompletedThisWeek: z.number().int().min(0),
  tasksCompletedThisMonth: z.number().int().min(0),
  averageTaskCompletionTime: z.number().min(0).optional(),
});

// Route parameter schemas
export const userParamsSchema = idParamSchema;

// Export types
export type User = z.infer<typeof userSchema>;
export type RegisterUserRequest = z.infer<typeof registerUserSchema>;
export type LoginUserRequest = z.infer<typeof loginUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
export type UpdateUserPreferencesRequest = z.infer<
  typeof updateUserPreferencesSchema
>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type RequestPasswordResetRequest = z.infer<
  typeof requestPasswordResetSchema
>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>;
export type Enable2FARequest = z.infer<typeof enable2FASchema>;
export type Verify2FARequest = z.infer<typeof verify2FASchema>;
export type Disable2FARequest = z.infer<typeof disable2FASchema>;
export type UserQueryParams = z.infer<typeof userQuerySchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserSession = z.infer<typeof userSessionSchema>;
export type UserActivity = z.infer<typeof userActivitySchema>;
export type UserStats = z.infer<typeof userStatsSchema>;
