import { FastifyInstance } from 'fastify';
import { ILogger } from '../../shared/types/logger.interface';

/**
 * Base WebSocket gateway providing common functionality
 */
export abstract class BaseWebSocketGateway {
  protected readonly logger: ILogger;
  protected connections: Map<string, any> = new Map();

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  /**
   * Initialize WebSocket server
   */
  abstract initialize(server: FastifyInstance): Promise<void>;

  /**
   * Handle new connection
   */
  protected handleConnection(connection: any, request: any): void {
    const connectionId = this.generateConnectionId();
    this.connections.set(connectionId, connection);

    this.logger.info('WebSocket connection established', {
      connectionId,
      ip: request.socket.remoteAddress,
    });

    connection.on('close', () => {
      this.connections.delete(connectionId);
      this.logger.info('WebSocket connection closed', { connectionId });
    });

    connection.on('error', (error: Error) => {
      this.logger.error('WebSocket connection error', {
        connectionId,
        error: error.message,
      });
    });
  }

  /**
   * Broadcast message to all connections
   */
  protected broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    this.connections.forEach((connection, connectionId) => {
      try {
        connection.send(messageStr);
      } catch (error) {
        this.logger.error('Failed to send message to connection', {
          connectionId,
          error,
        });
        this.connections.delete(connectionId);
      }
    });
  }

  /**
   * Send message to specific connection
   */
  protected sendToConnection(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      try {
        connection.send(JSON.stringify(message));
      } catch (error) {
        this.logger.error('Failed to send message to connection', {
          connectionId,
          error,
        });
        this.connections.delete(connectionId);
      }
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
