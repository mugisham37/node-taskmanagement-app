import { z } from 'zod';
import { environmentLoader } from '../environment/environment-loader';

/**
 * JWT configuration schema
 */
const JwtConfigSchema = z.object({
  secret: z.string().min(32),
  accessTokenSecret: z.string().min(32),
  refreshTokenSecret: z.string().min(32),
  expiresIn: z.string().default('24h'),
  accessTokenExpiresIn: z.string().default('15m'),
  refreshTokenExpiresIn: z.string().default('7d'),
  issuer: z.string().default('task-management-system'),
  audience: z.string().default('task-management-users'),
  algorithm: z.enum(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512']).default('HS256'),
  clockTolerance: z.number().default(60), // seconds
});

/**
 * Rate limiting configuration schema
 */
const RateLimitConfigSchema = z.object({
  windowMs: z.number().min(1000).default(15 * 60 * 1000), // 15 minutes
  maxRequests: z.number().min(1).default(100),
  skipSuccessfulRequests: z.boolean().default(false),
  skipFailedRequests: z.boolean().default(false),
  keyGenerator: z.enum(['ip', 'user', 'combined']).default('ip'),
  standardHeaders: z.boolean().default(true),
  legacyHeaders: z.boolean().default(false),
  message: z.string().default('Too many requests from this IP, please try again later'),
});

/**
 * CORS configuration schema
 */
const CorsConfigSchema = z.object({
  origins: z.array(z.string()).default(['http://localhost:3000']),
  methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']),
  allowedHeaders: z.array(z.string()).default(['Content-Type', 'Authorization', 'X-Requested-With']),
  exposedHeaders: z.array(z.string()).default(['X-Total-Count', 'X-Page-Count']),
  credentials: z.boolean().default(true),
  maxAge: z.number().default(86400), // 24 hours
  preflightContinue: z.boolean().default(false),
  optionsSuccessStatus: z.number().default(204),
});

/**
 * Security headers configuration schema
 */
const SecurityHeadersSchema = z.object({
  contentSecurityPolicy: z.object({
    enabled: z.boolean().default(true),
    directives: z.record(z.string(), z.array(z.string())).default({
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }),
    reportOnly: z.boolean().default(false),
  }),
  hsts: z.object({
    enabled: z.boolean().default(true),
    maxAge: z.number().default(31536000), // 1 year
    includeSubDomains: z.boolean().default(true),
    preload: z.boolean().default(false),
  }),
  xFrameOptions: z.enum(['DENY', 'SAMEORIGIN']).default('DENY'),
  xContentTypeOptions: z.boolean().default(true),
  xXssProtection: z.boolean().default(true),
  referrerPolicy: z.enum([
    'no-referrer',
    'no-referrer-when-downgrade',
    'origin',
    'origin-when-cross-origin',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
    'unsafe-url'
  ]).default('strict-origin-when-cross-origin'),
});

/**
 * Password policy configuration schema
 */
const PasswordPolicySchema = z.object({
  minLength: z.number().min(8).default(12),
  maxLength: z.number().max(128).default(64),
  requireUppercase: z.boolean().default(true),
  requireLowercase: z.boolean().default(true),
  requireNumbers: z.boolean().default(true),
  requireSpecialChars: z.boolean().default(true),
  specialChars: z.string().default('!@#$%^&*()_+-=[]{}|;:,.<>?'),
  preventCommonPasswords: z.boolean().default(true),
  preventUserInfo: z.boolean().default(true),
  maxConsecutiveChars: z.number().default(3),
  historyCount: z.number().default(5), // Remember last 5 passwords
});

/**
 * Two-factor authentication configuration schema
 */
const TwoFactorConfigSchema = z.object({
  enabled: z.boolean().default(true),
  issuer: z.string().default('Task Management System'),
  window: z.number().default(1), // Time window for TOTP
  step: z.number().default(30), // Time step in seconds
  digits: z.number().default(6), // Number of digits in TOTP
  algorithm: z.enum(['sha1', 'sha256', 'sha512']).default('sha1'),
  backupCodes: z.object({
    enabled: z.boolean().default(true),
    count: z.number().default(10),
    length: z.number().default(8),
  }),
});

/**
 * Session configuration schema
 */
const SessionConfigSchema = z.object({
  secret: z.string().min(32),
  name: z.string().default('taskmanagement.sid'),
  maxAge: z.number().default(24 * 60 * 60 * 1000), // 24 hours
  secure: z.boolean().default(false), // Set to true in production with HTTPS
  httpOnly: z.boolean().default(true),
  sameSite: z.enum(['strict', 'lax', 'none']).default('lax'),
  rolling: z.boolean().default(true), // Extend session on activity
  resave: z.boolean().default(false),
  saveUninitialized: z.boolean().default(false),
});

/**
 * Complete security configuration schema
 */
const SecurityConfigSchema = z.object({
  jwt: JwtConfigSchema,
  rateLimit: RateLimitConfigSchema,
  cors: CorsConfigSchema,
  headers: SecurityHeadersSchema,
  passwordPolicy: PasswordPolicySchema,
  twoFactor: TwoFactorConfigSchema,
  session: SessionConfigSchema,
});

export type JwtConfig = z.infer<typeof JwtConfigSchema>;
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;
export type CorsConfig = z.infer<typeof CorsConfigSchema>;
export type SecurityHeaders = z.infer<typeof SecurityHeadersSchema>;
export type PasswordPolicy = z.infer<typeof PasswordPolicySchema>;
export type TwoFactorConfig = z.infer<typeof TwoFactorConfigSchema>;
export type SessionConfig = z.infer<typeof SessionConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

/**
 * Security configuration loader
 */
export class SecurityConfigLoader {
  /**
   * Load complete security configuration
   */
  static load(): SecurityConfig {
    const env = environmentLoader.getEnv();
    const environment = environmentLoader.getEnvironment();

    const config = {
      jwt: this.getJwtConfig(env),
      rateLimit: this.getRateLimitConfig(environment),
      cors: this.getCorsConfig(env, environment),
      headers: this.getSecurityHeaders(environment),
      passwordPolicy: this.getPasswordPolicy(environment),
      twoFactor: this.getTwoFactorConfig(environment),
      session: this.getSessionConfig(env, environment),
    };

    return SecurityConfigSchema.parse(config);
  }

  /**
   * Get JWT configuration
   */
  private static getJwtConfig(env: any): JwtConfig {
    const secret = env.JWT_SECRET;
    
    return {
      secret,
      accessTokenSecret: env.JWT_ACCESS_SECRET || secret,
      refreshTokenSecret: env.JWT_REFRESH_SECRET || `${secret}_refresh`,
      expiresIn: env.JWT_EXPIRES_IN || '24h',
      accessTokenExpiresIn: env.JWT_ACCESS_EXPIRES_IN || '15m',
      refreshTokenExpiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: env.JWT_ISSUER || 'task-management-system',
      audience: env.JWT_AUDIENCE || 'task-management-users',
      algorithm: 'HS256',
      clockTolerance: 60,
    };
  }

  /**
   * Get rate limiting configuration
   */
  private static getRateLimitConfig(environment: string): RateLimitConfig {
    const baseConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: 'ip' as const,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests from this IP, please try again later',
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          maxRequests: 50,
          windowMs: 15 * 60 * 1000,
        };
      
      case 'staging':
        return {
          ...baseConfig,
          maxRequests: 200,
        };
      
      case 'test':
        return {
          ...baseConfig,
          maxRequests: 1000,
          windowMs: 60 * 1000, // 1 minute
        };
      
      case 'development':
      default:
        return {
          ...baseConfig,
          maxRequests: 1000,
        };
    }
  }

  /**
   * Get CORS configuration
   */
  private static getCorsConfig(env: any, environment: string): CorsConfig {
    const baseConfig = {
      origins: env.CORS_ORIGINS || ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      credentials: true,
      maxAge: 86400,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          origins: env.CORS_ORIGINS || ['https://app.taskmanagement.com'],
        };
      
      case 'staging':
        return {
          ...baseConfig,
          origins: env.CORS_ORIGINS || ['https://staging.taskmanagement.com'],
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get security headers configuration
   */
  private static getSecurityHeaders(environment: string): SecurityHeaders {
    const baseConfig = {
      contentSecurityPolicy: {
        enabled: true,
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
        reportOnly: false,
      },
      hsts: {
        enabled: true,
        maxAge: 31536000,
        includeSubDomains: true,
        preload: false,
      },
      xFrameOptions: 'DENY' as const,
      xContentTypeOptions: true,
      xXssProtection: true,
      referrerPolicy: 'strict-origin-when-cross-origin' as const,
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          hsts: {
            ...baseConfig.hsts,
            preload: true,
          },
        };
      
      case 'development':
        return {
          ...baseConfig,
          contentSecurityPolicy: {
            ...baseConfig.contentSecurityPolicy,
            reportOnly: true, // Less strict in development
          },
          hsts: {
            ...baseConfig.hsts,
            enabled: false, // Disable HSTS in development
          },
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get password policy configuration
   */
  private static getPasswordPolicy(environment: string): PasswordPolicy {
    const baseConfig = {
      minLength: 12,
      maxLength: 64,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      preventCommonPasswords: true,
      preventUserInfo: true,
      maxConsecutiveChars: 3,
      historyCount: 5,
    };

    switch (environment) {
      case 'production':
        return baseConfig;
      
      case 'development':
        return {
          ...baseConfig,
          minLength: 8, // Relaxed for development
          requireSpecialChars: false,
        };
      
      case 'test':
        return {
          ...baseConfig,
          minLength: 6,
          requireUppercase: false,
          requireNumbers: false,
          requireSpecialChars: false,
          preventCommonPasswords: false,
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get two-factor authentication configuration
   */
  private static getTwoFactorConfig(environment: string): TwoFactorConfig {
    return {
      enabled: environment !== 'test',
      issuer: 'Task Management System',
      window: 1,
      step: 30,
      digits: 6,
      algorithm: 'sha1',
      backupCodes: {
        enabled: true,
        count: 10,
        length: 8,
      },
    };
  }

  /**
   * Get session configuration
   */
  private static getSessionConfig(env: any, environment: string): SessionConfig {
    const baseConfig = {
      secret: env.JWT_SECRET || 'session-secret-change-in-production',
      name: 'taskmanagement.sid',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: false,
      httpOnly: true,
      sameSite: 'lax' as const,
      rolling: true,
      resave: false,
      saveUninitialized: false,
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          secure: true, // Require HTTPS in production
          sameSite: 'strict',
        };
      
      case 'staging':
        return {
          ...baseConfig,
          secure: true,
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Validate security configuration
   */
  static validate(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const config = this.load();
      const environment = environmentLoader.getEnvironment();

      // Validate JWT secrets
      if (config.jwt.secret.length < 32) {
        errors.push('JWT secret must be at least 32 characters long');
      }

      if (config.jwt.secret === 'your-secret-key-change-in-production') {
        if (environment === 'production') {
          errors.push('Default JWT secret detected in production');
        } else {
          warnings.push('Using default JWT secret (change for production)');
        }
      }

      // Validate session configuration
      if (environment === 'production') {
        if (!config.session.secure) {
          warnings.push('Session cookies should be secure in production');
        }
        
        if (!config.headers.hsts.enabled) {
          warnings.push('HSTS should be enabled in production');
        }
      }

      // Validate CORS origins
      if (config.cors.origins.includes('*')) {
        if (environment === 'production') {
          errors.push('Wildcard CORS origin not allowed in production');
        } else {
          warnings.push('Wildcard CORS origin detected');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Security configuration validation failed: ${error}`],
        warnings: [],
      };
    }
  }
}