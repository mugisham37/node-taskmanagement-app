import { z } from 'zod';

// JWT configuration schema
const jwtConfigSchema = z.object({
  secret: z.string().min(32, 'JWT secret must be at least 32 characters'),
  expiresIn: z.string().default('1h'),
  refreshExpiresIn: z.string().default('7d'),
  issuer: z.string().default('taskmanagement'),
  audience: z.string().default('taskmanagement-users'),
  algorithm: z.enum(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512']).default('HS256'),
});

// OAuth configuration schema
const oauthConfigSchema = z.object({
  google: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().url().optional(),
    enabled: z.boolean().default(false),
  }).default({}),
  github: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().url().optional(),
    enabled: z.boolean().default(false),
  }).default({}),
  microsoft: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().url().optional(),
    tenantId: z.string().optional(),
    enabled: z.boolean().default(false),
  }).default({}),
});

// Session configuration schema
const sessionConfigSchema = z.object({
  secret: z.string().min(32, 'Session secret must be at least 32 characters'),
  name: z.string().default('taskmanagement.sid'),
  maxAge: z.number().int().min(60000).default(24 * 60 * 60 * 1000), // 24 hours
  secure: z.boolean().default(false),
  httpOnly: z.boolean().default(true),
  sameSite: z.enum(['strict', 'lax', 'none']).default('lax'),
  rolling: z.boolean().default(false),
});

// Password policy schema
const passwordPolicySchema = z.object({
  minLength: z.number().int().min(6).default(8),
  maxLength: z.number().int().max(128).default(128),
  requireUppercase: z.boolean().default(true),
  requireLowercase: z.boolean().default(true),
  requireNumbers: z.boolean().default(true),
  requireSpecialChars: z.boolean().default(true),
  preventCommonPasswords: z.boolean().default(true),
  preventUserInfo: z.boolean().default(true),
  maxAttempts: z.number().int().min(3).default(5),
  lockoutDuration: z.number().int().min(60000).default(15 * 60 * 1000), // 15 minutes
});

// Two-factor authentication schema
const twoFactorConfigSchema = z.object({
  enabled: z.boolean().default(false),
  issuer: z.string().default('Task Management'),
  window: z.number().int().min(1).default(1),
  backupCodes: z.object({
    count: z.number().int().min(5).default(10),
    length: z.number().int().min(6).default(8),
  }).default({}),
});

// Rate limiting schema
const rateLimitConfigSchema = z.object({
  login: z.object({
    windowMs: z.number().int().min(60000).default(15 * 60 * 1000), // 15 minutes
    maxAttempts: z.number().int().min(3).default(5),
  }).default({}),
  register: z.object({
    windowMs: z.number().int().min(60000).default(60 * 60 * 1000), // 1 hour
    maxAttempts: z.number().int().min(3).default(3),
  }).default({}),
  passwordReset: z.object({
    windowMs: z.number().int().min(60000).default(60 * 60 * 1000), // 1 hour
    maxAttempts: z.number().int().min(3).default(3),
  }).default({}),
});

// Main auth configuration schema
const authConfigSchema = z.object({
  jwt: jwtConfigSchema,
  oauth: oauthConfigSchema.default({}),
  session: sessionConfigSchema,
  passwordPolicy: passwordPolicySchema.default({}),
  twoFactor: twoFactorConfigSchema.default({}),
  rateLimit: rateLimitConfigSchema.default({}),
  emailVerification: z.object({
    required: z.boolean().default(true),
    expiresIn: z.string().default('24h'),
  }).default({}),
  passwordReset: z.object({
    expiresIn: z.string().default('1h'),
    maxAttempts: z.number().int().min(3).default(3),
  }).default({}),
});

export type AuthConfig = z.infer<typeof authConfigSchema>;
export type JWTConfig = z.infer<typeof jwtConfigSchema>;
export type OAuthConfig = z.infer<typeof oauthConfigSchema>;
export type SessionConfig = z.infer<typeof sessionConfigSchema>;
export type PasswordPolicyConfig = z.infer<typeof passwordPolicySchema>;

// Create auth configuration from environment variables
export const createAuthConfig = (): AuthConfig => {
  const config = {
    jwt: {
      secret: process.env.JWT_SECRET || '',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'taskmanagement',
      audience: process.env.JWT_AUDIENCE || 'taskmanagement-users',
      algorithm: (process.env.JWT_ALGORITHM as any) || 'HS256',
    },
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI,
        enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        redirectUri: process.env.GITHUB_REDIRECT_URI,
        enabled: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      },
      microsoft: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        redirectUri: process.env.MICROSOFT_REDIRECT_URI,
        tenantId: process.env.MICROSOFT_TENANT_ID,
        enabled: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
      },
    },
    session: {
      secret: process.env.SESSION_SECRET || '',
      name: process.env.SESSION_NAME || 'taskmanagement.sid',
      maxAge: parseInt(process.env.SESSION_MAX_AGE || String(24 * 60 * 60 * 1000)),
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: (process.env.SESSION_SAME_SITE as any) || 'lax',
      rolling: process.env.SESSION_ROLLING === 'true',
    },
    passwordPolicy: {
      minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
      maxLength: parseInt(process.env.PASSWORD_MAX_LENGTH || '128'),
      requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
      requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
      requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
      requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
      preventCommonPasswords: process.env.PASSWORD_PREVENT_COMMON !== 'false',
      preventUserInfo: process.env.PASSWORD_PREVENT_USER_INFO !== 'false',
      maxAttempts: parseInt(process.env.PASSWORD_MAX_ATTEMPTS || '5'),
      lockoutDuration: parseInt(process.env.PASSWORD_LOCKOUT_DURATION || String(15 * 60 * 1000)),
    },
    twoFactor: {
      enabled: process.env.TWO_FACTOR_ENABLED === 'true',
      issuer: process.env.TWO_FACTOR_ISSUER || 'Task Management',
      window: parseInt(process.env.TWO_FACTOR_WINDOW || '1'),
      backupCodes: {
        count: parseInt(process.env.TWO_FACTOR_BACKUP_COUNT || '10'),
        length: parseInt(process.env.TWO_FACTOR_BACKUP_LENGTH || '8'),
      },
    },
    rateLimit: {
      login: {
        windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW || String(15 * 60 * 1000)),
        maxAttempts: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5'),
      },
      register: {
        windowMs: parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW || String(60 * 60 * 1000)),
        maxAttempts: parseInt(process.env.RATE_LIMIT_REGISTER_MAX || '3'),
      },
      passwordReset: {
        windowMs: parseInt(process.env.RATE_LIMIT_PASSWORD_RESET_WINDOW || String(60 * 60 * 1000)),
        maxAttempts: parseInt(process.env.RATE_LIMIT_PASSWORD_RESET_MAX || '3'),
      },
    },
    emailVerification: {
      required: process.env.EMAIL_VERIFICATION_REQUIRED !== 'false',
      expiresIn: process.env.EMAIL_VERIFICATION_EXPIRES_IN || '24h',
    },
    passwordReset: {
      expiresIn: process.env.PASSWORD_RESET_EXPIRES_IN || '1h',
      maxAttempts: parseInt(process.env.PASSWORD_RESET_MAX_ATTEMPTS || '3'),
    },
  };

  return authConfigSchema.parse(config);
};

// Export the configuration
export const authConfig = createAuthConfig();

// Validate auth configuration
export const validateAuthConfig = (config: unknown): AuthConfig => {
  return authConfigSchema.parse(config);
};