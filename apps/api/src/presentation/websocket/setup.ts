import { FastifyInstance } from 'fastify';
import { Container } from '../../shared/container';
import { LoggingService } from '@taskmanagement/observability';
import { WebSocketHandler } from './websocket-handler';
import { RealtimeManager, AuthenticatedWebSocket } from './realtime-manager';

/**
 * Setup WebSocket functionality for the Fastify application
 */
export async function setupWebSocket(
  app: FastifyInstance,
  container: Container
): Promise<void> {
  // Get logging service from container
  const loggingService = container.resolve('LOGGING_SERVICE') as LoggingService;

  try {
    // Register WebSocket plugin
    await app.register(require('@fastify/websocket'));

    // Create realtime manager
    const realtimeManager = new RealtimeManager(container);

    // Setup WebSocket route with realtime manager
    app.register(async function (fastify) {
      fastify.get('/ws', { websocket: true }, (connection, request) => {
        const ws = connection.socket as AuthenticatedWebSocket;
        realtimeManager.handleConnection(ws, request);
      });
    });

    // Make realtime manager available to the container for other services
    container.register('RealtimeManager', realtimeManager);

    // Create simplified WebSocket handler for backward compatibility
    const webSocketHandler = new WebSocketHandler(
      loggingService,
      {} as any, // JWTService - will be properly injected later
      {} as any, // WebSocketService - will be properly injected later
      {} as any // RealtimeEventService - will be properly injected later
    );

    // Initialize the WebSocket handler
    await webSocketHandler.initialize(app);

    loggingService.info('WebSocket setup completed successfully');
  } catch (error) {
    loggingService.error('Failed to setup WebSocket', error as Error);
    throw error;
  }
}

