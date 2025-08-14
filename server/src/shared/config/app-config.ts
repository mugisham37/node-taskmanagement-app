import { z } from 'zod';

/**
 * Application configuration schema
 */
const AppConfigSchema = z.object({
  // Server Configuration
  port: z.number().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z
    .enum(['development', 'production', 'test', 'staging'])
    .default('development'),

  // Logging Configuration
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  logFormat: z.enum(['json', 'simple']).default('json'),

  // Security Configuration
  corsOrigins: z.array(z.string()).default(['http://localhost:3000']),
  rateLimitMax: z.number().default(100),
  rateLimitWindow: z.number().default(15 * 60 * 1000), // 15 minutes

  // Feature Flags
  enableSwagger: z.boolean().default(true),
  enableMetrics: z.boolean().default(true),
  enableWebSocket: z.boolean().default(true),

  // Performance Configuration
  requestTimeout: z.number().default(30000), // 30 seconds
  bodyLimit: z.number().default(1048576), // 1MB

  // Health Check Configuration
  healthCheckInterval: z.number().default(30000), // 30 seconds
  gracefulShutdownTimeout: z.number().default(10000), // 10 seconds

  // Monitoring Configuration
  enablePrometheus: z.boolean().default(true),
  prometheusPort: z.number().default(9090),
  metricsPath: z.string().default('/metrics'),

  // Security Features
  enableMFA: z.boolean().default(true),
  enableOAuth: z.boolean().default(true),
  enableAPIRateLimit: z.boolean().default(true),

  // API Documentation
  enableAPIDocs: z.boolean().default(true),
  apiDocsPath: z.string().default('/api-docs'),
});

/**
 * Database configuration schema
 */
const DatabaseConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().min(1).max(65535).default(5432),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().default(false),

  // Connection Pool Configuration
  maxConnections: z.number().default(20),
  minConnections: z.number().default(5),
  connectionTimeout: z.number().default(5000),
  idleTimeout: z.number().default(30000),

  // Migration Configuration
  migrationsPath: z
    .string()
    .default('./src/infrastructure/database/migrations'),
  seedsPath: z.string().default('./src/infrastructure/database/seeds'),
});

/**
 * Redis configuration schema
 */
const RedisConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().min(1).max(65535).default(6379),
  password: z.string().optional(),
  db: z.number().default(0),

  // Connection Configuration
  maxRetriesPerRequest: z.number().default(3),
  retryDelayOnFailover: z.number().default(100),
  connectTimeout: z.number().default(10000),
  commandTimeout: z.number().default(5000),

  // Cache Configuration
  defaultTTL: z.number().default(3600), // 1 hour
  keyPrefix: z.string().default('taskmanagement:'),
});

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
});

/**
 * Email configuration schema
 */
const EmailConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  user: z.string().optional(),
  password: z.string().optional(),
  from: z.string().email(),
  replyTo: z.string().email().optional(),

  // SMTP nested structure for compatibility
  smtp: z.object({
    host: z.string().min(1),
    port: z.number().min(1).max(65535).default(587),
    secure: z.boolean().default(false),
    auth: z.object({
      user: z.string().optional(),
      pass: z.string().optional(),
    }).optional(),
  }).optional(),

  // Template Configuration
  templatesPath: z
    .string()
    .default('./src/infrastructure/external-services/templates'),

  // Queue Configuration
  enableQueue: z.boolean().default(true),
  maxRetries: z.number().default(3),
  retryDelay: z.number().default(5000),

  // Attachment limits
  maxAttachmentSize: z.number().default(10 * 1024 * 1024), // 10MB
  maxTotalAttachmentSize: z.number().default(50 * 1024 * 1024), // 50MB
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type JwtConfig = z.infer<typeof JwtConfigSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;

/**
 * Configuration loader with validation
 */
export class ConfigLoader {
  /**
   * Load and validate application configuration
   */
  static loadAppConfig(): AppConfig {
    const config = {
      port: parseInt(process.env['PORT'] || '3000'),
      host: process.env['HOST'] || '0.0.0.0',
      nodeEnv: process.env['NODE_ENV'] || 'development',
      logLevel: process.env['LOG_LEVEL'] || 'info',
      logFormat: process.env['LOG_FORMAT'] || 'json',
      corsOrigins: process.env['CORS_ORIGINS']?.split(',') || [
        'http://localhost:3000',
      ],
      rateLimitMax: parseInt(process.env['RATE_LIMIT_MAX'] || '100'),
      rateLimitWindow: parseInt(process.env['RATE_LIMIT_WINDOW'] || '900000'),
      enableSwagger: process.env['ENABLE_SWAGGER'] !== 'false',
      enableMetrics: process.env['ENABLE_METRICS'] !== 'false',
      enableWebSocket: process.env['ENABLE_WEBSOCKET'] !== 'false',
      requestTimeout: parseInt(process.env['REQUEST_TIMEOUT'] || '30000'),
      bodyLimit: parseInt(process.env['BODY_LIMIT'] || '1048576'),
      healthCheckInterval: parseInt(
        process.env['HEALTH_CHECK_INTERVAL'] || '30000'
      ),
      gracefulShutdownTimeout: parseInt(
        process.env['GRACEFUL_SHUTDOWN_TIMEOUT'] || '10000'
      ),
      enablePrometheus: process.env['ENABLE_PROMETHEUS'] !== 'false',
      prometheusPort: parseInt(process.env['PROMETHEUS_PORT'] || '9090'),
      metricsPath: process.env['METRICS_PATH'] || '/metrics',
      enableMFA: process.env['ENABLE_MFA'] !== 'false',
      enableOAuth: process.env['ENABLE_OAUTH'] !== 'false',
      enableAPIRateLimit: process.env['ENABLE_API_RATE_LIMIT'] !== 'false',
      enableAPIDocs: process.env['ENABLE_API_DOCS'] !== 'false',
      apiDocsPath: process.env['API_DOCS_PATH'] || '/api-docs',
    };

    return AppConfigSchema.parse(config);
  }

  /**
   * Load and validate database configuration
   */
  static loadDatabaseConfig(): DatabaseConfig {
    const config = {
      host: process.env['DB_HOST'] || 'localhost',
      port: parseInt(process.env['DB_PORT'] || '5432'),
      database: process.env['DB_NAME'] || 'taskmanagement',
      username: process.env['DB_USER'] || 'postgres',
      password: process.env['DB_PASSWORD'] || 'password',
      ssl: process.env['DB_SSL'] === 'true',
      maxConnections: parseInt(process.env['DB_MAX_CONNECTIONS'] || '20'),
      minConnections: parseInt(process.env['DB_MIN_CONNECTIONS'] || '5'),
      connectionTimeout: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '5000'),
      idleTimeout: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000'),
      migrationsPath:
        process.env['DB_MIGRATIONS_PATH'] ||
        './src/infrastructure/database/migrations',
      seedsPath:
        process.env['DB_SEEDS_PATH'] || './src/infrastructure/database/seeds',
    };

    return DatabaseConfigSchema.parse(config);
  }

  /**
   * Load and validate Redis configuration
   */
  static loadRedisConfig(): RedisConfig {
    const config = {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      password: process.env['REDIS_PASSWORD'],
      db: parseInt(process.env['REDIS_DB'] || '0'),
      maxRetriesPerRequest: parseInt(process.env['REDIS_MAX_RETRIES'] || '3'),
      retryDelayOnFailover: parseInt(process.env['REDIS_RETRY_DELAY'] || '100'),
      connectTimeout: parseInt(process.env['REDIS_CONNECT_TIMEOUT'] || '10000'),
      commandTimeout: parseInt(process.env['REDIS_COMMAND_TIMEOUT'] || '5000'),
      defaultTTL: parseInt(process.env['REDIS_DEFAULT_TTL'] || '3600'),
      keyPrefix: process.env['REDIS_KEY_PREFIX'] || 'taskmanagement:',
    };

    return RedisConfigSchema.parse(config);
  }

  /**
   * Load and validate JWT configuration
   */
  static loadJwtConfig(): JwtConfig {
    const secret = process.env['JWT_SECRET'] || 'your-secret-key-change-in-production';
    
    const config = {
      secret,
      accessTokenSecret: process.env['JWT_ACCESS_SECRET'] || secret,
      refreshTokenSecret: process.env['JWT_REFRESH_SECRET'] || secret + '_refresh',
      expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
      accessTokenExpiresIn: process.env['JWT_ACCESS_EXPIRES_IN'] || '15m',
      refreshTokenExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d',
      issuer: process.env['JWT_ISSUER'] || 'task-management-system',
      audience: process.env['JWT_AUDIENCE'] || 'task-management-users',
    };

    return JwtConfigSchema.parse(config);
  }

  /**
   * Load and validate email configuration
   */
  static loadEmailConfig(): EmailConfig {
    const host = process.env['EMAIL_HOST'] || 'localhost';
    const port = parseInt(process.env['EMAIL_PORT'] || '587');
    const secure = process.env['EMAIL_SECURE'] === 'true';
    const user = process.env['EMAIL_USER'];
    const password = process.env['EMAIL_PASSWORD'];

    const config = {
      host,
      port,
      secure,
      user,
      password,
      from: process.env['EMAIL_FROM'] || 'noreply@taskmanagement.com',
      replyTo: process.env['EMAIL_REPLY_TO'],
      smtp: {
        host,
        port,
        secure,
        auth: user && password ? {
          user,
          pass: password,
        } : undefined,
      },
      templatesPath:
        process.env['EMAIL_TEMPLATES_PATH'] ||
        './src/infrastructure/external-services/templates',
      enableQueue: process.env['EMAIL_ENABLE_QUEUE'] !== 'false',
      maxRetries: parseInt(process.env['EMAIL_MAX_RETRIES'] || '3'),
      retryDelay: parseInt(process.env['EMAIL_RETRY_DELAY'] || '5000'),
      maxAttachmentSize: parseInt(process.env['EMAIL_MAX_ATTACHMENT_SIZE'] || (10 * 1024 * 1024).toString()),
      maxTotalAttachmentSize: parseInt(process.env['EMAIL_MAX_TOTAL_ATTACHMENT_SIZE'] || (50 * 1024 * 1024).toString()),
    };

    return EmailConfigSchema.parse(config);
  }

  /**
   * Validate all configurations
   */
  static validateAllConfigs(): {
    app: AppConfig;
    database: DatabaseConfig;
    redis: RedisConfig;
    jwt: JwtConfig;
    email: EmailConfig;
  } {
    try {
      return {
        app: this.loadAppConfig(),
        database: this.loadDatabaseConfig(),
        redis: this.loadRedisConfig(),
        jwt: this.loadJwtConfig(),
        email: this.loadEmailConfig(),
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map(issue => `${issue.path.join('.')}: ${issue.message}`)
          .join('\n');
        throw new Error(`Configuration validation failed:\n${issues}`);
      }
      throw error;
    }
  }
}
