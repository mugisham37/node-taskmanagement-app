import { FastifyRequest, FastifyReply } from 'fastify';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { ValidationError } from '../../shared/errors/validation-error';

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
  ipWhitelist?: string[];
  ipBlacklist?: string[];
  userAgentBlacklist?: RegExp[];
}

export class ComprehensiveSecurityMiddleware {
  constructor(
    private readonly logger: LoggingService,
    private readonly config: SecurityConfig
  ) {}

  /**
   * Apply comprehensive security headers
   */
  securityHeaders() {
    return async (
      _req: FastifyRequest,
      reply: FastifyReply,
      next?: () => void
    ) => {
      // Content Security Policy
      if (this.config.csp) {
        const cspDirectives = Object.entries(this.config.csp.directives)
          .map(([key, values]) => `${key} ${values.join(' ')}`)
          .join('; ');

        const headerName = this.config.csp.reportOnly
          ? 'Content-Security-Policy-Report-Only'
          : 'Content-Security-Policy';

        reply.header(headerName, cspDirectives);
      }

      // HTTP Strict Transport Security
      if (this.config.hsts) {
        const hstsValue = [
          `max-age=${this.config.hsts.maxAge}`,
          this.config.hsts.includeSubDomains ? 'includeSubDomains' : '',
          this.config.hsts.preload ? 'preload' : '',
        ]
          .filter(Boolean)
          .join('; ');

        reply.header('Strict-Transport-Security', hstsValue);
      }

      // Security headers
      reply.headers({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'X-DNS-Prefetch-Control': 'off',
        'Permissions-Policy':
          'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
      });

      // Remove server information
      reply.removeHeader('X-Powered-By');
      reply.removeHeader('Server');

      if (next) next();
    };
  }

  /**
   * CORS middleware with enhanced configuration
   */
  cors() {
    return async (
      req: FastifyRequest,
      reply: FastifyReply,
      next?: () => void
    ) => {
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
        reply.header('Access-Control-Allow-Origin', origin || '*');
      }

      // Set other CORS headers
      reply.headers({
        'Access-Control-Allow-Methods': corsConfig.methods.join(', '),
        'Access-Control-Allow-Headers': corsConfig.headers.join(', '),
      });

      if (corsConfig.credentials) {
        reply.header('Access-Control-Allow-Credentials', 'true');
      }

      if (corsConfig.maxAge) {
        reply.header('Access-Control-Max-Age', corsConfig.maxAge.toString());
      }

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return reply.status(200).send();
      }

      if (next) next();
    };
  }

  /**
   * IP filtering middleware
   */
  ipFilter() {
    return async (
      req: FastifyRequest,
      _reply: FastifyReply,
      next?: () => void
    ) => {
      const clientIP = this.getClientIP(req);

      // Check IP blacklist
      if (
        this.config.ipBlacklist &&
        this.config.ipBlacklist.includes(clientIP)
      ) {
        this.logger.warn('Blocked request from blacklisted IP', {
          ip: clientIP,
          userAgent: req.headers['user-agent'],
          url: req.url,
        });

        throw new AuthorizationError('Access denied - IP blocked');
      }

      // Check IP whitelist (if configured)
      if (this.config.ipWhitelist && this.config.ipWhitelist.length > 0) {
        if (!this.config.ipWhitelist.includes(clientIP)) {
          this.logger.warn('Blocked request from non-whitelisted IP', {
            ip: clientIP,
            userAgent: req.headers['user-agent'],
            url: req.url,
          });

          throw new AuthorizationError('Access denied - IP not whitelisted');
        }
      }

      if (next) next();
    };
  }

  /**
   * User-Agent filtering middleware
   */
  userAgentFilter() {
    return async (
      req: FastifyRequest,
      _reply: FastifyReply,
      next?: () => void
    ) => {
      const userAgent = req.headers['user-agent'] || '';

      // Check against blacklisted user agents
      if (this.config.userAgentBlacklist) {
        const isBlocked = this.config.userAgentBlacklist.some(pattern =>
          pattern.test(userAgent)
        );

        if (isBlocked) {
          this.logger.warn('Blocked request from blacklisted User-Agent', {
            userAgent,
            ip: this.getClientIP(req),
            url: req.url,
          });

          throw new AuthorizationError('Access denied - User agent blocked');
        }
      }

      if (next) next();
    };
  }

  /**
   * Request size limiting middleware
   */
  requestSizeLimit(maxSize: number = 10 * 1024 * 1024) {
    // 10MB default
    return async (
      req: FastifyRequest,
      _reply: FastifyReply,
      next?: () => void
    ) => {
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);

      if (contentLength > maxSize) {
        this.logger.warn('Request size limit exceeded', {
          contentLength,
          maxSize,
          ip: this.getClientIP(req),
          url: req.url,
        });

        throw new ValidationError(
          [{ field: 'request', message: 'Request entity too large', value: undefined }],
          'Request entity too large'
        );
      }

      if (next) next();
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

    return async (
      req: FastifyRequest,
      _reply: FastifyReply,
      next?: () => void
    ) => {
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
          userAgent: req.headers['user-agent'],
          url: req.url,
          method: req.method,
          suspiciousData: requestData,
        });

        throw new ValidationError(
          [{ field: 'request', message: 'Invalid request data', value: undefined }],
          'Invalid request data'
        );
      }

      if (next) next();
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

    return async (
      req: FastifyRequest,
      _reply: FastifyReply,
      next?: () => void
    ) => {
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
          userAgent: req.headers['user-agent'],
          url: req.url,
          method: req.method,
          suspiciousData: requestData,
        });

        throw new ValidationError(
          [{ field: 'request', message: 'Invalid request data - XSS detected', value: undefined }],
          'Invalid request data'
        );
      }

      if (next) next();
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

    return async (
      req: FastifyRequest,
      _reply: FastifyReply,
      next?: () => void
    ) => {
      const checkForPathTraversal = (str: string): boolean => {
        return pathTraversalPatterns.some(pattern => pattern.test(str));
      };

      const urlPath = req.url;
      const queryString = JSON.stringify(req.query);
      const bodyString = JSON.stringify(req.body);

      if (
        checkForPathTraversal(urlPath) ||
        checkForPathTraversal(queryString) ||
        checkForPathTraversal(bodyString)
      ) {
        this.logger.warn('Path traversal attempt detected', {
          ip: this.getClientIP(req),
          userAgent: req.headers['user-agent'],
          url: req.url,
          method: req.method,
        });

        throw new ValidationError(
          [{ field: 'path', message: 'Invalid request path', value: undefined }],
          'Invalid request path'
        );
      }

      if (next) next();
    };
  }

  /**
   * Request timeout middleware
   */
  requestTimeout(timeoutMs: number = 30000) {
    return async (
      req: FastifyRequest,
      reply: FastifyReply,
      next?: () => void
    ) => {
      const timeout = setTimeout(() => {
        if (!reply.sent) {
          this.logger.warn('Request timeout', {
            ip: this.getClientIP(req),
            url: req.url,
            method: req.method,
            timeout: timeoutMs,
          });

          reply.status(408).send({
            success: false,
            error: {
              message: 'Request timeout',
              code: 'REQUEST_TIMEOUT',
            },
            timestamp: new Date().toISOString(),
          });
        }
      }, timeoutMs);

      reply.raw.on('finish', () => clearTimeout(timeout));
      reply.raw.on('close', () => clearTimeout(timeout));

      if (next) next();
    };
  }

  /**
   * API security headers for responses
   */
  apiSecurityHeaders() {
    return async (
      _req: FastifyRequest,
      reply: FastifyReply,
      next?: () => void
    ) => {
      // Prevent caching of sensitive data
      reply.headers({
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store',
      });

      // Additional security headers
      reply.headers({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      });

      // Remove server information
      reply.removeHeader('X-Powered-By');
      reply.removeHeader('Server');

      if (next) next();
    };
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: FastifyRequest): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
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
    origins: process.env['ALLOWED_ORIGINS']?.split(',') || [
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
    credentials: true,
    maxAge: 86400, // 24 hours
  },
  csp: {
    directives: {
      'default-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'script-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'"],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
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
