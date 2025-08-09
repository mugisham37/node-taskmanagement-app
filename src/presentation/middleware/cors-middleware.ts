import { FastifyRequest, FastifyReply } from 'fastify';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

export interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

export class CorsMiddleware {
  private readonly defaultOptions: Required<CorsOptions> = {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Request-ID',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };

  constructor(
    private readonly logger: LoggingService,
    private readonly options: CorsOptions = {}
  ) {}

  handle = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const origin = request.headers.origin;
    const requestMethod = request.method;
    const requestHeaders = request.headers['access-control-request-headers'];

    // Merge options with defaults
    const config = { ...this.defaultOptions, ...this.options };

    // Handle origin
    const allowedOrigin = this.getAllowedOrigin(origin, config.origin);
    if (allowedOrigin !== null) {
      reply.header('Access-Control-Allow-Origin', allowedOrigin);
    }

    // Handle credentials
    if (config.credentials) {
      reply.header('Access-Control-Allow-Credentials', 'true');
    }

    // Handle exposed headers
    if (config.exposedHeaders.length > 0) {
      reply.header(
        'Access-Control-Expose-Headers',
        config.exposedHeaders.join(', ')
      );
    }

    // Handle preflight requests
    if (requestMethod === 'OPTIONS') {
      // Handle methods
      reply.header('Access-Control-Allow-Methods', config.methods.join(', '));

      // Handle headers
      if (requestHeaders) {
        const allowedHeaders = this.getAllowedHeaders(
          requestHeaders,
          config.allowedHeaders
        );
        reply.header('Access-Control-Allow-Headers', allowedHeaders);
      } else {
        reply.header(
          'Access-Control-Allow-Headers',
          config.allowedHeaders.join(', ')
        );
      }

      // Handle max age
      reply.header('Access-Control-Max-Age', config.maxAge.toString());

      // Handle preflight response
      if (!config.preflightContinue) {
        reply.status(config.optionsSuccessStatus).send();
        return;
      }
    }

    this.logger.debug('CORS headers set', {
      origin,
      method: requestMethod,
      allowedOrigin,
      credentials: config.credentials,
    });
  };

  private getAllowedOrigin(
    origin: string | undefined,
    allowedOrigin: string | string[] | boolean | ((origin: string) => boolean)
  ): string | null {
    if (!origin) {
      return allowedOrigin === true ? '*' : null;
    }

    if (allowedOrigin === true) {
      return origin;
    }

    if (allowedOrigin === false) {
      return null;
    }

    if (typeof allowedOrigin === 'string') {
      return allowedOrigin === origin ? origin : null;
    }

    if (Array.isArray(allowedOrigin)) {
      return allowedOrigin.includes(origin) ? origin : null;
    }

    if (typeof allowedOrigin === 'function') {
      return allowedOrigin(origin) ? origin : null;
    }

    return null;
  }

  private getAllowedHeaders(
    requestHeaders: string,
    allowedHeaders: string[]
  ): string {
    const requested = requestHeaders
      .split(',')
      .map(h => h.trim().toLowerCase());
    const allowed = allowedHeaders.map(h => h.toLowerCase());

    const validHeaders = requested.filter(
      header => allowed.includes(header) || header.startsWith('x-')
    );

    return validHeaders.length > 0
      ? validHeaders.join(', ')
      : allowedHeaders.join(', ');
  }

  // Predefined CORS configurations
  static readonly DEVELOPMENT: CorsOptions = {
    origin: true,
    credentials: true,
  };

  static readonly PRODUCTION: CorsOptions = {
    origin: (origin: string) => {
      // Add your production domains here
      const allowedDomains = [
        'https://yourdomain.com',
        'https://www.yourdomain.com',
        'https://app.yourdomain.com',
      ];
      return allowedDomains.includes(origin);
    },
    credentials: true,
  };

  static readonly STRICT: CorsOptions = {
    origin: false,
    credentials: false,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
