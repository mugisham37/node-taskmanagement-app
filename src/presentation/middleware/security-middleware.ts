import { FastifyRequest, FastifyReply } from 'fastify';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { InputSanitizer } from '../../infrastructure/security/input-sanitizer';
import {
  AuditLogger,
  AuditContext,
} from '../../infrastructure/security/audit-logger';

export interface SecurityOptions {
  contentSecurityPolicy?: string | false;
  hsts?:
    | {
        maxAge?: number;
        includeSubDomains?: boolean;
        preload?: boolean;
      }
    | false;
  noSniff?: boolean;
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string | false;
  xssProtection?: boolean;
  referrerPolicy?: string | false;
  permissionsPolicy?: string | false;
}

export class SecurityMiddleware {
  private readonly defaultOptions: Required<SecurityOptions> = {
    contentSecurityPolicy:
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameOptions: 'DENY',
    xssProtection: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'camera=(), microphone=(), geolocation=(), payment=()',
  };

  private readonly inputSanitizer: InputSanitizer;
  private readonly auditLogger: AuditLogger;

  constructor(
    private readonly logger: LoggingService,
    private readonly options: SecurityOptions = {}
  ) {
    this.inputSanitizer = new InputSanitizer(logger);
    this.auditLogger = new AuditLogger(logger);
  }

  handle = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const config = { ...this.defaultOptions, ...this.options };
    const auditContext = this.getAuditContext(request);

    // Sanitize input data
    await this.sanitizeRequestData(request, auditContext);

    // Content Security Policy
    if (config.contentSecurityPolicy !== false) {
      reply.header('Content-Security-Policy', config.contentSecurityPolicy);
    }

    // HTTP Strict Transport Security
    if (config.hsts !== false) {
      let hstsValue = `max-age=${config.hsts.maxAge}`;
      if (config.hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (config.hsts.preload) {
        hstsValue += '; preload';
      }
      reply.header('Strict-Transport-Security', hstsValue);
    }

    // X-Content-Type-Options
    if (config.noSniff) {
      reply.header('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options
    if (config.frameOptions !== false) {
      reply.header('X-Frame-Options', config.frameOptions);
    }

    // X-XSS-Protection
    if (config.xssProtection) {
      reply.header('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy
    if (config.referrerPolicy !== false) {
      reply.header('Referrer-Policy', config.referrerPolicy);
    }

    // Permissions-Policy
    if (config.permissionsPolicy !== false) {
      reply.header('Permissions-Policy', config.permissionsPolicy);
    }

    // Additional security headers
    reply.header('X-Powered-By', ''); // Remove X-Powered-By header
    reply.header('Server', ''); // Remove Server header
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Download-Options', 'noopen');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');

    this.logger.debug('Security headers set', {
      url: request.url,
      method: request.method,
      userAgent: request.headers['user-agent'],
    });
  };

  private async sanitizeRequestData(
    request: FastifyRequest,
    auditContext: AuditContext
  ): Promise<void> {
    // Sanitize request body
    if (request.body && typeof request.body === 'object') {
      const bodyResult = this.inputSanitizer.sanitizeObject(request.body);
      if (bodyResult.wasModified) {
        request.body = bodyResult.sanitized;
        this.auditLogger.logEvent({
          eventType: 'INPUT_SANITIZATION' as any,
          severity: 'MEDIUM' as any,
          outcome: 'SUCCESS',
          details: { location: 'request_body' },
          ...auditContext,
        });
      }
    }

    // Sanitize query parameters
    if (request.query && typeof request.query === 'object') {
      const queryResult = this.inputSanitizer.sanitizeObject(request.query);
      if (queryResult.wasModified) {
        request.query = queryResult.sanitized;
        this.auditLogger.logEvent({
          eventType: 'INPUT_SANITIZATION' as any,
          severity: 'MEDIUM' as any,
          outcome: 'SUCCESS',
          details: { location: 'query_parameters' },
          ...auditContext,
        });
      }
    }

    // Sanitize path parameters
    if (request.params && typeof request.params === 'object') {
      const paramsResult = this.inputSanitizer.sanitizeObject(request.params);
      if (paramsResult.wasModified) {
        request.params = paramsResult.sanitized;
        this.auditLogger.logEvent({
          eventType: 'INPUT_SANITIZATION' as any,
          severity: 'MEDIUM' as any,
          outcome: 'SUCCESS',
          details: { location: 'path_parameters' },
          ...auditContext,
        });
      }
    }

    // Check for potential XSS in headers
    this.checkForXSSInHeaders(request, auditContext);
  }

  private checkForXSSInHeaders(
    request: FastifyRequest,
    auditContext: AuditContext
  ): void {
    const suspiciousPatterns = [
      /<script[^>]*>.*?<\/script>/gis,
      /javascript:/gi,
      /vbscript:/gi,
      /onload=/gi,
      /onerror=/gi,
      /onclick=/gi,
    ];

    for (const [headerName, headerValue] of Object.entries(request.headers)) {
      if (typeof headerValue === 'string') {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(headerValue)) {
            this.auditLogger.logXSSAttempt(
              auditContext,
              headerValue,
              `header:${headerName}`
            );
            break;
          }
        }
      }
    }
  }

  private getAuditContext(request: FastifyRequest): AuditContext {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string,
      requestId: request.id,
      userId: (request as any).user?.id,
      sessionId: (request as any).sessionId,
    };
  }

  // Predefined security configurations
  static readonly STRICT: SecurityOptions = {
    contentSecurityPolicy:
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",
    hsts: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true,
    },
    frameOptions: 'DENY',
    referrerPolicy: 'no-referrer',
  };

  static readonly MODERATE: SecurityOptions = {
    contentSecurityPolicy:
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self';",
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: false,
    },
    frameOptions: 'SAMEORIGIN',
  };

  static readonly DEVELOPMENT: SecurityOptions = {
    contentSecurityPolicy: false, // Disable CSP in development
    hsts: false, // Disable HSTS in development
    frameOptions: 'SAMEORIGIN',
  };
}
