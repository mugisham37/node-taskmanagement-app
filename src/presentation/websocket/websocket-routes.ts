import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocketHandler } from './websocket-handler';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

export interface WebSocketRouteOptions {
  webSocketHandler: WebSocketHandler;
  logger: LoggingService;
}

export async function registerWebSocketRoutes(
  fastify: FastifyInstance,
  options: WebSocketRouteOptions
): Promise<void> {
  const { webSocketHandler, logger } = options;

  // Main WebSocket endpoint
  fastify.register(async function (fastify) {
    await fastify.register(require('@fastify/websocket'));

    fastify.get('/ws', { websocket: true }, async (connection, request) => {
      logger.info('WebSocket connection attempt', {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        query: request.query,
      });

      await webSocketHandler.handleConnection(connection, request);
    });

    // WebSocket health check endpoint
    fastify.get('/ws/health', async (request, reply) => {
      const stats = webSocketHandler.getConnectionStats();

      reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connections: stats,
      });
    });

    // Get connected users endpoint
    fastify.get('/ws/users', async (request, reply) => {
      const connectedUsers = webSocketHandler.getConnectedUsers();

      reply.send({
        users: connectedUsers,
        count: connectedUsers.length,
        timestamp: new Date().toISOString(),
      });
    });

    // Get user presence endpoint
    fastify.get('/ws/presence/:userId', async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const presence = webSocketHandler.getUserPresence(userId);

      if (!presence) {
        reply.code(404).send({
          error: 'User not found or offline',
          userId,
        });
        return;
      }

      reply.send({
        presence,
        timestamp: new Date().toISOString(),
      });
    });

    // Broadcast message endpoint (for server-side broadcasting)
    fastify.post('/ws/broadcast', async (request, reply) => {
      const { channel, message, type } = request.body as {
        channel?: string;
        message: any;
        type: 'user' | 'channel' | 'all';
      };

      let recipients = 0;

      switch (type) {
        case 'user':
          if (channel) {
            recipients = webSocketHandler.broadcastToUser(channel, {
              type: 'server_broadcast',
              payload: message,
              timestamp: new Date().toISOString(),
              messageId: `broadcast_${Date.now()}`,
            });
          }
          break;

        case 'channel':
          if (channel) {
            recipients = webSocketHandler.broadcastToChannel(channel, {
              type: 'server_broadcast',
              payload: message,
              timestamp: new Date().toISOString(),
              messageId: `broadcast_${Date.now()}`,
            });
          }
          break;

        case 'all':
          recipients = webSocketHandler.broadcastToAll({
            type: 'server_broadcast',
            payload: message,
            timestamp: new Date().toISOString(),
            messageId: `broadcast_${Date.now()}`,
          });
          break;

        default:
          reply.code(400).send({
            error: 'Invalid broadcast type',
            validTypes: ['user', 'channel', 'all'],
          });
          return;
      }

      reply.send({
        success: true,
        recipients,
        type,
        channel,
        timestamp: new Date().toISOString(),
      });
    });
  });

  logger.info('WebSocket routes registered successfully');
}
