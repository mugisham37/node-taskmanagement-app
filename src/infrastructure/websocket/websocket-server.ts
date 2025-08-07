import { FastifyInstance, FastifyRequest } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { logger } from '@/infrastructure/logging/logger';
import { WebSocketConnection } from './websocket-connection';
import { WebSocketConnectionManager } from './websocket-connection-manager';
import { WebSocketAuthenticator } from './websocket-authenticator';
import { WebSocketMessageHandler } from './websocket-message-handler';
import { WebSocketHealthMonitor } from './websocket-health-monitor';
import { WebSocketMetrics } from './websocket-metrics';

export interface WebSocketServerConfig {
  heartbeatInterval: number;
  connectionTimeout: number;
  maxConnections: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export class WebSocketServer {
  private connectionManager: WebSocketConnectionManager;
  private authenticator: WebSocketAuthenticator;
  private messageHandler: WebSocketMessageHandler;
  private healthMonitor: WebSocketHealthMonitor;
  private metrics: WebSocketMetrics;
  private config: WebSocketServerConfig;

  constructor(config: Partial<WebSocketServerConfig> = {}) {
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      connectionTimeout: 60000, // 60 seconds
      maxConnections: 10000,
      enableCompression: true,
      enableMetrics: true,
      ...config,
    };

    this.connectionManager = new WebSocketConnectionManager(this.config);
    this.authenticator = new WebSocketAuthenticator();
    this.messageHandler = new WebSocketMessageHandler(this.connectionManager);
    this.healthMonitor = new WebSocketHealthMonitor(
      this.connectionManager,
      this.config
    );
    this.metrics = new WebSocketMetrics();

    logger.info('WebSocket server initialized', {
      config: this.config,
    });
  }

  /**
   * Register WebSocket routes with Fastify
   */
  async register(fastify: FastifyInstance): Promise<void> {
    // Main WebSocket endpoint with authentication
    fastify.register(async fastify => {
      fastify.get('/ws', { websocket: true }, this.handleConnection.bind(this));
    });

    // WebSocket health endpoint
    fastify.get('/ws/health', async (request, reply) => {
      const health = await this.healthMonitor.getHealthStatus();
      return reply.code(health.healthy ? 200 : 503).send(health);
    });

    // WebSocket metrics endpoint (if enabled)
    if (this.config.enableMetrics) {
      fastify.get('/ws/metrics', async (request, reply) => {
        const metrics = this.metrics.getMetrics();
        return reply.send(metrics);
      });
    }

    // WebSocket connection info endpoint
    fastify.get('/ws/connections', async (request, reply) => {
      // Require admin authentication for this endpoint
      const connectionInfo = this.connectionManager.getConnectionInfo();
      return reply.send(connectionInfo);
    });

    logger.info('WebSocket routes registered successfully');
  }

  /**
   * Handle new WebSocket connections
   */
  private async handleConnection(
    connection: SocketStream,
    request: FastifyRequest
  ): Promise<void> {
    const startTime = Date.now();
    const clientIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'unknown';

    logger.info('New WebSocket connection attempt', {
      ip: clientIp,
      userAgent,
    });

    try {
      // Check connection limits
      if (
        this.connectionManager.getActiveConnectionCount() >=
        this.config.maxConnections
      ) {
        logger.warn('WebSocket connection rejected: max connections reached', {
          ip: clientIp,
          maxConnections: this.config.maxConnections,
        });
        connection.socket.close(1013, 'Server overloaded');
        return;
      }

      // Authenticate the connection
      const authResult = await this.authenticator.authenticate(request);
      if (!authResult.success) {
        logger.warn('WebSocket authentication failed', {
          ip: clientIp,
          reason: authResult.error,
        });
        connection.socket.close(1008, 'Authentication failed');
        return;
      }

      // Create WebSocket connection wrapper
      const wsConnection = new WebSocketConnection(
        connection,
        authResult.user!,
        {
          ip: clientIp,
          userAgent,
          connectedAt: new Date(),
        }
      );

      // Register connection with manager
      await this.connectionManager.addConnection(wsConnection);

      // Set up message handling
      this.setupMessageHandling(wsConnection);

      // Set up connection lifecycle handlers
      this.setupConnectionLifecycle(wsConnection);

      // Start health monitoring for this connection
      this.healthMonitor.monitorConnection(wsConnection);

      // Update metrics
      this.metrics.recordConnectionEstablished(Date.now() - startTime);

      logger.info('WebSocket connection established successfully', {
        userId: authResult.user!.id,
        workspaceId: authResult.user!.workspaceId,
        connectionId: wsConnection.getId(),
        duration: Date.now() - startTime,
      });
    } catch (error) {
      logger.error('Error handling WebSocket connection', {
        error: error instanceof Error ? error.message : String(error),
        ip: clientIp,
        duration: Date.now() - startTime,
      });

      this.metrics.recordConnectionError();
      connection.socket.close(1011, 'Internal server error');
    }
  }

  /**
   * Set up message handling for a connection
   */
  private setupMessageHandling(connection: WebSocketConnection): void {
    connection.onMessage(async message => {
      try {
        await this.messageHandler.handleMessage(connection, message);
        this.metrics.recordMessageReceived();
      } catch (error) {
        logger.error('Error handling WebSocket message', {
          error: error instanceof Error ? error.message : String(error),
          userId: connection.getUser().id,
          connectionId: connection.getId(),
        });
        this.metrics.recordMessageError();
      }
    });
  }

  /**
   * Set up connection lifecycle handlers
   */
  private setupConnectionLifecycle(connection: WebSocketConnection): void {
    connection.onClose(async (code, reason) => {
      logger.info('WebSocket connection closed', {
        userId: connection.getUser().id,
        connectionId: connection.getId(),
        code,
        reason: reason?.toString(),
      });

      await this.connectionManager.removeConnection(connection.getId());
      this.healthMonitor.stopMonitoring(connection.getId());
      this.metrics.recordConnectionClosed();
    });

    connection.onError(error => {
      logger.error('WebSocket connection error', {
        error: error.message,
        userId: connection.getUser().id,
        connectionId: connection.getId(),
      });

      this.metrics.recordConnectionError();
    });

    connection.onPong(() => {
      this.healthMonitor.recordPong(connection.getId());
    });
  }

  /**
   * Broadcast message to all connections in a workspace
   */
  async broadcastToWorkspace(
    workspaceId: string,
    event: string,
    data: any,
    excludeConnectionId?: string
  ): Promise<void> {
    const connections =
      this.connectionManager.getConnectionsByWorkspace(workspaceId);
    const promises = connections
      .filter(conn => conn.getId() !== excludeConnectionId)
      .map(conn => conn.send(event, data));

    await Promise.allSettled(promises);
    this.metrics.recordBroadcast(connections.length);
  }

  /**
   * Broadcast message to all connections in a project
   */
  async broadcastToProject(
    projectId: string,
    event: string,
    data: any,
    excludeConnectionId?: string
  ): Promise<void> {
    const connections =
      this.connectionManager.getConnectionsByProject(projectId);
    const promises = connections
      .filter(conn => conn.getId() !== excludeConnectionId)
      .map(conn => conn.send(event, data));

    await Promise.allSettled(promises);
    this.metrics.recordBroadcast(connections.length);
  }

  /**
   * Send message to specific user
   */
  async sendToUser(userId: string, event: string, data: any): Promise<boolean> {
    const connections = this.connectionManager.getConnectionsByUser(userId);
    if (connections.length === 0) {
      return false;
    }

    const promises = connections.map(conn => conn.send(event, data));
    await Promise.allSettled(promises);
    this.metrics.recordDirectMessage();
    return true;
  }

  /**
   * Get event broadcaster
   */
  getEventBroadcaster() {
    return this.messageHandler.getEventBroadcaster();
  }

  /**
   * Get event aggregator
   */
  getEventAggregator() {
    return this.messageHandler.getEventAggregator();
  }

  /**
   * Get presence tracker
   */
  getPresenceTracker() {
    return this.messageHandler.getPresenceTracker();
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      connections: this.connectionManager.getConnectionInfo(),
      metrics: this.metrics.getMetrics(),
      health: this.healthMonitor.getHealthStatus(),
      config: this.config,
      eventBroadcaster: this.messageHandler.getEventBroadcaster().getMetrics(),
      eventAggregator: this.messageHandler.getEventAggregator().getMetrics(),
      presenceTracker: this.messageHandler.getPresenceTracker().getMetrics(),
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket server...');

    // Stop health monitoring
    this.healthMonitor.stop();

    // Close all connections gracefully
    await this.connectionManager.closeAllConnections(
      1001,
      'Server shutting down'
    );

    logger.info('WebSocket server shutdown complete');
  }
}
