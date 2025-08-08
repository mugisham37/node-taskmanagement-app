import { z } from 'zod';

/**
 * Unified Authentication Validators
 * Comprehensive validation schemas for all authentication endpoints
 */

// Common validation patterns
const emailSchema = z.string().email('Invalid email format');
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  );
const uuidSchema = z.string().uuid('Invalid UUID format');
const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');

// Registration validation
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  timezone: z.string().optional().default('UTC'),
  workspaceInviteToken: z.string().optional(),
  acceptTerms: z
    .boolean()
    .refine(val => val === true, 'Must accept terms and conditions'),
  marketingConsent: z.boolean().optional().default(false),
});

// Login validation
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  workspaceId: uuidSchema.optional(),
  deviceFingerprint: z.string().optional(),
  rememberMe: z.boolean().optional().default(false),
});

// Password reset request validation
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Password reset validation
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

// Email verification validation
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// MFA setup validation
export const mfaSetupSchema = z.object({
  method: z.enum(['totp', 'sms', 'webauthn'], {
    errorMap: () => ({ message: 'Invalid MFA method' }),
  }),
  phoneNumber: phoneSchema.optional(),
  credentialName: z.string().min(1).max(50).optional(),
});

// MFA setup confirmation validation
export const mfaSetupConfirmSchema = z.object({
  method: z.enum(['totp', 'sms', 'webauthn']),
  token: z.string().min(1, 'Token is required'),
  secret: z.string().optional(),
  backupCodes: z.array(z.string()).optional(),
  phoneNumber: phoneSchema.optional(),
  registrationResponse: z
    .object({
      id: z.string(),
      rawId: z.string(),
      response: z.object({
        attestationObject: z.string(),
        clientDataJSON: z.string(),
      }),
      type: z.literal('public-key'),
    })
    .optional(),
  credentialName: z.string().min(1).max(50).optional(),
});

// MFA verification validation
export const mfaVerifySchema = z.object({
  token: z.string().min(1, 'Token is required'),
  method: z
    .enum(['totp', 'sms', 'webauthn', 'backup_code'])
    .optional()
    .default('totp'),
  rememberDevice: z.boolean().optional().default(false),
  authenticationResponse: z
    .object({
      id: z.string(),
      rawId: z.string(),
      response: z.object({
        authenticatorData: z.string(),
        clientDataJSON: z.string(),
        signature: z.string(),
        userHandle: z.string().optional(),
      }),
      type: z.literal('public-key'),
    })
    .optional(),
});

// Workspace switch validation
export const workspaceSwitchSchema = z.object({
  workspaceId: uuidSchema,
});

// Session management validation
export const sessionManagementSchema = z.object({
  sessionId: uuidSchema,
});

// User profile update validation
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
  avatarColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')
    .optional(),
  workHours: z
    .object({
      start: z
        .string()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
      end: z
        .string()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
      days: z
        .array(z.number().min(0).max(6))
        .min(1, 'At least one work day required'),
    })
    .optional(),
  taskViewPreferences: z
    .object({
      defaultView: z.enum(['list', 'board', 'calendar']),
      groupBy: z.enum(['status', 'priority', 'assignee', 'project']),
    })
    .optional(),
  notificationSettings: z
    .object({
      email: z.boolean(),
      push: z.boolean(),
      desktop: z.boolean(),
    })
    .optional(),
  productivitySettings: z
    .object({
      pomodoroLength: z.number().min(5).max(60),
      breakLength: z.number().min(1).max(30),
    })
    .optional(),
});

// Change password validation
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// OAuth connection validation
export const oauthConnectSchema = z.object({
  provider: z.enum([
    'google',
    'github',
    'microsoft',
    'apple',
    'slack',
    'discord',
    'linkedin',
  ]),
  redirectUri: z.string().url('Invalid redirect URI').optional(),
});

// Device management validation
export const deviceManagementSchema = z.object({
  deviceId: uuidSchema,
  action: z.enum(['trust', 'untrust', 'rename', 'delete']),
  name: z.string().min(1).max(100).optional(),
});

// Admin user management validation
export const adminUserManagementSchema = z.object({
  userId: uuidSchema,
  action: z.enum([
    'lock',
    'unlock',
    'delete',
    'reset_password',
    'force_logout',
  ]),
  reason: z.string().min(1).max(500).optional(),
  duration: z.number().positive().optional(), // Duration in minutes
});

// Security event query validation
export const securityEventQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: uuidSchema.optional(),
  eventType: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  limit: z.number().min(1).max(1000).optional().default(100),
  offset: z.number().min(0).optional().default(0),
});

// Audit log query validation
export const auditLogQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: uuidSchema.optional(),
  workspaceId: uuidSchema.optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  ipAddress: z.string().ip().optional(),
  statusCode: z.number().optional(),
  limit: z.number().min(1).max(1000).optional().default(100),
  offset: z.number().min(0).optional().default(0),
});

// Risk assessment validation
export const riskAssessmentSchema = z.object({
  userId: uuidSchema.optional(),
  includeRecommendations: z.boolean().optional().default(true),
  includeFactors: z.boolean().optional().default(true),
});

// Workspace invitation validation
export const workspaceInvitationSchema = z.object({
  email: emailSchema,
  role: z.string().min(1, 'Role is required'),
  message: z.string().max(500).optional(),
  expiresIn: z
    .number()
    .positive()
    .optional()
    .default(7 * 24 * 60 * 60 * 1000), // 7 days
});

// Bulk user operations validation
export const bulkUserOperationSchema = z.object({
  userIds: z
    .array(uuidSchema)
    .min(1, 'At least one user ID required')
    .max(100, 'Too many users'),
  operation: z.enum(['lock', 'unlock', 'delete', 'force_logout', 'reset_mfa']),
  reason: z.string().min(1).max(500).optional(),
});

// API key management validation
export const apiKeyManagementSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1, 'At least one permission required'),
  expiresIn: z.number().positive().optional(), // Duration in milliseconds
  ipWhitelist: z.array(z.string().ip()).optional(),
});

// Rate limit configuration validation
export const rateLimitConfigSchema = z.object({
  endpoint: z.string().min(1, 'Endpoint pattern required'),
  windowMs: z.number().positive(),
  maxRequests: z.number().positive(),
  riskMultipliers: z
    .object({
      low: z.number().positive(),
      medium: z.number().positive(),
      high: z.number().positive(),
      critical: z.number().positive(),
    })
    .optional(),
});

// Security policy validation
export const securityPolicySchema = z.object({
  passwordPolicy: z
    .object({
      minLength: z.number().min(8).max(128),
      requireUppercase: z.boolean(),
      requireLowercase: z.boolean(),
      requireNumbers: z.boolean(),
      requireSpecialChars: z.boolean(),
      maxAge: z.number().positive().optional(), // Days
      preventReuse: z.number().min(0).max(24).optional(), // Number of previous passwords
    })
    .optional(),
  sessionPolicy: z
    .object({
      maxDuration: z.number().positive(), // Milliseconds
      idleTimeout: z.number().positive(), // Milliseconds
      maxConcurrentSessions: z.number().positive(),
      requireMfaForSensitiveOperations: z.boolean(),
    })
    .optional(),
  mfaPolicy: z
    .object({
      required: z.boolean(),
      allowedMethods: z.array(z.enum(['totp', 'sms', 'webauthn'])),
      backupCodesRequired: z.boolean(),
      gracePeriod: z.number().min(0).optional(), // Days
    })
    .optional(),
  riskPolicy: z
    .object({
      maxRiskScore: z.number().min(0).max(1),
      autoLockThreshold: z.number().min(0).max(1),
      requireMfaThreshold: z.number().min(0).max(1),
      monitoringEnabled: z.boolean(),
    })
    .optional(),
});

// Export all validators
export const unifiedAuthValidators = {
  register: registerSchema,
  login: loginSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
  verifyEmail: verifyEmailSchema,
  mfaSetup: mfaSetupSchema,
  mfaSetupConfirm: mfaSetupConfirmSchema,
  mfaVerify: mfaVerifySchema,
  workspaceSwitch: workspaceSwitchSchema,
  sessionManagement: sessionManagementSchema,
  updateProfile: updateProfileSchema,
  changePassword: changePasswordSchema,
  oauthConnect: oauthConnectSchema,
  deviceManagement: deviceManagementSchema,
  adminUserManagement: adminUserManagementSchema,
  securityEventQuery: securityEventQuerySchema,
  auditLogQuery: auditLogQuerySchema,
  riskAssessment: riskAssessmentSchema,
  workspaceInvitation: workspaceInvitationSchema,
  bulkUserOperation: bulkUserOperationSchema,
  apiKeyManagement: apiKeyManagementSchema,
  rateLimitConfig: rateLimitConfigSchema,
  securityPolicy: securityPolicySchema,
};

// Type exports for TypeScript
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>;
export type MfaSetupRequest = z.infer<typeof mfaSetupSchema>;
export type MfaSetupConfirmRequest = z.infer<typeof mfaSetupConfirmSchema>;
export type MfaVerifyRequest = z.infer<typeof mfaVerifySchema>;
export type WorkspaceSwitchRequest = z.infer<typeof workspaceSwitchSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type OAuthConnectRequest = z.infer<typeof oauthConnectSchema>;
export type DeviceManagementRequest = z.infer<typeof deviceManagementSchema>;
export type AdminUserManagementRequest = z.infer<
  typeof adminUserManagementSchema
>;
export type SecurityEventQueryRequest = z.infer<
  typeof securityEventQuerySchema
>;
export type AuditLogQueryRequest = z.infer<typeof auditLogQuerySchema>;
export type RiskAssessmentRequest = z.infer<typeof riskAssessmentSchema>;
export type WorkspaceInvitationRequest = z.infer<
  typeof workspaceInvitationSchema
>;
export type BulkUserOperationRequest = z.infer<typeof bulkUserOperationSchema>;
export type ApiKeyManagementRequest = z.infer<typeof apiKeyManagementSchema>;
export type RateLimitConfigRequest = z.infer<typeof rateLimitConfigSchema>;
export type SecurityPolicyRequest = z.infer<typeof securityPolicySchema>;

/**
 * Validation middleware factory for Fastify
 */
export function createValidationMiddleware<T extends z.ZodSchema>(schema: T) {
  return async (request: any, reply: any) => {
    try {
      const validatedData = schema.parse(request.body);
      request.body = validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return;
      }

      reply.code(400).send({
        success: false,
        error: 'Invalid request data',
      });
    }
  };
}

/**
 * Query parameter validation middleware factory
 */
export function createQueryValidationMiddleware<T extends z.ZodSchema>(
  schema: T
) {
  return async (request: any, reply: any) => {
    try {
      const validatedData = schema.parse(request.query);
      request.query = validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          success: false,
          error: 'Query validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return;
      }

      reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
      });
    }
  };
}

/**
 * Parameter validation middleware factory
 */
export function createParamValidationMiddleware<T extends z.ZodSchema>(
  schema: T
) {
  return async (request: any, reply: any) => {
    try {
      const validatedData = schema.parse(request.params);
      request.params = validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          success: false,
          error: 'Parameter validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return;
      }

      reply.code(400).send({
        success: false,
        error: 'Invalid parameters',
      });
    }
  };
}
