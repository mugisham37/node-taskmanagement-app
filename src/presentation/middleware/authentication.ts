import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '@/infrastructure/logging/logger';

// Placeholder authentication middleware - will be implemented in later tasks
async function authenticationMiddleware(
  fastify: FastifyInstance
): Promise<void> {
  // Register authentication decorator
  fastify.decorate('authenticate', async function(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        await reply.status(401).send({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication token required',
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
          },
        });
        return;
      }

      const token = authHeader.substring(7);
      
      // TODO: Implement JWT token validation in authentication domain
      // For now, we'll create a placeholder user
      if (token === 'placeholder-token') {
        request.user = {
          id: 'placeholder-user-id',
          email: 'placeholder@example.com',
          workspaceId: 'placeholder-workspace-id',
          roles: ['user'],
          permissions: ['read', 'write'],
        };
      } else {
        await reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid authentication token',
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
          },
        });
        return;
      }
    } catch (error) {
      logger.error('Authentication error:', error);
      await reply.status(500).send({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication service error',
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
        },
      });
    }
  });

  // Register authorization decorator
  fastify.decorate('authorize', function(
    requiredPermissions: string[] = [],
    requiredRoles: string[] = []
  ) {
    return async function(
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> {
      if (!request.user) {
        await reply.status(401).send({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
          },
        });
        return;
      }

      // Check required roles
      if (requiredRoles.length > 0) {
        const hasRequiredRole = requiredRoles.some(role => 
          request.user?.roles.includes(role)
        );
        
        if (!hasRequiredRole) {
          await reply.status(403).send({
            success: false,
            error: {
              code: 'INSUFFICIENT_ROLE',
              message: 'Insufficient role permissions',
              timestamp: new Date().toISOString(),
              path: request.url,
              method: request.method,
            },
          });
          return;
        }
      }

      // Check required permissions
      if (requiredPermissions.length > 0) {
        const hasRequiredPermission = requiredPermissions.some(permission => 
          request.user?.permissions.includes(permission)
        );
        
        if (!hasRequiredPermission) {
          await reply.status(403).send({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: 'Insufficient permissions',
              timestamp: new Date().toISOString(),
              path: request.url,
              method: request.method,
            },
          });
          return;
        }
      }
    };
  });
}

export default fp(authenticationMiddleware);

// Extend Fastify instance interface
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    
    authorize: (
      requiredPermissions?: string[],
      requiredRoles?: string[]
    ) => (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}