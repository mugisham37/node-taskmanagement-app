import dotenv from "dotenv"
import path from "path"

// Load environment variables from .env file in the project root
dotenv.config({ path: path.resolve(process.cwd(), '../.env') })

interface EnvironmentConfig {
  // Server Configuration
  nodeEnv: string
  port: number
  apiVersion: string
  apiUrl: string
  frontendUrl: string
  clientUrl: string

  // Database Configuration
  databaseUrl: string
  
  // JWT Configuration
  jwtSecret: string
  jwtAccessExpiration: string
  jwtRefreshExpiration: string
  jwtExpiresIn: string
  jwtRefreshExpiresIn: string

  // Redis Configuration
  redisUrl?: string
  useRedis: boolean
  disableCache: string

  // Email Configuration
  emailService: string
  emailUser: string
  emailPassword: string
  emailFrom: string
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPass?: string

  // File Upload Configuration
  maxFileSize: number
  uploadPath: string
  uploadDir: string

  // Logging Configuration
  logLevel: string
  logDir: string

  // Rate Limiting Configuration
  rateLimitWindowMs: number
  rateLimitMax: number
  rateLimitSkipSuccessful: string
  skipRateLimitInDev: string

  // Auth Rate Limiting
  authRateLimitWindowMs: string
  authRateLimitMax: string

  // Session Configuration
  sessionSecret: string

  // CORS Configuration
  corsOrigin: string
  allowedOrigins: string[]

  // Security Configuration
  enableHelmet: string
  enableCors: string
  trustProxy: string

  // API Versioning
  defaultApiVersion: string
  supportedApiVersions: string[]

  // Internationalization
  defaultLanguage: string
  supportedLanguages: string[]

  // Audit Configuration
  enableAuditLog: string
  auditLogRetentionDays: number

  // Job Configuration
  enableJobs: boolean
  jobIntervals: {
    taskNotifications: number
    recurringTasks: number
    calendarReminders: number
    overdueTaskCheck: number
  }

  // Monitoring Configuration
  enableMonitoring: boolean
  monitoringInterval: number

  // Cache Configuration
  cacheDefaultTtl: number
  cacheMaxKeys: number
}

const config: EnvironmentConfig = {
  // Server Configuration
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number.parseInt(process.env.PORT || "3000", 10),
  apiVersion: process.env.API_VERSION || "v1",
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api/${process.env.API_VERSION || "v1"}`,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",

  // Database Configuration
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/taskmanagement",

  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production",
  jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || "15m",
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || "7d",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  // Redis Configuration
  redisUrl: process.env.REDIS_URL || "",
  useRedis: process.env.USE_REDIS === "true",
  disableCache: process.env.DISABLE_CACHE || "false",

  // Email Configuration
  emailService: process.env.EMAIL_SERVICE || "gmail",
  emailUser: process.env.EMAIL_USER || "",
  emailPassword: process.env.EMAIL_PASSWORD || "",
  emailFrom: process.env.EMAIL_FROM || "noreply@taskmanagement.com",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT ? Number.parseInt(process.env.SMTP_PORT, 10) : undefined,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,

  // File Upload Configuration
  maxFileSize: Number.parseInt(process.env.MAX_FILE_SIZE || "5242880", 10), // 5MB
  uploadPath: process.env.UPLOAD_PATH || "uploads",
  uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"),

  // Logging Configuration
  logLevel: process.env.LOG_LEVEL || "info",
  logDir: process.env.LOG_DIR || path.join(process.cwd(), "logs"),

  // Rate Limiting Configuration
  rateLimitWindowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "15000", 10),
  rateLimitMax: Number.parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  rateLimitSkipSuccessful: process.env.RATE_LIMIT_SKIP_SUCCESSFUL || "false",
  skipRateLimitInDev: process.env.SKIP_RATE_LIMIT_IN_DEV || "true",

  // Auth Rate Limiting
  authRateLimitWindowMs: process.env.AUTH_RATE_LIMIT_WINDOW_MS || "900000", // 15 minutes
  authRateLimitMax: process.env.AUTH_RATE_LIMIT_MAX || "10",

  // Session Configuration
  sessionSecret: process.env.SESSION_SECRET || "your-session-secret-change-this-in-production",

  // CORS Configuration
  corsOrigin: process.env.CORS_ORIGIN || "*",
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],

  // Security Configuration
  enableHelmet: process.env.ENABLE_HELMET || "true",
  enableCors: process.env.ENABLE_CORS || "true",
  trustProxy: process.env.TRUST_PROXY || "false",

  // API Versioning
  defaultApiVersion: process.env.DEFAULT_API_VERSION || "v1",
  supportedApiVersions: process.env.SUPPORTED_API_VERSIONS?.split(",") || ["v1", "v2"],

  // Internationalization
  defaultLanguage: process.env.DEFAULT_LANGUAGE || "en",
  supportedLanguages: (process.env.SUPPORTED_LANGUAGES || "en,fr,es,de,zh").split(","),

  // Audit Configuration
  enableAuditLog: process.env.ENABLE_AUDIT_LOG || "true",
  auditLogRetentionDays: Number.parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || "90", 10),

  // Job Configuration
  enableJobs: process.env.ENABLE_JOBS !== "false",
  jobIntervals: {
    taskNotifications: Number.parseInt(process.env.TASK_NOTIFICATIONS_INTERVAL || "300000", 10), // 5 minutes
    recurringTasks: Number.parseInt(process.env.RECURRING_TASKS_INTERVAL || "300000", 10), // 5 minutes
    calendarReminders: Number.parseInt(process.env.CALENDAR_REMINDERS_INTERVAL || "300000", 10), // 5 minutes
    overdueTaskCheck: Number.parseInt(process.env.OVERDUE_TASK_CHECK_INTERVAL || "3600000", 10), // 1 hour
  },

  // Monitoring Configuration
  enableMonitoring: process.env.ENABLE_MONITORING !== "false",
  monitoringInterval: Number.parseInt(process.env.MONITORING_INTERVAL || "60000", 10), // 1 minute

  // Cache Configuration
  cacheDefaultTtl: Number.parseInt(process.env.CACHE_DEFAULT_TTL || "3600", 10), // 1 hour
  cacheMaxKeys: Number.parseInt(process.env.CACHE_MAX_KEYS || "1000", 10),
}

// Enhanced validation with detailed error messages
const validateConfig = (): void => {
  const errors: string[] = []
  const warnings: string[] = []

  // Critical validations for production
  if (config.nodeEnv === "production") {
    if (!config.jwtSecret || config.jwtSecret === "your-super-secret-jwt-key-change-this-in-production") {
      errors.push("JWT_SECRET must be set in production")
    }

    if (!config.sessionSecret || config.sessionSecret === "your-session-secret-change-this-in-production") {
      errors.push("SESSION_SECRET must be set in production")
    }

    if (!config.databaseUrl || config.databaseUrl.includes("localhost")) {
      errors.push("DATABASE_URL must be set to a production database in production")
    }

    if (config.emailUser === "" || config.emailPassword === "") {
      warnings.push("Email configuration is incomplete. Email features may not work properly.")
    }
  } else {
    // Development warnings
    if (!config.jwtSecret || config.jwtSecret === "your-super-secret-jwt-key-change-this-in-production") {
      warnings.push("Using default JWT_SECRET. Please set a secure JWT_SECRET in production.")
    }

    if (!config.sessionSecret || config.sessionSecret === "your-session-secret-change-this-in-production") {
      warnings.push("Using default SESSION_SECRET. Please set a secure SESSION_SECRET in production.")
    }
  }

  // Port validation
  if (config.port < 1 || config.port > 65535) {
    errors.push("PORT must be between 1 and 65535")
  }

  // File size validation
  if (config.maxFileSize < 1024) {
    warnings.push("MAX_FILE_SIZE is very small (< 1KB). This may cause issues with file uploads.")
  }

  // Rate limiting validation
  if (config.rateLimitMax < 1) {
    errors.push("RATE_LIMIT_MAX must be greater than 0")
  }

  // Log errors and warnings
  if (errors.length > 0) {
    console.error("❌ Configuration errors:")
    errors.forEach(error => console.error(`  - ${error}`))
    throw new Error(`Configuration validation failed: ${errors.join(", ")}`)
  }

  if (warnings.length > 0) {
    console.warn("⚠️  Configuration warnings:")
    warnings.forEach(warning => console.warn(`  - ${warning}`))
  }

  console.log("✅ Configuration validated successfully")
}

// Validate configuration on load
validateConfig()

export default config
