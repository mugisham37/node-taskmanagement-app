import { z } from 'zod';
import { USER_VALIDATION } from '../constants';

/**
 * User validation schemas using Zod
 */

export const UserNameSchema = z
  .string()
  .min(USER_VALIDATION.NAME_MIN_LENGTH, `Name must be at least ${USER_VALIDATION.NAME_MIN_LENGTH} character(s)`)
  .max(USER_VALIDATION.NAME_MAX_LENGTH, `Name must not exceed ${USER_VALIDATION.NAME_MAX_LENGTH} characters`)
  .trim();

export const UserEmailSchema = z
  .string()
  .email('Invalid email format')
  .max(USER_VALIDATION.EMAIL_MAX_LENGTH, `Email must not exceed ${USER_VALIDATION.EMAIL_MAX_LENGTH} characters`)
  .toLowerCase()
  .trim();

export const UserPasswordSchema = z
  .string()
  .min(USER_VALIDATION.PASSWORD_MIN_LENGTH, `Password must be at least ${USER_VALIDATION.PASSWORD_MIN_LENGTH} characters`)
  .max(USER_VALIDATION.PASSWORD_MAX_LENGTH, `Password must not exceed ${USER_VALIDATION.PASSWORD_MAX_LENGTH} characters`)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

export const UserStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'PENDING_VERIFICATION', 'DELETED']);

export const UserRoleSchema = z.enum(['ADMIN', 'USER']);

export const UserIdSchema = z.string().uuid('Invalid user ID format');

export const CreateUserSchema = z.object({
  firstName: UserNameSchema,
  lastName: UserNameSchema,
  email: UserEmailSchema,
  password: UserPasswordSchema,
  role: UserRoleSchema.default('USER'),
});

export const UpdateUserSchema = z.object({
  firstName: UserNameSchema.optional(),
  lastName: UserNameSchema.optional(),
  email: UserEmailSchema.optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
  timezone: z.string().optional(),
  language: z.string().length(2, 'Language must be a 2-character code').optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: UserPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const LoginSchema = z.object({
  email: UserEmailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export const RegisterSchema = z.object({
  firstName: UserNameSchema,
  lastName: UserNameSchema,
  email: UserEmailSchema,
  password: UserPasswordSchema,
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const ForgotPasswordSchema = z.object({
  email: UserEmailSchema,
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: UserPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const UserQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['firstName', 'lastName', 'email', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: UserStatusSchema.optional(),
  role: UserRoleSchema.optional(),
  search: z.string().min(1).max(255).optional(),
});

export const UserParamsSchema = z.object({
  id: UserIdSchema,
});

export const Enable2FASchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const Verify2FASchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d+$/, 'Token must contain only digits'),
});

export const UpdateUserRoleSchema = z.object({
  role: UserRoleSchema,
});

export const UpdateUserStatusSchema = z.object({
  status: UserStatusSchema,
  reason: z.string().min(1).max(500).optional(),
});

// Type exports
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UserQuery = z.infer<typeof UserQuerySchema>;
export type UserParams = z.infer<typeof UserParamsSchema>;
export type Enable2FAInput = z.infer<typeof Enable2FASchema>;
export type Verify2FAInput = z.infer<typeof Verify2FASchema>;
export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>;
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>;