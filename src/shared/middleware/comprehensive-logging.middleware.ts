import { Request, Response, NextFunction } from 'express';
import { ILogger } from '../../shared/interfaces/logger.interface';

export interface RequestLogContext {
  correlationId: string;
  requestId: string;
  method: string;
  url: string;
  path: string;
  query: any;
  params: any;
  headers: Record<string, string>;
  userAgent?: string;
  ip: string;
  userId?: string;
  workspaceId?: string;
  sessionId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
  error?: any;
}

export class ComprehensiveLoggingMiddleware {
  private readonly sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
  ];

  private readonly sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'refreshToken',
    'secret',
    'apiKey',
    'privateKey',
    'accessToken',
    'sessionId',
    'creditCard',
    'ssn',
    'socialSecurityNumber',
  ];

  constructor(private readonly logger: ILogger) {}

  /**
   * Request/Response logging middleware
   */
  logRequests() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const correlationId = this.generateCorrelationId();
      const requestId = this.generateRequestId();

      // Attach IDs to request for use in other middleware
      (req as any).correlationId = correlationId;
      (req as any).requestId = requestId;
      (req as any).startTime = startTime;

      // Set response headers
      res.setHeader('X-Correlation-ID', correlationId);
      res.setHeader('X-Request-ID', requestId);

      const context: RequestLogContext = {
        correlationId,
        requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        path: req.path,
        query: this.sanitizeObject(req.query),
        params: this.sanitizeObject(req.params),
        headers: this.sanitizeHeaders(req.headers as Record<string, string>),
        userAgent: req.get('User-Agent'),
        ip: this.getClientIP(req),
        startTime,
      };

      // Add user context if available
      const user = (req as any).user;
      if (user) {
        context.userId = user.id;
        context.workspaceId = user.currentWorkspaceId;
        context.sessionId = user.sessionId;
      }

      // Log request
      this.logger.info('HTTP Request', {
        type: 'request',
        ...context,
        body: this.shouldLogBody(req)
          ? this.sanitizeObject(req.body)
          : '[BODY_NOT_LOGGED]',
      });

      // Capture response data
      const originalSend = res.send;
      const originalJson = res.json;
      let responseBody: any;
      let responseSize = 0;

      res.send = function (body: any) {
        responseBody = body;
        responseSize = Buffer.byteLength(body || '', 'utf8');
        return originalSend.call(this, body);
      };

      res.json = function (body: any) {
        responseBody = body;
        responseSize = Buffer.byteLength(JSON.stringify(body || {}), 'utf8');
        return originalJson.call(this, body);
      };

      // Log response when finished
      res.on('finish', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        const responseContext: RequestLogContext = {
          ...context,
          endTime,
          duration,
          statusCode: res.statusCode,
          responseSize,
        };

        // Determine log level based on status code
        const logLevel = this.getLogLevel(res.statusCode);

        this.logger[logLevel]('HTTP Response', {
          type: 'response',
          ...responseContext,
          response: this.shouldLogResponse(res)
            ? this.sanitizeObject(responseBody)
            : '[RESPONSE_NOT_LOGGED]',
        });

        // Log slow requests
        if (duration > 1000) {
          this.logger.warn('Slow Request Detected', {
            type: 'performance',
            ...responseContext,
            threshold: 1000,
          });
        }
      });

      // Log errors
      res.on('error', error => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        this.logger.error('HTTP Request Error', {
          type: 'error',
          ...context,
          endTime,
          duration,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        });
      });

      next();
    };
  }

  /**
   * Error logging middleware
   */
  logErrors() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const context = {
        correlationId: (req as any).correlationId,
        requestId: (req as any).requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        path: req.path,
        userId: (req as any).user?.id,
        workspaceId: (req as any).user?.currentWorkspaceId,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent'),
      };

      this.logger.error('Unhandled Request Error', {
        type: 'unhandled_error',
        ...context,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });

      next(error);
    };
  }

  /**
   * Security event logging middleware
   */
  logSecurityEvents() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Log suspicious activities
      const suspiciousPatterns = [
        /\.\.\//, // Path traversal
        /<script/i, // XSS attempts
        /union.*select/i, // SQL injection
        /javascript:/i, // JavaScript injection
        /eval\(/i, // Code injection
        /exec\(/i, // Command injection
      ];

      const requestData = JSON.stringify({
        url: req.url,
        query: req.query,
        body: req.body,
        headers: req.headers,
      });

      const isSuspicious = suspiciousPatterns.some(pattern =>
        pattern.test(requestData)
      );

      if (isSuspicious) {
        this.logger.warn('Suspicious Request Detected', {
          type: 'security_event',
          correlationId: (req as any).correlationId,
          method: req.method,
          url: req.originalUrl || req.url,
          ip: this.getClientIP(req),
          userAgent: req.get('User-Agent'),
          userId: (req as any).user?.id,
          suspiciousContent: this.sanitizeObject({
            query: req.query,
            body: req.body,
          }),
        });
      }

      // Log authentication failures
      res.on('finish', () => {
        if (res.statusCode === 401) {
          this.logger.warn('Authentication Failure', {
            type: 'auth_failure',
            correlationId: (req as any).correlationId,
            method: req.method,
            url: req.originalUrl || req.url,
            ip: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
          });
        }

        if (res.statusCode === 403) {
          this.logger.warn('Authorization Failure', {
            type: 'authz_failure',
            correlationId: (req as any).correlationId,
            method: req.method,
            url: req.originalUrl || req.url,
            ip: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            userId: (req as any).user?.id,
            statusCode: res.statusCode,
          });
        }
      });

      next();
    };
  }

  /**
   * Performance monitoring middleware
   */
  logPerformance() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();

      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        const performanceData = {
          type: 'performance',
          correlationId: (req as any).correlationId,
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          duration,
          memory: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            external: endMemory.external - startMemory.external,
            rss: endMemory.rss - startMemory.rss,
          },
        };

        // Log performance metrics
        if (duration > 5000) {
          // 5 seconds
          this.logger.error('Very Slow Request', performanceData);
        } else if (duration > 1000) {
          // 1 second
          this.logger.warn('Slow Request', performanceData);
        } else {
          this.logger.debug('Request Performance', performanceData);
        }
      });

      next();
    };
  }

  /**
   * User activity logging middleware
   */
  logUserActivity() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;

      if (user && req.method !== 'GET') {
        res.on('finish', () => {
          if (res.statusCode < 400) {
            this.logger.info('User Activity', {
              type: 'user_activity',
              correlationId: (req as any).correlationId,
              userId: user.id,
              workspaceId: user.currentWorkspaceId,
              action: `${req.method} ${req.path}`,
              resource: this.extractResourceFromPath(req.path),
              resourceId: req.params.id,
              ip: this.getClientIP(req),
              userAgent: req.get('User-Agent'),
              timestamp: new Date().toISOString(),
            });
          }
        });
      }

      next();
    };
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

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

  private sanitizeHeaders(
    headers: Record<string, string>
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (this.sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (
        this.sensitiveFields.some(field =>
          key.toLowerCase().includes(field.toLowerCase())
        )
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private shouldLogBody(req: Request): boolean {
    // Don't log body for certain content types or large payloads
    const contentType = req.get('Content-Type') || '';
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);

    if (
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/octet-stream') ||
      contentLength > 10000
    ) {
      // 10KB limit
      return false;
    }

    return true;
  }

  private shouldLogResponse(res: Response): boolean {
    // Don't log response for certain content types or large responses
    const contentType = res.get('Content-Type') || '';
    const contentLength = parseInt(res.get('Content-Length') || '0', 10);

    if (
      contentType.includes('image/') ||
      contentType.includes('video/') ||
      contentType.includes('audio/') ||
      contentType.includes('application/octet-stream') ||
      contentLength > 10000
    ) {
      // 10KB limit
      return false;
    }

    return true;
  }

  private getLogLevel(statusCode: number): 'debug' | 'info' | 'warn' | 'error' {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    if (statusCode >= 300) return 'info';
    return 'debug';
  }

  private extractResourceFromPath(path: string): string {
    // Extract resource type from path (e.g., /api/v1/tasks/123 -> tasks)
    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 3 && segments[0] === 'api') {
      return segments[2];
    }
    return segments[0] || 'unknown';
  }
}
