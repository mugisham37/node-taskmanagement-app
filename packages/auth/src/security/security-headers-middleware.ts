/**
 * Security Headers Middleware
 * 
 * Implements comprehensive security headers and CORS policies
 * for protection against various web vulnerabilities
 */

import { InfrastructureError } from '@taskmanagement/core';
import { FastifyReply, FastifyRequest } from 'fastify';

export interface SecurityHeadersConfig {
  // Content Security Policy
  csp: {
    enabled: boolean;
    directives: {
      defaultSrc: string[];
      scriptSrc: string[];
      styleSrc: string[];
      imgSrc: string[];
      connectSrc: string[];
      fontSrc: string[];
      objectSrc: string[];
      mediaSrc: string[];
      frameSrc: string[];
      childSrc: string[];
      workerSrc: string[];
      manifestSrc: string[];
      baseUri: string[];
      formAction: string[];
      frameAncestors: string[];
      upgradeInsecureRequests: boolean;
      blockAllMixedContent: boolean;
    };
    reportUri?: string;
    reportOnly: boolean;
  };

  // HTTP Strict Transport Security
  hsts: {
    enabled: boolean;
    maxAge: number; // in seconds
    includeSubDomains: boolean;
    preload: boolean;
  };

  // X-Frame-Options
  frameOptions: {
    enabled: boolean;
    policy: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
    allowFrom?: string;
  };

  // X-Content-Type-Options
  contentTypeOptions: {
    enabled: boolean;
    nosniff: boolean;
  };

  // Referrer Policy
  referrerPolicy: {
    enabled: boolean;
    policy: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
  };

  // Permissions Policy (formerly Feature Policy)
  permissionsPolicy: {
    enabled: boolean;
    directives: {
      camera: string[];
      microphone: string[];
      geolocation: string[];
      notifications: string[];
      payment: string[];
      usb: string[];
      bluetooth: string[];
      accelerometer: string[];
      gyroscope: string[];
      magnetometer: string[];
      fullscreen: string[];
      autoplay: string[];
      encryptedMedia: string[];
      pictureInPicture: string[];
    };
  };

  // Cross-Origin Embedder Policy
  coep: {
    enabled: boolean;
    policy: 'unsafe-none' | 'require-corp' | 'credentialless';
  };

  // Cross-Origin Opener Policy
  coop: {
    enabled: boolean;
    policy: 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin';
  };

  // Cross-Origin Resource Policy
  corp: {
    enabled: boolean;
    policy: 'same-site' | 'same-origin' | 'cross-origin';
  };

  // Additional security headers
  additional: {
    xXssProtection: boolean;
    xDnsPrefetchControl: boolean;
    xDownloadOptions: boolean;
    xPermittedCrossDomainPolicies: boolean;
  };
}

export interface CORSConfig {
  enabled: boolean;
  origin: string[] | string | boolean | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void);
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number; // in seconds
  preflightContinue: boolean;
  optionsSuccessStatus: number;
  // Dynamic CORS based on request
  dynamic: boolean;
  // Trusted domains for dynamic CORS
  trustedDomains: string[];
  // Environment-specific origins
  origins: {
    development: string[];
    staging: string[];
    production: string[];
  };
}

export class SecurityHeadersMiddleware {
  private readonly defaultSecurityConfig: SecurityHeadersConfig = {
    csp: {
      enabled: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        childSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: true,
        blockAllMixedContent: true,
      },
      reportOnly: false,
    },
    hsts: {
      enabled: true,
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameOptions: {
      enabled: true,
      policy: 'DENY',
    },
    contentTypeOptions: {
      enabled: true,
      nosniff: true,
    },
    referrerPolicy: {
      enabled: true,
      policy: 'strict-origin-when-cross-origin',
    },
    permissionsPolicy: {
      enabled: true,
      directives: {
        camera: [],
        microphone: [],
        geolocation: [],
        notifications: ["'self'"],
        payment: [],
        usb: [],
        bluetooth: [],
        accelerometer: [],
        gyroscope: [],
        magnetometer: [],
        fullscreen: ["'self'"],
        autoplay: [],
        encryptedMedia: [],
        pictureInPicture: [],
      },
    },
    coep: {
      enabled: true,
      policy: 'require-corp',
    },
    coop: {
      enabled: true,
      policy: 'same-origin',
    },
    corp: {
      enabled: true,
      policy: 'same-origin',
    },
    additional: {
      xXssProtection: true,
      xDnsPrefetchControl: true,
      xDownloadOptions: true,
      xPermittedCrossDomainPolicies: true,
    },
  };

  private readonly defaultCORSConfig: CORSConfig = {
    enabled: true,
    origin: false, // Disable CORS by default for security
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID',
      'X-Correlation-ID',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
    dynamic: false,
    trustedDomains: [],
    origins: {
      development: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
      staging: [],
      production: [],
    },
  };

  constructor(
    private readonly securityConfig: Partial<SecurityHeadersConfig> = {},
    private readonly corsConfig: Partial<CORSConfig> = {}
  ) {
    this.securityConfig = { ...this.defaultSecurityConfig, ...securityConfig };
    this.corsConfig = { ...this.defaultCORSConfig, ...corsConfig };
  }

  /**
   * Apply security headers middleware
   */
  applySecurityHeaders() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Content Security Policy
        if (this.securityConfig.csp?.enabled) {
          const cspHeader = this.buildCSPHeader();
          const headerName = this.securityConfig.csp.reportOnly 
            ? 'Content-Security-Policy-Report-Only' 
            : 'Content-Security-Policy';
          reply.header(headerName, cspHeader);
        }

        // HTTP Strict Transport Security
        if (this.securityConfig.hsts?.enabled) {
          const hstsValue = this.buildHSTSHeader();
          reply.header('Strict-Transport-Security', hstsValue);
        }

        // X-Frame-Options
        if (this.securityConfig.frameOptions?.enabled) {
          const frameOptionsValue = this.buildFrameOptionsHeader();
          reply.header('X-Frame-Options', frameOptionsValue);
        }

        // X-Content-Type-Options
        if (this.securityConfig.contentTypeOptions?.enabled && this.securityConfig.contentTypeOptions.nosniff) {
          reply.header('X-Content-Type-Options', 'nosniff');
        }

        // Referrer Policy
        if (this.securityConfig.referrerPolicy?.enabled) {
          reply.header('Referrer-Policy', this.securityConfig.referrerPolicy.policy);
        }

        // Permissions Policy
        if (this.securityConfig.permissionsPolicy?.enabled) {
          const permissionsPolicyValue = this.buildPermissionsPolicyHeader();
          reply.header('Permissions-Policy', permissionsPolicyValue);
        }

        // Cross-Origin Embedder Policy
        if (this.securityConfig.coep?.enabled) {
          reply.header('Cross-Origin-Embedder-Policy', this.securityConfig.coep.policy);
        }

        // Cross-Origin Opener Policy
        if (this.securityConfig.coop?.enabled) {
          reply.header('Cross-Origin-Opener-Policy', this.securityConfig.coop.policy);
        }

        // Cross-Origin Resource Policy
        if (this.securityConfig.corp?.enabled) {
          reply.header('Cross-Origin-Resource-Policy', this.securityConfig.corp.policy);
        }

        // Additional security headers
        if (this.securityConfig.additional?.xXssProtection) {
          reply.header('X-XSS-Protection', '1; mode=block');
        }

        if (this.securityConfig.additional?.xDnsPrefetchControl) {
          reply.header('X-DNS-Prefetch-Control', 'off');
        }

        if (this.securityConfig.additional?.xDownloadOptions) {
          reply.header('X-Download-Options', 'noopen');
        }

        if (this.securityConfig.additional?.xPermittedCrossDomainPolicies) {
          reply.header('X-Permitted-Cross-Domain-Policies', 'none');
        }

        // Remove server information
        reply.removeHeader('Server');
        reply.removeHeader('X-Powered-By');

      } catch (error) {
        throw new InfrastructureError(
          `Failed to apply security headers: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    };
  }

  /**
   * Apply CORS middleware
   */
  applyCORS() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!this.corsConfig.enabled) {
        return;
      }

      try {
        const origin = request.headers.origin;
        const method = request.method;

        // Handle preflight requests
        if (method === 'OPTIONS') {
          await this.handlePreflightRequest(request, reply);
          return;
        }

        // Handle actual requests
        await this.handleActualRequest(request, reply, origin);

      } catch (error) {
        throw new InfrastructureError(
          `CORS processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    };
  }

  /**
   * Get environment-specific CORS origins
   */
  getEnvironmentOrigins(): string[] {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
      case 'production':
        return this.corsConfig.origins?.production || [];
      case 'staging':
        return this.corsConfig.origins?.staging || [];
      case 'development':
      default:
        return this.corsConfig.origins?.development || [];
    }
  }

  /**
   * Validate origin against allowed origins
   */
  isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) {
      return false;
    }

    // Check if CORS origin is configured
    if (typeof this.corsConfig.origin === 'boolean') {
      return this.corsConfig.origin;
    }

    if (typeof this.corsConfig.origin === 'string') {
      return this.corsConfig.origin === origin;
    }

    if (Array.isArray(this.corsConfig.origin)) {
      return this.corsConfig.origin.includes(origin);
    }

    // Check environment-specific origins
    const envOrigins = this.getEnvironmentOrigins();
    if (envOrigins.includes(origin)) {
      return true;
    }

    // Check trusted domains for dynamic CORS
    if (this.corsConfig.dynamic && this.corsConfig.trustedDomains) {
      return this.corsConfig.trustedDomains.some(domain => {
        if (domain.startsWith('*.')) {
          const baseDomain = domain.substring(2);
          return origin.endsWith(baseDomain);
        }
        return origin === domain;
      });
    }

    return false;
  }

  // Private helper methods

  private buildCSPHeader(): string {
    const directives = this.securityConfig.csp!.directives;
    const cspParts: string[] = [];

    // Build CSP directives
    Object.entries(directives).forEach(([key, value]) => {
      if (key === 'upgradeInsecureRequests' && value) {
        cspParts.push('upgrade-insecure-requests');
      } else if (key === 'blockAllMixedContent' && value) {
        cspParts.push('block-all-mixed-content');
      } else if (Array.isArray(value) && value.length > 0) {
        const directiveName = this.camelToKebab(key);
        cspParts.push(`${directiveName} ${value.join(' ')}`);
      }
    });

    // Add report URI if configured
    if (this.securityConfig.csp!.reportUri) {
      cspParts.push(`report-uri ${this.securityConfig.csp!.reportUri}`);
    }

    return cspParts.join('; ');
  }

  private buildHSTSHeader(): string {
    const hsts = this.securityConfig.hsts!;
    let hstsValue = `max-age=${hsts.maxAge}`;

    if (hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }

    if (hsts.preload) {
      hstsValue += '; preload';
    }

    return hstsValue;
  }

  private buildFrameOptionsHeader(): string {
    const frameOptions = this.securityConfig.frameOptions!;
    
    if (frameOptions.policy === 'ALLOW-FROM' && frameOptions.allowFrom) {
      return `ALLOW-FROM ${frameOptions.allowFrom}`;
    }

    return frameOptions.policy;
  }

  private buildPermissionsPolicyHeader(): string {
    const directives = this.securityConfig.permissionsPolicy!.directives;
    const policyParts: string[] = [];

    Object.entries(directives).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        const directiveName = this.camelToKebab(key);
        if (value.length === 0) {
          policyParts.push(`${directiveName}=()`);
        } else {
          policyParts.push(`${directiveName}=(${value.join(' ')})`);
        }
      }
    });

    return policyParts.join(', ');
  }

  private async handlePreflightRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const origin = request.headers.origin;
    const requestMethod = request.headers['access-control-request-method'];
    const requestHeaders = request.headers['access-control-request-headers'];

    // Check if origin is allowed
    if (this.isOriginAllowed(origin)) {
      reply.header('Access-Control-Allow-Origin', origin!);
    }

    // Check if method is allowed
    if (requestMethod && this.corsConfig.methods?.includes(requestMethod)) {
      reply.header('Access-Control-Allow-Methods', this.corsConfig.methods.join(', '));
    }

    // Check if headers are allowed
    if (requestHeaders) {
      const requestedHeaders = requestHeaders.split(',').map(h => h.trim());
      const allowedHeaders = requestedHeaders.filter(h => 
        this.corsConfig.allowedHeaders?.includes(h)
      );
      
      if (allowedHeaders.length > 0) {
        reply.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      }
    }

    // Set credentials
    if (this.corsConfig.credentials) {
      reply.header('Access-Control-Allow-Credentials', 'true');
    }

    // Set max age
    if (this.corsConfig.maxAge) {
      reply.header('Access-Control-Max-Age', this.corsConfig.maxAge.toString());
    }

    // Send preflight response
    reply.code(this.corsConfig.optionsSuccessStatus || 204);
    
    if (!this.corsConfig.preflightContinue) {
      reply.send();
    }
  }

  private async handleActualRequest(request: FastifyRequest, reply: FastifyReply, origin?: string): Promise<void> {
    // Check if origin is allowed
    if (this.isOriginAllowed(origin)) {
      reply.header('Access-Control-Allow-Origin', origin!);
    }

    // Set credentials
    if (this.corsConfig.credentials) {
      reply.header('Access-Control-Allow-Credentials', 'true');
    }

    // Set exposed headers
    if (this.corsConfig.exposedHeaders && this.corsConfig.exposedHeaders.length > 0) {
      reply.header('Access-Control-Expose-Headers', this.corsConfig.exposedHeaders.join(', '));
    }
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Get security configuration
   */
  getSecurityConfig(): SecurityHeadersConfig {
    return this.securityConfig as SecurityHeadersConfig;
  }

  /**
   * Get CORS configuration
   */
  getCORSConfig(): CORSConfig {
    return this.corsConfig as CORSConfig;
  }

  /**
   * Update security configuration
   */
  updateSecurityConfig(newConfig: Partial<SecurityHeadersConfig>): void {
    Object.assign(this.securityConfig, newConfig);
  }

  /**
   * Update CORS configuration
   */
  updateCORSConfig(newConfig: Partial<CORSConfig>): void {
    Object.assign(this.corsConfig, newConfig);
  }
}