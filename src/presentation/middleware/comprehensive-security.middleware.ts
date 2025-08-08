import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { ILogger } from '../../shared/interfaces/logger.interface';

export interface SecurityConfig {
  cors?: {
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
    maxAge?: number;
  };
  csp?: {
    directives: Record<string, string[]>;
    reportOnly?: boolean;
  };
  hsts?: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  ipWhitelist?: string[];
  ipBlacklist?: string[];
  userAgentBlacklist?: RegExp[];
}

export class ComprehensiveSecurityMiddleware {
  constructor(
    private readonly logger: ILogger,
    private readonly config: SecurityConfig
  ) {}

  /**
   * Apply all security headers using Helmet
   */
  securityHeaders() {
    return helmet({
      // Content Security Policy
      contentSecurityPolicy: this.config.csp
        ? {
            directives: this.config.csp.directives,
            reportOnly: this.config.csp.reportOnly || false,
          }
        : {
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
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          },

      // HTTP Strict Transport Security
      hsts: this.config.hsts || {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },

      // X-Frame-Options
      frameguard: { action: 'deny' },

      // X-Content-Type-Options
      noSniff: true,

      // X-XSS-Protection
      xssFilter: true,

      // Referrer Policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

      // X-Permitted-Cross-Domain-Policies
      permittedCrossDomainPolicies: false,

      // X-DNS-Prefetch-Control
      dnsPrefetchControl: { allow: false },

      // Expect-CT
      expectCt: {
        maxAge: 86400,
        enforce: true,
      },

      // Feature Policy / Permissions Policy
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        accelerometer: [],
      },
    });
  }

  /**
   * CORS middleware with enhanced configuration
   */
  cors() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      const corsConfig = this.config.cors || {
        origins: ['*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true,
      };

      // Check if origin is allowed
      if (
        corsConfig.origins.includes('*') ||
        (origin && corsConfig.origins.includes(origin))
      ) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      }

      // Set other CORS headers
      res.setHeader(
        'Access-Control-Allow-Methods',
        corsConfig.methods.join(', ')
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        corsConfig.headers.join(', ')
      );

      if (corsConfig.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      if (corsConfig.maxAge) {
        res.setHeader('Access-Control-Max-Age', corsConfig.maxAge.toString());
      }

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      next();
    };
  }

  /**
   * IP filtering middleware
   */
  ipFilter() {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = this.getClientIP(req);

      // Check IP blacklist
      if (
        this.config.ipBlacklist &&
        this.config.ipBlacklist.includes(clientIP)
      ) {
        this.logger.warn('Blocked request from blacklisted IP', {
          ip: clientIP,
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
        });

        return res.status(403).json({
          success: false,
          error: {
            message: 'Access denied',
            code: 'IP_BLOCKED',
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Check IP whitelist (if configured)
      if (this.config.ipWhitelist && this.config.ipWhitelist.length > 0) {
        if (!this.config.ipWhitelist.includes(clientIP)) {
          this.logger.warn('Blocked request from non-whitelisted IP', {
            ip: clientIP,
            userAgent: req.get('User-Agent'),
            url: req.originalUrl,
          });

          return res.status(403).json({
            success: false,
            error: {
              message: 'Access denied',
              code: 'IP_NOT_WHITELISTED',
            },
            timestamp: new Date().toISOString(),
          });
        }
      }

      next();
    };
  }

  /**
   * User-Agent filtering middleware
   */
  userAgentFilter() {
    return (req: Request, res: Response, next: NextFunction) => {
      const userAgent = req.get('User-Agent') || '';

      // Check against blacklisted user agents
      if (this.config.userAgentBlacklist) {
        const isBlocked = this.config.userAgentBlacklist.some(pattern =>
          pattern.test(userAgent)
        );

        if (isBlocked) {
          this.logger.warn('Blocked request from blacklisted User-Agent', {
            userAgent,
            ip: this.getClientIP(req),
            url: req.originalUrl,
          });

          return res.status(403).json({
            success: false,
            error: {
              message: 'Access denied',
              code: 'USER_AGENT_BLOCKED',
            },
            timestamp: new Date().toISOString(),
          });
        }
      }

      next();
    };
  }

  /**
   * Request size limiting middleware
   */
  requestSizeLimit(maxSize: number = 10 * 1024 * 1024) {
    // 10MB default
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = parseInt(req.get('Content-Length') || '0', 10);

      if (contentLength > maxSize) {
        this.logger.warn('Request size limit exceeded', {
          contentLength,
          maxSize,
          ip: this.getClientIP(req),
          url: req.originalUrl,
        });

        return res.status(413).json({
          success: false,
          error: {
            message: 'Request entity too large',
            code: 'REQUEST_TOO_LARGE',
            maxSize,
          },
          timestamp: new Date().toISOString(),
        });
      }

      next();
    };
  }

  /**
   * SQL injection detection middleware
   */
  sqlInjectionProtection() {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
      /('|(\\')|(;)|(--)|(\s)|(\/\*)|(\*\/))/gi,
      /(UNION\s+(ALL\s+)?SELECT)/gi,
      /(SELECT\s+.*\s+FROM\s+.*\s+WHERE)/gi,
    ];

    return (req: Request, res: Response, next: NextFunction) => {
      const checkForSQLInjection = (obj: any, path: string = ''): boolean => {
        if (typeof obj === 'string') {
          return sqlPatterns.some(pattern => pattern.test(obj));
        }

        if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            if (checkForSQLInjection(value, `${path}.${key}`)) {
              return true;
            }
          }
        }

        return false;
      };

      const requestData = {
        query: req.query,
        body: req.body,
        params: req.params,
      };

      if (checkForSQLInjection(requestData)) {
        this.logger.warn('Potential SQL injection attempt detected', {
          ip: this.getClientIP(req),
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
          method: req.method,
          suspiciousData: requestData,
        });

        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request data',
            code: 'INVALID_INPUT',
          },
          timestamp: new Date().toISOString(),
        });
      }

      next();
    };
  }

  /**
   * XSS protection middleware
   */
  xssProtection() {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
    ];

    return (req: Request, res: Response, next: NextFunction) => {
      const checkForXSS = (obj: any): boolean => {
        if (typeof obj === 'string') {
          return xssPatterns.some(pattern => pattern.test(obj));
        }

        if (typeof obj === 'object' && obj !== null) {
          for (const value of Object.values(obj)) {
            if (checkForXSS(value)) {
              return true;
            }
          }
        }

        return false;
      };

      const requestData = {
        query: req.query,
        body: req.body,
        params: req.params,
      };

      if (checkForXSS(requestData)) {
        this.logger.warn('Potential XSS attempt detected', {
          ip: this.getClientIP(req),
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
          method: req.method,
          suspiciousData: requestData,
        });

        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request data',
            code: 'INVALID_INPUT',
          },
          timestamp: new Date().toISOString(),
        });
      }

      next();
    };
  }

  /**
   * Path traversal protection middleware
   */
  pathTraversalProtection() {
    const pathTraversalPatterns = [
      /\.\.\//g,
      /\.\.\\/g,
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi,
      /\.\.%2f/gi,
      /\.\.%5c/gi,
    ];

    return (req: Request, res: Response, next: NextFunction) => {
      const checkForPathTraversal = (str: string): boolean => {
        return pathTraversalPatterns.some(pattern => pattern.test(str));
      };

      const urlPath = req.originalUrl || req.url;
      const queryString = JSON.stringify(req.query);
      const bodyString = JSON.stringify(req.body);

      if (
        checkForPathTraversal(urlPath) ||
        checkForPathTraversal(queryString) ||
        checkForPathTraversal(bodyString)
      ) {
        this.logger.warn('Path traversal attempt detected', {
          ip: this.getClientIP(req),
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
          method: req.method,
        });

        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request path',
            code: 'INVALID_PATH',
          },
          timestamp: new Date().toISOString(),
        });
      }

      next();
    };
  }

  /**
   * Request timeout middleware
   */
  requestTimeout(timeoutMs: number = 30000) {
    return (req: Request, res: Response, next: NextFunction) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          this.logger.warn('Request timeout', {
            ip: this.getClientIP(req),
            url: req.originalUrl,
            method: req.method,
            timeout: timeoutMs,
          });

          res.status(408).json({
            success: false,
            error: {
              message: 'Request timeout',
              code: 'REQUEST_TIMEOUT',
            },
            timestamp: new Date().toISOString(),
          });
        }
      }, timeoutMs);

      res.on('finish', () => clearTimeout(timeout));
      res.on('close', () => clearTimeout(timeout));

      next();
    };
  }

  /**
   * Security headers for API responses
   */
  apiSecurityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Prevent caching of sensitive data
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');

      // Additional security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // Remove server information
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');

      next();
    };
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }
}

/**
 * Default security configuration
 */
export const defaultSecurityConfig: SecurityConfig = {
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
    credentials: true,
    maxAge: 86400, // 24 hours
  },
  csp: {
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
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
    reportOnly: false,
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  userAgentBlacklist: [/bot/i, /crawler/i, /spider/i, /scraper/i],
};
