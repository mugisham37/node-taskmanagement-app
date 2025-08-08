import { FastifyRequest, FastifyReply } from 'fastify';
import { ServiceLocator, createScope } from '@/infrastructure/ioc';

declare module 'fastify' {
  interface FastifyRequest {
    container: any; // Will be typed as IContainer
  }
}

/**
 * Middleware to create a scoped container for each request
 * This ensures that scoped services are properly isolated per request
 */
export async function iocScopeMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Create a new scope for this request
    const scopedContainer = createScope();

    // Attach the scoped container to the request
    request.container = scopedContainer;

    // Cleanup the scoped container after the request is complete
    reply.addHook('onSend', async () => {
      try {
        await scopedContainer.dispose();
      } catch (error) {
        request.log.warn('Error disposing request scope:', error);
      }
    });
  } catch (error) {
    request.log.error('Error creating request scope:', error);
    throw error;
  }
}

/**
 * Helper function to resolve services from the request scope
 */
export function resolveFromRequest<T>(
  request: FastifyRequest,
  token: string
): T {
  if (!request.container) {
    throw new Error(
      'Request container not available. Ensure iocScopeMiddleware is registered.'
    );
  }

  return request.container.resolve<T>(token);
}

/**
 * Decorator for controller methods to automatically inject services
 */
export function InjectFromRequest(token: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (
      request: FastifyRequest,
      reply: FastifyReply,
      ...args: any[]
    ) {
      try {
        const service = resolveFromRequest(request, token);
        return originalMethod.call(this, request, reply, service, ...args);
      } catch (error) {
        request.log.error(`Error injecting service '${token}':`, error);
        throw error;
      }
    };

    return descriptor;
  };
}
