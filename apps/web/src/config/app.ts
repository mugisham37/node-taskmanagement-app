import { z } from 'zod'

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_WS_URL: z.string().url().default('ws://localhost:3001'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Task Management'),
  NEXT_PUBLIC_APP_DESCRIPTION: z.string().default('Modern task management application'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
})

// Parse and validate environment variables
const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_DESCRIPTION: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_ANALYTICS_ID: process.env.NEXT_PUBLIC_ANALYTICS_ID,
})

// Application configuration
export const appConfig = {
  // Environment
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  // URLs
  appUrl: env.NEXT_PUBLIC_APP_URL,
  apiUrl: env.NEXT_PUBLIC_API_URL,
  wsUrl: env.NEXT_PUBLIC_WS_URL,

  // App metadata
  name: env.NEXT_PUBLIC_APP_NAME,
  description: env.NEXT_PUBLIC_APP_DESCRIPTION,

  // Features
  features: {
    analytics: !!env.NEXT_PUBLIC_ANALYTICS_ID,
    errorReporting: !!env.NEXT_PUBLIC_SENTRY_DSN,
    darkMode: true,
    notifications: true,
    realtime: true,
    offline: true,
  },

  // API configuration
  api: {
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
  },

  // Cache configuration
  cache: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  },

  // UI configuration
  ui: {
    pageSize: 20,
    maxPageSize: 100,
    debounceDelay: 300,
    toastDuration: 5000,
  },

  // Theme configuration
  theme: {
    defaultTheme: 'light',
    storageKey: 'taskmanagement-theme',
  },

  // Authentication configuration
  auth: {
    tokenKey: 'taskmanagement-token',
    refreshTokenKey: 'taskmanagement-refresh-token',
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Validation configuration
  validation: {
    passwordMinLength: 8,
    passwordMaxLength: 128,
    usernameMinLength: 3,
    usernameMaxLength: 30,
    taskTitleMaxLength: 200,
    taskDescriptionMaxLength: 2000,
    projectNameMaxLength: 100,
    projectDescriptionMaxLength: 1000,
  },

  // File upload configuration
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
    maxFiles: 5,
  },

  // Pagination configuration
  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  },

  // Date/Time configuration
  dateTime: {
    defaultTimezone: 'UTC',
    dateFormat: 'yyyy-MM-dd',
    timeFormat: 'HH:mm',
    dateTimeFormat: 'yyyy-MM-dd HH:mm',
  },

  // External services
  services: {
    sentry: {
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    },
    analytics: {
      id: env.NEXT_PUBLIC_ANALYTICS_ID,
      enabled: env.NODE_ENV === 'production',
    },
  },
} as const

// Type exports
export type AppConfig = typeof appConfig
export type Environment = typeof env

// Utility functions
export const isClient = typeof window !== 'undefined'
export const isServer = !isClient

export const getBaseUrl = () => {
  if (isClient) return ''
  return appConfig.appUrl
}

export const getApiUrl = (path = '') => {
  const baseUrl = isClient ? '' : appConfig.apiUrl
  return `${baseUrl}/api${path}`
}

export const getWsUrl = () => {
  return appConfig.wsUrl
}