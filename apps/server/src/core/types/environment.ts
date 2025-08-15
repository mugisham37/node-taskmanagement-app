/**
 * Environment variable type definitions
 * This module provides proper typing for environment variables
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Core application settings
      NODE_ENV: 'development' | 'production' | 'staging' | 'test';
      PORT: string;
      HOST: string;
      
      // API Configuration
      API_VERSION: string;
      API_BASE_URL: string;
      STAGING_API_URL: string;
      
      // Database Configuration
      DATABASE_URL: string;
      DATABASE_URL_TEST?: string;
      
      // Redis Configuration
      REDIS_URL: string;
      
      // JWT Configuration
      JWT_SECRET: string;
      JWT_REFRESH_SECRET: string;
      JWT_EXPIRES_IN: string;
      JWT_REFRESH_EXPIRES_IN: string;
      
      // Security Configuration
      SESSION_SECRET: string;
      CSRF_SECRET: string;
      COOKIE_SECRET?: string;
      BCRYPT_ROUNDS: string;
      
      // CORS Configuration
      CORS_ORIGIN: string;
      
      // Rate Limiting
      RATE_LIMIT_MAX: string;
      RATE_LIMIT_WINDOW_MS: string;
      
      // Email Configuration
      SMTP_HOST: string;
      SMTP_PORT: string;
      SMTP_SECURE: string;
      EMAIL_FROM: string;
      
      // Monitoring Configuration
      PROMETHEUS_ENABLED: string;
      PROMETHEUS_PORT: string;
      LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
      
      // Feature Flags
      ENABLE_REGISTRATION: string;
      ENABLE_MFA: string;
      ENABLE_OAUTH: string;
      ENABLE_API_DOCS: string;
      
      // Webhook Configuration
      WEBHOOK_SECRET: string;
      
      // Additional settings
      STATIC_FILES_PATH?: string;
      TRUST_PROXY?: string;
    }
  }
}

/**
 * Environment variable utility functions
 */
export class EnvironmentUtils {
  /**
   * Get environment variable with fallback
   */
  static getEnvVar(key: keyof NodeJS.ProcessEnv, fallback?: string): string {
    return process.env[key] || fallback || '';
  }

  /**
   * Get boolean environment variable
   */
  static getBooleanEnvVar(key: keyof NodeJS.ProcessEnv, fallback = false): boolean {
    const value = process.env[key];
    if (value === undefined) return fallback;
    return value.toLowerCase() === 'true';
  }

  /**
   * Get number environment variable
   */
  static getNumberEnvVar(key: keyof NodeJS.ProcessEnv, fallback = 0): number {
    const value = process.env[key];
    if (value === undefined) return fallback;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  /**
   * Validate required environment variables
   */
  static validateRequiredEnvVars(requiredVars: (keyof NodeJS.ProcessEnv)[]): void {
    const missing = requiredVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Check if running in production
   */
  static isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Check if running in development
   */
  static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Check if running in test environment
   */
  static isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  /**
   * Check if running in staging
   */
  static isStaging(): boolean {
    return process.env.NODE_ENV === 'staging';
  }
}

export default EnvironmentUtils;