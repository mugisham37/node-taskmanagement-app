import { z } from 'zod';
import {
  BaseDto,
  BaseQuerySchema,
  IdSchema,
  EmailSchema,
  PasswordSchema,
  NameSchema,
} from './base-dto';

// User DTOs
export interface UserResponseDto extends BaseDto {
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: Date | null;
}

export interface CreateUserRequestDto {
  email: string;
  name: string;
  password: string;
}

export interface UpdateUserRequestDto {
  name?: string;
  email?: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequestDto {
  refreshToken: string;
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

// Validation schemas
export const CreateUserSchema = z.object({
  email: EmailSchema,
  name: NameSchema,
  password: PasswordSchema,
});

export const UpdateUserSchema = z
  .object({
    name: NameSchema.optional(),
    email: EmailSchema.optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: PasswordSchema,
});

export const UserQuerySchema = BaseQuerySchema.extend({
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

// Type exports
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
export type LoginRequest = z.infer<typeof LoginSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;
export type UserQuery = z.infer<typeof UserQuerySchema>;
