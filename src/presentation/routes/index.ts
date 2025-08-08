import { FastifyPluginAsync } from 'fastify';

/**
 * Route module interface for consistent route registration
 */
export interface RouteModule {
  prefix: string;
  routes: FastifyPluginAsync;
}

// Export route modules
export * from './route.types';
