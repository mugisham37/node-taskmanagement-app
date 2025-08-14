import { z } from 'zod';

// Server configuration schema
const serverConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  host: z.string().default('localhost'),
  cors: z.object({
    origin: z.union([z.string(), z.array(z.string()), z.boolean()]).default(true),
    credentials: z.boolean().default(true),
    methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']),
    allowedHeaders: z.array(z.string()).default(['Content-Type', 'Authorization']),
  }).default({}),
  trustProxy: z.boolean().default(false),
  bodyLimit: z.string().default('10mb'),
  timeout: z.number().int().min(1000).default(30000), // 30 seconds
});

// Client configuration schema
const clientConfigSchema = z.object({
  url: z.string().url().default('http://localhost:3000'),
  apiUrl: z.string().url().default('http://localhost:3001'),
  wsUrl: z.string().default('ws://localhost:3001'),
  title: z.string().default('Task Management Platform'),
  description: z.string().default('A comprehensive task and project management platform'),
  version: z.string().default('1.0.0'),
});

// Cache configuration schema
const cacheConfigSchema = z.object({
  redis: z.object({
    url: z.string().optional(),
    host: z.string().default('localhost'),
    port: z.number().int().min(1).max(65535).default(6379),
    password: z.string().optional(),
    db: z.number().int().min(0).default(0),
    keyPrefix: z.string().default('taskmanagement:'),
    maxRetriesPerRequest: z.number().int().min(0).default(3),
    retryDelayOnFailover: z.number().int().min(100).default(100),
    enableOfflineQueue: z.boolean().default(false),
    lazyConnect: z.boolean().default(true),
  }).default({}),
  ttl: z.object({
    default: z.number().int().min(60).default(300), // 5 minutes
    short: z.number().int().min(30).default(60), // 1 minute
    long: z.number().int().min(600).default(3600), // 1 hour
    session: z.number().int().min(900).default(86400), // 24 hours
  }).default({}),
});

// File upload configuration schema
const fileUploadConfigSchema = z.object({
  maxSize: z.number().int().min(1024).default(50 * 1024 * 1024), // 50MB
  allowedTypes: z.array(z.string()).default([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
  ]),
  uploadPath: z.string().default('./uploads'),
  publicPath: z.string().default('/uploads'),
  storage: z.enum(['local', 's3', 'gcs']).default('local'),
  s3: z.object({
    bucket: z.string().optional(),
    region: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    endpoint: z.string().optional(),
  }).default({}),
});

// Email configuration schema
const emailConfigSchema = z.object({
  provider: z.enum(['smtp', 'sendgrid', 'mailgun', 'ses']).default('smtp'),
  from: z.string().email().default('noreply@taskmanagement.com'),
  replyTo: z.string().email().optional(),
  smtp: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().min(1).max(65535).default(587),
    secure: z.boolean().default(false),
    auth: z.object({
      user: z.string().optional(),
      pass: z.string().optional(),
    }).default({}),
  }).default({}),
  sendgrid: z.object({
    apiKey: z.string().optional(),
  }).default({}),
  mailgun: z.object({
    apiKey: z.string().optional(),
    domain: z.string().optional(),
  }).default({}),
  ses: z.object({
    region: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
  }).default({}),
});

// Logging configuration schema
const loggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  format: z.enum(['json', 'simple', 'combined']).default('json'),
  file: z.object({
    enabled: z.boolean().default(true),
    path: z.string().default('./logs'),
    maxSize: z.string().default('10m'),
    maxFiles: z.number().int().min(1).default(5),
  }).default({}),
  console: z.object({
    enabled: z.boolean().default(true),
    colorize: z.boolean().default(true),
  }).default({}),
});

// Monitoring configuration schema
const monitoringConfigSchema = z.object({
  enabled: z.boolean().default(false),
  prometheus: z.object({
    enabled: z.boolean().default(false),
    port: z.number().int().min(1).max(65535).default(9090),
    path: z.string().default('/metrics'),
  }).default({}),
  healthCheck: z.object({
    enabled: z.boolean().default(true),
    path: z.string().default('/health'),
    interval: z.number().int().min(1000).default(30000), // 30 seconds
  }).default({}),
});

// Main app configuration schema
const appConfigSchema = z.object({
  env: z.enum(['development', 'staging', 'production']).default('development'),
  debug: z.boolean().default(false),
  server: serverConfigSchema.default({}),
  client: clientConfigSchema.default({}),
  cache: cacheConfigSchema.default({}),
  fileUpload: fileUploadConfigSchema.default({}),
  email: emailConfigSchema.default({}),
  logging: loggingConfigSchema.default({}),
  monitoring: monitoringConfigSchema.default({}),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type ClientConfig = z.infer<typeof clientConfigSchema>;
export type CacheConfig = z.infer<typeof cacheConfigSchema>;
export type FileUploadConfig = z.infer<typeof fileUploadConfigSchema>;
export type EmailConfig = z.infer<typeof emailConfigSchema>;

// Create app configuration from environment variables
export const createAppConfig = (): AppConfig => {
  const config = {
    env: (process.env.NODE_ENV as any) || 'development',
    debug: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development',
    server: {
      port: parseInt(process.env.PORT || process.env.SERVER_PORT || '3000'),
      host: process.env.HOST || process.env.SERVER_HOST || 'localhost',
      cors: {
        origin: process.env.CORS_ORIGIN ? 
          (process.env.CORS_ORIGIN.includes(',') ? 
            process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : 
            process.env.CORS_ORIGIN) : 
          true,
        credentials: process.env.CORS_CREDENTIALS !== 'false',
        methods: process.env.CORS_METHODS ? 
          process.env.CORS_METHODS.split(',').map(s => s.trim()) : 
          ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: process.env.CORS_ALLOWED_HEADERS ? 
          process.env.CORS_ALLOWED_HEADERS.split(',').map(s => s.trim()) : 
          ['Content-Type', 'Authorization'],
      },
      trustProxy: process.env.TRUST_PROXY === 'true',
      bodyLimit: process.env.BODY_LIMIT || '10mb',
      timeout: parseInt(process.env.SERVER_TIMEOUT || '30000'),
    },
    client: {
      url: process.env.CLIENT_URL || 'http://localhost:3000',
      apiUrl: process.env.API_URL || 'http://localhost:3001',
      wsUrl: process.env.WS_URL || 'ws://localhost:3001',
      title: process.env.APP_TITLE || 'Task Management Platform',
      description: process.env.APP_DESCRIPTION || 'A comprehensive task and project management platform',
      version: process.env.APP_VERSION || '1.0.0',
    },
    cache: {
      redis: {
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'taskmanagement:',
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
        retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
        enableOfflineQueue: process.env.REDIS_OFFLINE_QUEUE === 'true',
        lazyConnect: process.env.REDIS_LAZY_CONNECT !== 'false',
      },
      ttl: {
        default: parseInt(process.env.CACHE_TTL_DEFAULT || '300'),
        short: parseInt(process.env.CACHE_TTL_SHORT || '60'),
        long: parseInt(process.env.CACHE_TTL_LONG || '3600'),
        session: parseInt(process.env.CACHE_TTL_SESSION || '86400'),
      },
    },
    fileUpload: {
      maxSize: parseInt(process.env.FILE_UPLOAD_MAX_SIZE || String(50 * 1024 * 1024)),
      allowedTypes: process.env.FILE_UPLOAD_ALLOWED_TYPES ? 
        process.env.FILE_UPLOAD_ALLOWED_TYPES.split(',').map(s => s.trim()) : 
        [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'text/csv',
        ],
      uploadPath: process.env.FILE_UPLOAD_PATH || './uploads',
      publicPath: process.env.FILE_UPLOAD_PUBLIC_PATH || '/uploads',
      storage: (process.env.FILE_UPLOAD_STORAGE as any) || 'local',
      s3: {
        bucket: process.env.AWS_S3_BUCKET,
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        endpoint: process.env.AWS_S3_ENDPOINT,
      },
    },
    email: {
      provider: (process.env.EMAIL_PROVIDER as any) || 'smtp',
      from: process.env.EMAIL_FROM || 'noreply@taskmanagement.com',
      replyTo: process.env.EMAIL_REPLY_TO,
      smtp: {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
      },
      mailgun: {
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN,
      },
      ses: {
        region: process.env.AWS_SES_REGION,
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
      },
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      format: (process.env.LOG_FORMAT as any) || 'json',
      file: {
        enabled: process.env.LOG_FILE_ENABLED !== 'false',
        path: process.env.LOG_FILE_PATH || './logs',
        maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
        maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5'),
      },
      console: {
        enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
        colorize: process.env.LOG_CONSOLE_COLORIZE !== 'false',
      },
    },
    monitoring: {
      enabled: process.env.MONITORING_ENABLED === 'true',
      prometheus: {
        enabled: process.env.PROMETHEUS_ENABLED === 'true',
        port: parseInt(process.env.PROMETHEUS_PORT || '9090'),
        path: process.env.PROMETHEUS_PATH || '/metrics',
      },
      healthCheck: {
        enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
        path: process.env.HEALTH_CHECK_PATH || '/health',
        interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
      },
    },
  };

  return appConfigSchema.parse(config);
};

// Export the configuration
export const appConfig = createAppConfig();

// Validate app configuration
export const validateAppConfig = (config: unknown): AppConfig => {
  return appConfigSchema.parse(config);
};