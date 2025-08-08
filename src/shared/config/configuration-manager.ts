import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Configuration Schema Definitions
const DatabaseConfigSchema = z.object({
  url: z.string().url('Invalid database URL'),
  testUrl: z.string().url('Invalid test database URL').optional(),
  maxConnections: z.number().min(1).max(100).default(20),
  connectionTimeout: z.number().min(1000).default(30000),
  idleTimeout: z.number().min(1000).default(600000),
  ssl: z.boolean().default(false),
  logging: z.boolean().default(false),
});

const RedisConfigSchema = z.object({
  url: z.string().optional(),
  host: z.string().default('localhost'),
  port: z.number().min(1).max(65535).default(6379),
  password: z.string().optional(),
  db: z.number().min(0).max(15).default(0),
  maxRetriesPerRequest: z.number().min(1).default(3),
  retryDelayOnFailover: z.number().min(100).default(100),
  enableOfflineQueue: z.boolean().default(false),
  lazyConnect: z.boolean().default(true),
});

const JWTConfigSchema = z.object({
  secret: z.string().min(32, 'JWT secret must be at least 32 characters'),
  refreshSecret: z
    .string()
    .min(32, 'JWT refresh secret must be at least 32 characters'),
  expiresIn: z.string().default('15m'),
  refreshExpiresIn: z.string().default('7d'),
  issuer: z.string().default('unified-enterprise-platform'),
  audience: z.string().default('unified-enterprise-platform'),
});

const ServerConfigSchema = z.object({
  nodeEnv: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  port: z.number().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
  apiVersion: z.string().default('v1'),
  trustProxy: z.boolean().default(false),
  bodyLimit: z.number().min(1024).default(1048576), // 1MB
  keepAliveTimeout: z.number().min(1000).default(5000),
});

const SecurityConfigSchema = z.object({
  corsOrigin: z.union([z.string(), z.array(z.string())]).default('*'),
  rateLimitMax: z.number().min(1).default(100),
  rateLimitWindow: z.number().min(1000).default(900000), // 15 minutes
  sessionSecret: z
    .string()
    .min(32, 'Session secret must be at least 32 characters'),
  csrfSecret: z.string().min(32, 'CSRF secret must be at least 32 characters'),
  bcryptRounds: z.number().min(10).max(15).default(12),
  enableHelmet: z.boolean().default(true),
  enableCors: z.boolean().default(true),
});

const EmailConfigSchema = z.object({
  provider: z.enum(['smtp', 'sendgrid', 'ses']).default('smtp'),
  smtp: z
    .object({
      host: z.string().optional(),
      port: z.number().min(1).max(65535).optional(),
      secure: z.boolean().default(false),
      user: z.string().optional(),
      pass: z.string().optional(),
    })
    .optional(),
  from: z.string().email('Invalid from email address'),
  replyTo: z.string().email('Invalid reply-to email address').optional(),
});

const StorageConfigSchema = z.object({
  type: z.enum(['local', 's3', 'azure', 'gcs']).default('local'),
  local: z
    .object({
      path: z.string().default('./uploads'),
      maxFileSize: z.number().min(1024).default(10485760), // 10MB
    })
    .optional(),
  s3: z
    .object({
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
      region: z.string().optional(),
      bucket: z.string().optional(),
    })
    .optional(),
  azure: z
    .object({
      connectionString: z.string().optional(),
      containerName: z.string().optional(),
    })
    .optional(),
});

const MonitoringConfigSchema = z.object({
  enabled: z.boolean().default(true),
  prometheus: z.object({
    enabled: z.boolean().default(true),
    port: z.number().min(1).max(65535).default(9090),
    path: z.string().default('/metrics'),
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    format: z.enum(['json', 'simple']).default('json'),
    maxFiles: z.number().min(1).default(5),
    maxSize: z.string().default('20m'),
  }),
  healthCheck: z.object({
    enabled: z.boolean().default(true),
    path: z.string().default('/health'),
    interval: z.number().min(1000).default(30000),
  }),
});

const FeatureFlagsSchema = z.object({
  enableRegistration: z.boolean().default(true),
  enableMFA: z.boolean().default(true),
  enableOAuth: z.boolean().default(true),
  enableWebAuthn: z.boolean().default(true),
  enableEmailVerification: z.boolean().default(true),
  enableAuditLog: z.boolean().default(true),
  enableRealTimeUpdates: z.boolean().default(true),
  enableFileUpload: z.boolean().default(true),
  enableNotifications: z.boolean().default(true),
  enableCalendarIntegration: z.boolean().default(false),
  enableAdvancedSearch: z.boolean().default(false),
  enableBulkOperations: z.boolean().default(true),
});

const ExternalServicesSchema = z.object({
  twilio: z
    .object({
      accountSid: z.string().optional(),
      authToken: z.string().optional(),
      phoneNumber: z.string().optional(),
    })
    .optional(),
  google: z
    .object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      redirectUri: z.string().optional(),
    })
    .optional(),
  github: z
    .object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      redirectUri: z.string().optional(),
    })
    .optional(),
  webhook: z
    .object({
      secret: z.string().optional(),
      timeout: z.number().min(1000).default(30000),
      retries: z.number().min(0).default(3),
    })
    .optional(),
});

// Main Configuration Schema
const ConfigurationSchema = z.object({
  server: ServerConfigSchema,
  database: DatabaseConfigSchema,
  redis: RedisConfigSchema,
  jwt: JWTConfigSchema,
  security: SecurityConfigSchema,
  email: EmailConfigSchema,
  storage: StorageConfigSchema,
  monitoring: MonitoringConfigSchema,
  featureFlags: FeatureFlagsSchema,
  externalServices: ExternalServicesSchema,
});

export type Configuration = z.infer<typeof ConfigurationSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type JWTConfig = z.infer<typeof JWTConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;
export type StorageConfig = z.infer<typeof StorageConfigSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type ExternalServicesConfig = z.infer<typeof ExternalServicesSchema>;

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ConfigurationProvider {
  get<T>(key: string): T;
  getRequired<T>(key: string): T;
  getSection<T>(section: keyof Configuration): T;
  validate(): Promise<ValidationResult>;
  reload(): Promise<void>;
  isFeatureEnabled(flag: keyof FeatureFlags): boolean;
  getFeatureVariant(flag: string, context?: Record<string, any>): string;
}

class EnterpriseConfigurationManager implements ConfigurationProvider {
  private config: Configuration;
  private configPath: string;
  private environmentOverrides: Map<string, any> = new Map();

  constructor(configPath?: string) {
    this.configPath = configPath || this.getConfigPath();
    this.config = this.loadConfiguration();
  }

  private getConfigPath(): string {
    const env = process.env.NODE_ENV || 'development';
    const configDir = path.join(process.cwd(), 'config');

    // Try environment-specific config first
    const envConfigPath = path.join(configDir, `${env}.json`);
    if (fs.existsSync(envConfigPath)) {
      return envConfigPath;
    }

    // Fall back to default config
    const defaultConfigPath = path.join(configDir, 'default.json');
    if (fs.existsSync(defaultConfigPath)) {
      return defaultConfigPath;
    }

    // Create default config if none exists
    this.createDefaultConfig(defaultConfigPath);
    return defaultConfigPath;
  }

  private createDefaultConfig(configPath: string): void {
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const defaultConfig = {
      server: {
        nodeEnv: 'development',
        port: 3000,
        host: '0.0.0.0',
        apiVersion: 'v1',
      },
      database: {
        url: 'postgresql://postgres:postgres@localhost:5432/unified_enterprise_platform',
      },
      redis: {
        host: 'localhost',
        port: 6379,
      },
      jwt: {
        secret: 'your-super-secret-jwt-key-change-this-in-production',
        refreshSecret:
          'your-super-secret-refresh-key-change-this-in-production',
      },
      security: {
        sessionSecret: 'your-session-secret-change-this-in-production',
        csrfSecret: 'your-csrf-secret-change-this-in-production',
      },
      email: {
        provider: 'smtp',
        from: 'noreply@unified-enterprise-platform.com',
      },
      storage: {
        type: 'local',
      },
      monitoring: {
        enabled: true,
      },
      featureFlags: {
        enableRegistration: true,
        enableMFA: true,
      },
      externalServices: {},
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  }

  private loadConfiguration(): Configuration {
    try {
      // Load base configuration from file
      let baseConfig = {};
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf-8');
        baseConfig = JSON.parse(configContent);
      }

      // Override with environment variables
      const envConfig = this.loadEnvironmentVariables();
      const mergedConfig = this.deepMerge(baseConfig, envConfig);

      // Validate and parse configuration
      const result = ConfigurationSchema.safeParse(mergedConfig);
      if (!result.success) {
        const errors = result.error.errors.map(
          err => `${err.path.join('.')}: ${err.message}`
        );
        throw new Error(
          `Configuration validation failed:\n${errors.join('\n')}`
        );
      }

      return result.data;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw error;
    }
  }

  private loadEnvironmentVariables(): any {
    return {
      server: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
        host: process.env.HOST,
        apiVersion: process.env.API_VERSION,
        trustProxy: process.env.TRUST_PROXY === 'true',
      },
      database: {
        url: process.env.DATABASE_URL,
        testUrl: process.env.DATABASE_URL_TEST,
        maxConnections: process.env.DB_MAX_CONNECTIONS
          ? parseInt(process.env.DB_MAX_CONNECTIONS, 10)
          : undefined,
        ssl: process.env.DB_SSL === 'true',
        logging: process.env.DB_LOGGING === 'true',
      },
      redis: {
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
          ? parseInt(process.env.REDIS_PORT, 10)
          : undefined,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB
          ? parseInt(process.env.REDIS_DB, 10)
          : undefined,
      },
      jwt: {
        secret: process.env.JWT_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
      },
      security: {
        corsOrigin:
          process.env.CORS_ORIGIN?.split(',') || process.env.CORS_ORIGIN,
        rateLimitMax: process.env.RATE_LIMIT_MAX
          ? parseInt(process.env.RATE_LIMIT_MAX, 10)
          : undefined,
        rateLimitWindow: process.env.RATE_LIMIT_WINDOW_MS
          ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
          : undefined,
        sessionSecret: process.env.SESSION_SECRET,
        csrfSecret: process.env.CSRF_SECRET,
        bcryptRounds: process.env.BCRYPT_ROUNDS
          ? parseInt(process.env.BCRYPT_ROUNDS, 10)
          : undefined,
        enableHelmet: process.env.ENABLE_HELMET !== 'false',
        enableCors: process.env.ENABLE_CORS !== 'false',
      },
      email: {
        provider: process.env.EMAIL_PROVIDER,
        smtp: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT
            ? parseInt(process.env.SMTP_PORT, 10)
            : undefined,
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        from: process.env.EMAIL_FROM,
        replyTo: process.env.EMAIL_REPLY_TO,
      },
      storage: {
        type: process.env.STORAGE_TYPE,
        local: {
          path: process.env.STORAGE_PATH,
          maxFileSize: process.env.MAX_FILE_SIZE
            ? parseInt(process.env.MAX_FILE_SIZE, 10)
            : undefined,
        },
        s3: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION,
          bucket: process.env.AWS_S3_BUCKET,
        },
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        prometheus: {
          enabled: process.env.PROMETHEUS_ENABLED !== 'false',
          port: process.env.PROMETHEUS_PORT
            ? parseInt(process.env.PROMETHEUS_PORT, 10)
            : undefined,
          path: process.env.PROMETHEUS_PATH,
        },
        logging: {
          level: process.env.LOG_LEVEL,
          format: process.env.LOG_FORMAT,
        },
      },
      featureFlags: {
        enableRegistration: process.env.ENABLE_REGISTRATION !== 'false',
        enableMFA: process.env.ENABLE_MFA !== 'false',
        enableOAuth: process.env.ENABLE_OAUTH !== 'false',
        enableWebAuthn: process.env.ENABLE_WEBAUTHN !== 'false',
        enableEmailVerification:
          process.env.ENABLE_EMAIL_VERIFICATION !== 'false',
        enableAuditLog: process.env.ENABLE_AUDIT_LOG !== 'false',
        enableRealTimeUpdates: process.env.ENABLE_REAL_TIME_UPDATES !== 'false',
        enableFileUpload: process.env.ENABLE_FILE_UPLOAD !== 'false',
        enableNotifications: process.env.ENABLE_NOTIFICATIONS !== 'false',
        enableCalendarIntegration:
          process.env.ENABLE_CALENDAR_INTEGRATION === 'true',
        enableAdvancedSearch: process.env.ENABLE_ADVANCED_SEARCH === 'true',
        enableBulkOperations: process.env.ENABLE_BULK_OPERATIONS !== 'false',
      },
      externalServices: {
        twilio: {
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN,
          phoneNumber: process.env.TWILIO_PHONE_NUMBER,
        },
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          redirectUri: process.env.GOOGLE_REDIRECT_URI,
        },
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          redirectUri: process.env.GITHUB_REDIRECT_URI,
        },
        webhook: {
          secret: process.env.WEBHOOK_SECRET,
          timeout: process.env.WEBHOOK_TIMEOUT
            ? parseInt(process.env.WEBHOOK_TIMEOUT, 10)
            : undefined,
          retries: process.env.WEBHOOK_RETRIES
            ? parseInt(process.env.WEBHOOK_RETRIES, 10)
            : undefined,
        },
      },
    };
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined && source[key] !== null) {
        if (
          typeof source[key] === 'object' &&
          !Array.isArray(source[key]) &&
          source[key] !== null
        ) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  get<T>(key: string): T {
    const keys = key.split('.');
    let value: any = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined as T;
      }
    }

    return value as T;
  }

  getRequired<T>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined || value === null) {
      throw new Error(`Required configuration key '${key}' is missing`);
    }
    return value;
  }

  getSection<T>(section: keyof Configuration): T {
    return this.config[section] as T;
  }

  async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate schema
      const result = ConfigurationSchema.safeParse(this.config);
      if (!result.success) {
        errors.push(
          ...result.error.errors.map(
            err => `${err.path.join('.')}: ${err.message}`
          )
        );
      }

      // Environment-specific validations
      if (this.config.server.nodeEnv === 'production') {
        // Production security checks
        if (this.config.jwt.secret.includes('change-this-in-production')) {
          errors.push('JWT secret must be changed in production');
        }
        if (
          this.config.security.sessionSecret.includes(
            'change-this-in-production'
          )
        ) {
          errors.push('Session secret must be changed in production');
        }
        if (
          this.config.security.csrfSecret.includes('change-this-in-production')
        ) {
          errors.push('CSRF secret must be changed in production');
        }
        if (this.config.database.url.includes('localhost')) {
          warnings.push('Database URL points to localhost in production');
        }
      }

      // Feature flag consistency checks
      if (
        this.config.featureFlags.enableMFA &&
        !this.config.featureFlags.enableEmailVerification
      ) {
        warnings.push('MFA is enabled but email verification is disabled');
      }

      // External service configuration checks
      if (this.config.featureFlags.enableOAuth) {
        if (
          !this.config.externalServices.google?.clientId &&
          !this.config.externalServices.github?.clientId
        ) {
          warnings.push(
            'OAuth is enabled but no OAuth providers are configured'
          );
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
        errors: [`Configuration validation error: ${error.message}`],
        warnings,
      };
    }
  }

  async reload(): Promise<void> {
    try {
      this.config = this.loadConfiguration();
      console.log('Configuration reloaded successfully');
    } catch (error) {
      console.error('Failed to reload configuration:', error);
      throw error;
    }
  }

  isFeatureEnabled(flag: keyof FeatureFlags): boolean {
    return this.config.featureFlags[flag] || false;
  }

  getFeatureVariant(flag: string, context?: Record<string, any>): string {
    // Simple feature variant implementation
    // In a real enterprise system, this would integrate with a feature flag service
    const baseFlag = this.get<boolean>(`featureFlags.${flag}`);
    if (!baseFlag) return 'disabled';

    // Context-based variants (example: A/B testing)
    if (context?.userId) {
      const userId = context.userId as string;
      const hash = userId.split('').reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);

      return Math.abs(hash) % 2 === 0 ? 'variant_a' : 'variant_b';
    }

    return 'enabled';
  }

  // Additional utility methods
  isDevelopment(): boolean {
    return this.config.server.nodeEnv === 'development';
  }

  isProduction(): boolean {
    return this.config.server.nodeEnv === 'production';
  }

  isTest(): boolean {
    return this.config.server.nodeEnv === 'test';
  }

  getEnvironment(): string {
    return this.config.server.nodeEnv;
  }

  getConfig(): Configuration {
    return { ...this.config };
  }
}

// Singleton instance
let configurationManager: EnterpriseConfigurationManager;

export function getConfigurationManager(): EnterpriseConfigurationManager {
  if (!configurationManager) {
    configurationManager = new EnterpriseConfigurationManager();
  }
  return configurationManager;
}

export { EnterpriseConfigurationManager };
export default getConfigurationManager();
