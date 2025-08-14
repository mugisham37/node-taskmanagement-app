import { FastifyInstance } from 'fastify';
import { DIContainer } from '../../shared/container';
import { SERVICE_TOKENS } from '../../shared/container/types';
import { WebSocketGateway } from './websocket-gateway';

/**
 * Setup WebSocket functionality for the Fastify application
 */
export async function setupWebSocket(
  app: FastifyInstance,
  container: DIContainer
): Promise<void> {
  // Register WebSocket plugin
  await app.register(require('@fastify/websocket'));

  // Get WebSocket service from container
  const webSocketService = container.resolve(SERVICE_TOKENS.WEBSOCKET_SERVICE);
  const jwtService = container.resolve(SERVICE_TOKENS.JWT_SERVICE);
  const loggingService = container.resolve(SERVICE_TOKENS.LOGGING_SERVICE);

  // Create WebSocket gateway
  const gateway = new WebSocketGateway(
    webSocketService,
    jwtService,
    loggingService
  );

  // Register WebSocket routes
  app.register(async function (fastify) {
    // Main WebSocket endpoint
    fastify.get('/ws', { websocket: true }, async (connection, request) => {
      try {
        await gateway.handleConnection(connection, request);
      } catch (error) {
        loggingService.error('WebSocket connection error', { error });
        connection.socket.close();
      }
    });

    // Task-specific WebSocket endpoint
    fastify.get(
      '/ws/tasks/:taskId',
      { websocket: true },
      async (connection, request) => {
        try {
          const { taskId } = request.params as { taskId: string };
          await gateway.handleTaskConnection(connection, request, taskId);
        } catch (error) {
          loggingService.error('Task WebSocket connection error', {
            error,
            taskId: (request.params as any).taskId,
          });
          connection.socket.close();
        }
      }
    );

    // Project-specific WebSocket endpoint
    fastify.get(
      '/ws/projects/:projectId',
      { websocket: true },
      async (connection, request) => {
        try {
          const { projectId } = request.params as { projectId: string };
          await gateway.handleProjectConnection(connection, request, projectId);
        } catch (error) {
          loggingService.error('Project WebSocket connection error', {
            error,
            projectId: (request.params as any).projectId,
          });
          connection.socket.close();
        }
      }
    );

    // Workspace-specific WebSocket endpoint
    fastify.get(
      '/ws/workspaces/:workspaceId',
      { websocket: true },
      async (connection, request) => {
        try {
          const { workspaceId } = request.params as { workspaceId: string };
          await gateway.handleWorkspaceConnection(
            connection,
            request,
            workspaceId
          );
        } catch (error) {
          loggingService.error('Workspace WebSocket connection error', {
            error,
            workspaceId: (request.params as any).workspaceId,
          });
          connection.socket.close();
        }
      }
    );
  });

  loggingService.info('WebSocket endpoints registered successfully');
}
