import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { Container } from '../../shared/container/Container';
import { appRouter } from '../../api';
import { createContext } from '../../trpc/context';

export async function setupTRPCRoutes(
  app: FastifyInstance,
  container: Container
): Promise<void> {
  await app.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: ({
        req,
        res,
      }: {
        req: FastifyRequest;
        res: FastifyReply;
      }) => createContext({ req, res, container }),
      onError: ({ path, error, type, ctx }) => {
        console.error(
          `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`
        );

        // Log additional context for debugging
        if (ctx?.user) {
          console.error(`User: ${ctx.user.id}`);
        }

        // You can add custom error reporting here
        // For example, send to monitoring service
      },
    },
  });

  // Health check endpoint for tRPC
  app.get('/api/trpc/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}

