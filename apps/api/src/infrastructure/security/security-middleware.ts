/**
 * Security Middleware
 */

import { SecurityConfig } from './security-config';

export interface SecurityMiddleware {
  name: string;
  middleware: any;
  options?: any;
}

export class SecurityMiddlewareFactory {
  constructor(private config: SecurityConfig) {}

  createCorsMiddleware(): SecurityMiddleware {
    return {
      name: 'cors',
      middleware: '@fastify/cors',
      options: this.config.cors,
    };
  }

  createHelmetMiddleware(): SecurityMiddleware {
    return {
      name: 'helmet',
      middleware: '@fastify/helmet',
      options: this.config.helmet,
    };
  }

  createRateLimitMiddleware(): SecurityMiddleware {
    return {
      name: 'rate-limit',
      middleware: '@fastify/rate-limit',
      options: this.config.rateLimit,
    };
  }

  getAllMiddleware(): SecurityMiddleware[] {
    return [
      this.createCorsMiddleware(),
      this.createHelmetMiddleware(),
      this.createRateLimitMiddleware(),
    ];
  }
}

export function createSecurityMiddleware(config: SecurityConfig): SecurityMiddleware[] {
  const factory = new SecurityMiddlewareFactory(config);
  return factory.getAllMiddleware();
}
