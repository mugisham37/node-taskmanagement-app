import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const environmentSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_TEST: z.string().optional(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_SECURE: z.string().transform(Boolean).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // SMS
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z.string().optional(),

  // WebAuthn
  WEBAUTHN_RP_NAME: z.string().default('Unified Enterprise Platform'),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_ORIGIN: z.string().default('http://localhost:3000'),

  // File Storage
  STORAGE_TYPE: z.enum(['local', 's3', 'azure']).default('local'),
  STORAGE_PATH: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().transform(Number).default('10485760'),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),

  // Monitoring
  PROMETHEUS_ENABLED: z.string().transform(Boolean).default('true'),
  PROMETHEUS_PORT: z.string().transform(Number).default('9090'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),

  // Security
  BCRYPT_ROUNDS: z.string().transform(Number).default('12'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters'),

  // Feature Flags
  ENABLE_REGISTRATION: z.string().transform(Boolean).default('true'),
  ENABLE_MFA: z.string().transform(Boolean).default('true'),
  ENABLE_OAUTH: z.string().transform(Boolean).default('true'),
  ENABLE_WEBAUTHN: z.string().transform(Boolean).default('true'),
  ENABLE_EMAIL_VERIFICATION: z.string().transform(Boolean).default('true'),

  // Calendar
  GOOGLE_CALENDAR_ENABLED: z.string().transform(Boolean).default('true'),

  // Webhooks
  WEBHOOK_SECRET: z.string().min(32, 'WEBHOOK_SECRET must be at least 32 characters'),

  // Background Jobs
  JOB_QUEUE_REDIS_URL: z.string().default('redis://localhost:6379/1'),
  JOB_CONCURRENCY: z.string().transform(Number).default('5'),

  // Development
  SEED_DATABASE: z.string().transform(Boolean).default('false'),
  ENABLE_API_DOCS: z.string().transform(Boolean).default('true'),
});

type Environment = z.infer<typeof environmentSchema>;

const parseEnvironment = (): Environment => {
  try {
    return environmentSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
};

const env = parseEnvironment();

export const config = {
  app: {
    environment: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },
  server: {
    port: env.PORT,
    host: env.HOST,
  },
  database: {
    url: env.DATABASE_URL,
    testUrl: env.DATABASE_URL_TEST,
  },
  redis: {
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
  },
  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  cors: {
    origin: env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  },
  rateLimit: {
    max: env.RATE_LIMIT_MAX,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  },
  email: {
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    from: env.EMAIL_FROM,
  },
  sms: {
    twilio: {
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      phoneNumber: env.TWILIO_PHONE_NUMBER,
    },
  },
  oauth: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      redirectUri: env.GITHUB_REDIRECT_URI,
    },
  },
  webauthn: {
    rpName: env.WEBAUTHN_RP_NAME,
    rpId: env.WEBAUTHN_RP_ID,
    origin: env.WEBAUTHN_ORIGIN,
  },
  storage: {
    type: env.STORAGE_TYPE,
    path: env.STORAGE_PATH,
    maxFileSize: env.MAX_FILE_SIZE,
    aws: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      region: env.AWS_REGION,
      bucket: env.AWS_S3_BUCKET,
    },
  },
  monitoring: {
    prometheus: {
      enabled: env.PROMETHEUS_ENABLED,
      port: env.PROMETHEUS_PORT,
    },
  },
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },
  security: {
    bcryptRounds: env.BCRYPT_ROUNDS,
    sessionSecret: env.SESSION_SECRET,
    csrfSecret: env.CSRF_SECRET,
  },
  features: {
    registration: env.ENABLE_REGISTRATION,
    mfa: env.ENABLE_MFA,
    oauth: env.ENABLE_OAUTH,
    webauthn: env.ENABLE_WEBAUTHN,
    emailVerification: env.ENABLE_EMAIL_VERIFICATION,
    googleCalendar: env.GOOGLE_CALENDAR_ENABLED,
    apiDocs: env.ENABLE_API_DOCS,
  },
  webhooks: {
    secret: env.WEBHOOK_SECRET,
  },
  jobs: {
    redisUrl: env.JOB_QUEUE_REDIS_URL,
    concurrency: env.JOB_CONCURRENCY,
  },
  development: {
    seedDatabase: env.SEED_DATABASE,
  },
} as const;