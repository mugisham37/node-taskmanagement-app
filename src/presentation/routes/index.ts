import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth-routes';
import { workspaceRoutes } from './workspace-routes';
import { projectRoutes } from './project-routes';
import { taskRoutes } from './task-routes';
import { healthRoutes } from './health-routes';
import { presenceRoutes } from './presence-routes';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Register health routes (no authentication required)
  await fastify.register(healthRoutes, { prefix: '/health' });

  // Register authentication routes
  await fastify.register(authRoutes, { prefix: '/auth' });

  // Register workspace routes (authentication required)
  await fastify.register(workspaceRoutes, { prefix: '/workspaces' });

  // Register project routes (authentication required)
  await fastify.register(projectRoutes, { prefix: '/projects' });

  // Register task routes (authentication required)
  await fastify.register(taskRoutes, { prefix: '/tasks' });

  // Register presence routes (authentication required)
  await fastify.register(presenceRoutes, { prefix: '/presence' });
}
