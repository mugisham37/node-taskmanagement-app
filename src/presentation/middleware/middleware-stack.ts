import { Express, Request, Response, NextFunction } from 'express';
import { ILogger } from '../../shared/interfaces/logger.interface';
import { UnifiedAuthenticationMiddleware } from './unified-authentication.middleware';
import { EnhancedRateLimiterMiddleware } from './enhanced-rate-limiter.middleware';
import { ComprehensiveLoggingMiddleware } from './comprehensive-logging.middleware';
import {
  ComprehensiveSecurityMiddleware,
  defaultSecurityConfig,
} from './comprehensive-security.middleware';
import {
  EnhancedErrorHandler,
  setupProcessErrorHandlers,
} from './enhanced-error.middleware';
import {
  validate,
  sanitizeInput,
  validateContentType,
} from './zod-validation.middleware';

export interface MiddlewareStackConfig {
  security?: {
    cors?: {
      origins: string[];
      methods: string[];
      headers: string[];
      credentials: boolean;
    };
    rateLimiting?: {
      global?: { windowMs: number; maxRequests: number };
      perUser?: { windowMs: number; maxRequests: number };
      perIP?: { windowMs: number; maxRequests: number };
    };
    requestSizeLimit?: number;
  };
  authentication?: {
    jwtSecret: string;
    jwtRefreshSecret: string;
    accessTokenExpiry?: string;
    refreshTokenExpiry?: string;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enablePerformanceLogging?: boolean;
    enableSecurityLogging?: boolean;
    enableUserActivityLogging?: boolean;
  };
}

export class MiddlewareStack {
  private readonly logger: ILogger;
  private readonly config: MiddlewareStackConfig;
  private readonly auth: UnifiedAuthenticationMiddleware;
  private readonly rateLimiter: EnhancedRateLimiterMiddleware;
  private readonly logging: ComprehensiveLoggingMiddleware;
  private readonly security: ComprehensiveSecurityMiddleware;
  private readonly errorHandler: EnhancedErrorHandler;

  constructor(logger: ILogger, config: MiddlewareStackConfig) {
    this.logger = logger;
    this.config = config;

    // Initialize middleware components
    this.auth = new UnifiedAuthenticationMiddleware(
      logger,
      config.authentication?.jwtSecret ||
        process.env.JWT_SECRET ||
        'default-secret',
      config.authentication?.jwtRefreshSecret ||
        process.env.JWT_REFRESH_SECRET ||
        'default-refresh-secret'
    );

    this.rateLimiter = new EnhancedRateLimiterMiddleware(logger, {
      global: config.security?.rateLimiting?.global,
      perUser: config.security?.rateLimiting?.perUser || {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,
      },
      perIP: config.security?.rateLimiting?.perIP || {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 200,
      },
    });

    this.logging = new ComprehensiveLoggingMiddleware(logger);

    this.security = new ComprehensiveSecurityMiddleware(logger, {
      ...defaultSecurityConfig,
      cors: config.security?.cors || defaultSecurityConfig.cors,
    });

    this.errorHandler = new EnhancedErrorHandler(logger);

    // Setup process error handlers
    setupProcessErrorHandlers(logger);
  }

  /**
   * Apply the complete middleware stack to an Express app
   */
  public applyToApp(app: Express): void {
    // 1. Security headers (applied first)
    app.use(this.security.securityHeaders());
    app.use(this.security.cors());
    app.use(this.security.apiSecurityHeaders());

    // 2. Request parsing and validation
    app.use(
      express.json({ limit: this.config.security?.requestSizeLimit || '10mb' })
    );
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(
      validateContentType([
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
      ])
    );

    // 3. Security protection middleware
    app.use(
      this.security.requestSizeLimit(this.config.security?.requestSizeLimit)
    );
    app.use(this.security.ipFilter());
    app.use(this.security.userAgentFilter());
    app.use(this.security.sqlInjectionProtection());
    app.use(this.security.xssProtection());
    app.use(this.security.pathTraversalProtection());
    app.use(this.security.requestTimeout());

    // 4. Input sanitization
    app.use(sanitizeInput());

    // 5. Logging middleware
    app.use(this.logging.logRequests());
    if (this.config.logging?.enablePerformanceLogging) {
      app.use(this.logging.logPerformance());
    }
    if (this.config.logging?.enableSecurityLogging) {
      app.use(this.logging.logSecurityEvents());
    }
    if (this.config.logging?.enableUserActivityLogging) {
      app.use(this.logging.logUserActivity());
    }

    // 6. Rate limiting
    if (this.config.security?.rateLimiting?.global) {
      app.use(this.rateLimiter.globalRateLimit());
    }
    app.use(this.rateLimiter.perIPRateLimit());
    app.use(this.rateLimiter.burstProtection());

    // 7. Health check endpoint (before authentication)
    app.get('/health', this.createHealthCheckHandler());
    app.get('/api/health', this.createHealthCheckHandler());

    // 8. Authentication middleware will be applied per route as needed
    // Routes will use: this.auth.authenticate(), this.auth.requireRoles(), etc.

    // 9. Error handling (applied last)
    app.use(this.logging.logErrors());
    app.use(this.errorHandler.handle());
  }

  /**
   * Get authentication middleware for routes
   */
  public getAuthMiddleware() {
    return {
      authenticate: this.auth.authenticate.bind(this.auth),
      optionalAuthenticate: this.auth.optionalAuthenticate.bind(this.auth),
      requireRoles: this.auth.requireRoles.bind(this.auth),
      requirePermissions: this.auth.requirePermissions.bind(this.auth),
      requireWorkspace: this.auth.requireWorkspace.bind(this.auth),
      requireAdmin: this.auth.requireAdmin.bind(this.auth),
      requireManager: this.auth.requireManager.bind(this.auth),
      requireResourceOwnership: this.auth.requireResourceOwnership.bind(
        this.auth
      ),
      requireWorkspaceMember: this.auth.requireWorkspaceMember.bind(this.auth),
      rateLimitByUser: this.auth.rateLimitByUser.bind(this.auth),
      validateSession: this.auth.validateSession.bind(this.auth),
      trackDevice: this.auth.trackDevice.bind(this.auth),
    };
  }

  /**
   * Get rate limiting middleware for routes
   */
  public getRateLimitingMiddleware() {
    return {
      perUser: this.rateLimiter.perUserRateLimit.bind(this.rateLimiter),
      perEndpoint: this.rateLimiter.perEndpointRateLimit.bind(this.rateLimiter),
      perUserPerEndpoint: this.rateLimiter.perUserPerEndpointRateLimit.bind(
        this.rateLimiter
      ),
      auth: this.rateLimiter.authRateLimit.bind(this.rateLimiter),
      apiKey: this.rateLimiter.apiKeyRateLimit.bind(this.rateLimiter),
      burst: this.rateLimiter.burstProtection.bind(this.rateLimiter),
      adaptive: this.rateLimiter.adaptiveRateLimit.bind(this.rateLimiter),
    };
  }

  /**
   * Get validation middleware
   */
  public getValidationMiddleware() {
    return {
      validate,
      sanitizeInput,
      validateContentType,
    };
  }

  /**
   * Get security middleware for specific routes
   */
  public getSecurityMiddleware() {
    return {
      cors: this.security.cors.bind(this.security),
      ipFilter: this.security.ipFilter.bind(this.security),
      userAgentFilter: this.security.userAgentFilter.bind(this.security),
      requestSizeLimit: this.security.requestSizeLimit.bind(this.security),
      sqlInjectionProtection: this.security.sqlInjectionProtection.bind(
        this.security
      ),
      xssProtection: this.security.xssProtection.bind(this.security),
      pathTraversalProtection: this.security.pathTraversalProtection.bind(
        this.security
      ),
      requestTimeout: this.security.requestTimeout.bind(this.security),
      securityHeaders: this.security.securityHeaders.bind(this.security),
      apiSecurityHeaders: this.security.apiSecurityHeaders.bind(this.security),
    };
  }

  /**
   * Create a comprehensive route middleware stack
   */
  public createRouteStack(
    options: {
      auth?: 'required' | 'optional' | 'admin' | 'manager';
      roles?: string[];
      permissions?: string[];
      rateLimit?: 'standard' | 'strict' | 'auth' | 'burst';
      validation?: {
        body?: any;
        params?: any;
        query?: any;
      };
      security?: {
        requireWorkspace?: boolean;
        requireResourceOwnership?: { param: string; resourceType: string };
      };
    } = {}
  ) {
    const middleware: any[] = [];

    // Add rate limiting
    if (options.rateLimit) {
      switch (options.rateLimit) {
        case 'strict':
          middleware.push(this.rateLimiter.perUserRateLimit());
          break;
        case 'auth':
          middleware.push(this.rateLimiter.authRateLimit());
          break;
        case 'burst':
          middleware.push(this.rateLimiter.burstProtection());
          break;
        default:
          middleware.push(this.rateLimiter.perUserRateLimit());
      }
    }

    // Add authentication
    if (options.auth) {
      switch (options.auth) {
        case 'required':
          middleware.push(this.auth.authenticate({ required: true }));
          break;
        case 'optional':
          middleware.push(this.auth.optionalAuthenticate());
          break;
        case 'admin':
          middleware.push(this.auth.requireAdmin());
          break;
        case 'manager':
          middleware.push(this.auth.requireManager());
          break;
      }
    }

    // Add role-based authorization
    if (options.roles) {
      middleware.push(this.auth.requireRoles(options.roles));
    }

    // Add permission-based authorization
    if (options.permissions) {
      middleware.push(this.auth.requirePermissions(options.permissions));
    }

    // Add workspace requirements
    if (options.security?.requireWorkspace) {
      middleware.push(this.auth.requireWorkspace());
    }

    // Add resource ownership validation
    if (options.security?.requireResourceOwnership) {
      const { param, resourceType } = options.security.requireResourceOwnership;
      middleware.push(this.auth.requireResourceOwnership(param, resourceType));
    }

    // Add validation
    if (options.validation) {
      middleware.push(validate(options.validation));
    }

    return middleware;
  }

  /**
   * Create health check handler
   */
  private createHealthCheckHandler() {
    return (req: Request, res: Response) => {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: 'healthy', // TODO: Implement actual health checks
          redis: 'healthy',
          external_apis: 'healthy',
        },
      };

      res.status(200).json({
        success: true,
        data: healthStatus,
        timestamp: new Date().toISOString(),
      });
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.rateLimiter.destroy();
  }
}

/**
 * Factory function to create middleware stack
 */
export const createMiddlewareStack = (
  logger: ILogger,
  config: MiddlewareStackConfig
): MiddlewareStack => {
  return new MiddlewareStack(logger, config);
};

/**
 * Default middleware configuration
 */
export const defaultMiddlewareConfig: MiddlewareStackConfig = {
  security: {
    cors: {
      origins: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
    },
    rateLimiting: {
      global: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000,
      },
      perUser: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,
      },
      perIP: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 200,
      },
    },
    requestSizeLimit: 10 * 1024 * 1024, // 10MB
  },
  authentication: {
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
  },
  logging: {
    level: (process.env.LOG_LEVEL as any) || 'info',
    enablePerformanceLogging: process.env.NODE_ENV !== 'production',
    enableSecurityLogging: true,
    enableUserActivityLogging: true,
  },
};
