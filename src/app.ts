/**
 * Application configuration and setup
 * Configures the Fastify application with plugins, middleware, and routes
 */

import { FastifyInstance } from 'fastify';

export async function configureApp(fastify: FastifyInstance) {
  // Register plugins and middleware here
  // This will be expanded in later tasks

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}
