import * as dotenv from 'dotenv';
import * as path from 'path';
import { z } from 'zod';

/**
 * Environment types
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Environment configuration schema
 */
const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).default(3000),
  HOST: z.string().default('0.0.0.0'),
  
  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z.string().transform(val => val === 'true').default(false),
  
  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(0)).default(0),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Email
  EMAIL_HOST: z.string().min(1),
  EMAIL_PORT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).default(587),
  EMAIL_SECURE: z.string().transform(val => val === 'true').default(false),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email(),
  
  // Monitoring
  ENABLE_PROMETHEUS: z.string().transform(val => val !== 'false').default(true),
  PROMETHEUS_PORT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).default(9090),
  
  // Security
  CORS_ORIGINS: z.string().transform(val => val.split(',')).default('http://localhost:3000'),
  RATE_LIMIT_MAX: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).default(100),
  
  // Features
  ENABLE_SWAGGER: z.string().transform(val => val !== 'false').default(true),
  ENABLE_WEBSOCKET: z.string().transform(val => val !== 'false').default(true),
  ENABLE_MFA: z.string().transform(val => val !== 'false').default(true),
});

export type EnvironmentVariables = z.infer<typeof EnvironmentSchema>;

/**
 * Environment loader with validation and environment-specific overrides
 */
export class EnvironmentLoader {
  private static instance: EnvironmentLoader;
  private env: EnvironmentVariables;
  private isLoaded = false;

  private constructor() {
    this.env = {} as EnvironmentVariables;
  }

  static getInstance(): EnvironmentLoader {
    if (!EnvironmentLoader.instance) {
      EnvironmentLoader.instance = new EnvironmentLoader();
    }
    return EnvironmentLoader.instance;
  }

  /**
   * Load environment variables with validation
   */
  load(envPath?: string): EnvironmentVariables {
    if (this.isLoaded) {
      return this.env;
    }

    // Load environment-specific .env files
    this.loadEnvironmentFiles(envPath);

    // Validate and parse environment variables
    try {
      this.env = EnvironmentSchema.parse(process.env);
      this.isLoaded = true;
      
      console.log(`✅ Environment loaded successfully: ${this.env.NODE_ENV}`);
      return this.env;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map(issue => `${issue.path.join('.')}: ${issue.message}`)
          .join('\n');
        throw new Error(`Environment validation failed:\n${issues}`);
      }
      throw error;
    }
  }

  /**
   * Get current environment variables
   */
  getEnv(): EnvironmentVariables {
    if (!this.isLoaded) {
      throw new Error('Environment not loaded. Call load() first.');
    }
    return this.env;
  }

  /**
   * Get current environment type
   */
  getEnvironment(): Environment {
    return this.getEnv().NODE_ENV;
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  /**
   * Check if running in test
   */
  isTest(): boolean {
    return this.getEnvironment() === 'test';
  }

  /**
   * Check if running in staging
   */
  isStaging(): boolean {
    return this.getEnvironment() === 'staging';
  }

  /**
   * Load environment-specific .env files
   */
  private loadEnvironmentFiles(envPath?: string): void {
    const rootPath = envPath || process.cwd();
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Load files in order of precedence (last loaded wins)
    const envFiles = [
      '.env',
      `.env.${nodeEnv}`,
      '.env.local',
      `.env.${nodeEnv}.local`,
    ];

    envFiles.forEach(file => {
      const filePath = path.resolve(rootPath, file);
      try {
        dotenv.config({ path: filePath });
        console.log(`📄 Loaded environment file: ${file}`);
      } catch (error) {
        // File doesn't exist, continue
      }
    });
  }

  /**
   * Validate required environment variables for specific environment
   */
  validateEnvironment(environment: Environment): {
    isValid: boolean;
    missingVars: string[];
    warnings: string[];
  } {
    const env = this.getEnv();
    const missingVars: string[] = [];
    const warnings: string[] = [];

    // Production-specific validations
    if (environment === 'production') {
      if (env.JWT_SECRET === 'your-secret-key-change-in-production') {
        missingVars.push('JWT_SECRET (using default insecure value)');
      }
      
      if (!env.DB_SSL) {
        warnings.push('DB_SSL is disabled in production');
      }
      
      if (env.ENABLE_SWAGGER) {
        warnings.push('Swagger is enabled in production');
      }
    }

    // Development-specific validations
    if (environment === 'development') {
      if (!env.ENABLE_SWAGGER) {
        warnings.push('Swagger is disabled in development');
      }
    }

    return {
      isValid: missingVars.length === 0,
      missingVars,
      warnings,
    };
  }

  /**
   * Get environment-specific configuration overrides
   */
  getEnvironmentOverrides(): Record<string, any> {
    const env = this.getEnvironment();
    
    switch (env) {
      case 'production':
        return {
          logLevel: 'warn',
          enableSwagger: false,
          enableMetrics: true,
          rateLimitMax: 50,
          requestTimeout: 10000,
        };
      
      case 'staging':
        return {
          logLevel: 'info',
          enableSwagger: true,
          enableMetrics: true,
          rateLimitMax: 200,
        };
      
      case 'test':
        return {
          logLevel: 'error',
          enableSwagger: false,
          enableMetrics: false,
          enableWebSocket: false,
        };
      
      case 'development':
      default:
        return {
          logLevel: 'debug',
          enableSwagger: true,
          enableMetrics: true,
          rateLimitMax: 1000,
        };
    }
  }
}

/**
 * Global environment loader instance
 */
export const environmentLoader = EnvironmentLoader.getInstance();