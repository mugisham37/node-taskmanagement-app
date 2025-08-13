import { FastifyInstance } from 'fastify';
import { DIContainer } from '../../shared/container';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { WebSocketHandler } from './websocket-handler';

/**
 * Setup WebSocket functionality for the Fastify application
 */
export async function setupWebSocket(
  app: FastifyInstance,
  container: DIContainer
): Promise<void> {
  // Get logging service from container
  const loggingService = container.resolve('LOGGING_SERVICE') as LoggingService;

  try {
    // Register WebSocket plugin
    await app.register(require('@fastify/websocket'));

    // Create simplified WebSocket handler
    const webSocketHandler = new WebSocketHandler(
      loggingService,
      {} as any, // JWTService - will be properly injected later
      {} as any, // WebSocketService - will be properly injected later  
      {} as any  // RealtimeEventService - will be properly injected later
    );

    // Initialize the WebSocket handler
    await webSocketHandler.initialize(app);

    loggingService.info('WebSocket setup completed successfully');
  } catch (error) {
    loggingService.error('Failed to setup WebSocket', error as Error);
    throw error;
  }
}
