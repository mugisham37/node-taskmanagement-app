import { FastifyPluginAsync } from 'fastify';

/**
 * Standard route module structure
 */
export interface RouteModule {
  prefix: string;
  routes: FastifyPluginAsync;
}

/**
 * Route registration options
 */
export interface RouteOptions {
  prefix?: string;
  middleware?: string[];
  authentication?: boolean;
  rateLimit?: {
    max: number;
    timeWindow: string;
  };
}
