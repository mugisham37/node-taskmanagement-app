import { FastifyInstance, FastifyRequest } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { JWTService } from '../../infrastructure/security/jwt-service';
import {
  WebSocketService,
  WebSocketConnection,
} from '../../infrastructure/external-services/websocket-service';
import { RealtimeEventService } from '../../infrastructure/external-services/realtime-event-service';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { nanoid } from 'nanoid';

export interface WebSocketMessage {
  type: string;
  payload?: any;
  data?: any;
  timestamp?: string;
  messageId?: string;
  userId?: string;
  channel?: string;
  projectId?: string;
}

export interface AuthenticatedSocket extends SocketStream {
  userId?: string;
  userEmail?: string;
  connectionId?: string;
}

export interface WebSocketServerConfig {
  heartbeatInterval: number;
  connectionTimeout: number;
  maxConnections: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export interface WebSocketUser {
  id: string;
  email: string;
  name: string;
  workspaceId?: string;
  roles: string[];
}

export interface WebSocketConnectionInfo {
  id: string;
  user: WebSocketUser;
  socket: SocketStream;
  connectedAt: Date;
  lastPingTime: number;
  subscriptions: Set<string>;
  metadata: Record<string, any>;
}

export class WebSocketHandler {
  private connections = new Map<string, WebSocketConnectionInfo>();
  private connectionsByUser = new Map<string, Set<string>>();
  private connectionsByWorkspace = new Map<string, Set<string>>();
  private connectionsByProject = new Map<string, Set<string>>();
  private config: WebSocketServerConfig;
  private cleanupInterval?: NodeJS.Timeout;
  private metrics = {
    totalConnections: 0,
    messagesReceived: 0,
    messagesSent: 0,
    connectionsEstablished: 0,
    connectionsClosed: 0,
    errors: 0,
  };

  constructor(
    private readonly logger: LoggingService,
    private readonly jwtService: JWTService,
    private readonly webSocketService: WebSocketService,
    private readonly realtimeEventService: RealtimeEventService,
    config: Partial<WebSocketServerConfig> = {}
  ) {
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      connectionTimeout: 60000, // 60 seconds
      maxConnections: 10000,
      enableCompression: true,
      enableMetrics: true,
      ...config,
    };
  }

  async initialize(server: FastifyInstance): Promise<void> {
    await server.register(require('@fastify/websocket'));

    // Main WebSocket endpoint
    server.register(async fastify => {
      fastify.get('/ws', { websocket: true }, (connection, request) => {
        this.handleConnection(connection, request);
      });
    });

    // WebSocket health endpoint
    server.get('/ws/health', async (request, reply) => {
      const health = this.getHealthStatus();
      return reply.code(health.healthy ? 200 : 503).send(health);
    });

    // WebSocket metrics endpoint
    if (this.config.enableMetrics) {
      server.get('/ws/metrics', async (request, reply) => {
        const metrics = this.getMetrics();
        return reply.send(metrics);
      });
    }

    // WebSocket connection info endpoint
    server.get('/ws/connections', async (request, reply) => {
      const connectionInfo = this.getConnectionInfo();
      return reply.send(connectionInfo);
    });

    // Start cleanup interval
    this.startCleanupInterval();

    this.logger.info('Enhanced WebSocket handler initialized', {
      config: this.config,
    });
  }

  async handleConnection(
    connection: SocketStream,
    request: FastifyRequest
  ): Promise<void> {
    const startTime = Date.now();
    const clientIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'unknown';

    this.logger.info('New WebSocket connection attempt', {
      ip: clientIp,
      userAgent,
    });

    try {
      // Check connection limits
      if (this.connections.size >= this.config.maxConnections) {
        this.logger.warn(
          'WebSocket connection rejected: max connections reached',
          {
            ip: clientIp,
            maxConnections: this.config.maxConnections,
          }
        );
        connection.socket.close(1013, 'Server overloaded');
        return;
      }

      // Authenticate the connection
      const user = await this.authenticateConnection(request);
      if (!user) {
        this.logger.warn('WebSocket authentication failed', {
          ip: clientIp,
        });
        connection.socket.close(1008, 'Authentication failed');
        return;
      }

      // Create connection info
      const connectionId = this.generateConnectionId();
      const connectionInfo: WebSocketConnectionInfo = {
        id: connectionId,
        user,
        socket: connection,
        connectedAt: new Date(),
        lastPingTime: Date.now(),
        subscriptions: new Set(),
        metadata: {
          ip: clientIp,
          userAgent,
        },
      };

      // Register connection
      this.addConnection(connectionInfo);

      // Set up message handling
      this.setupMessageHandling(connectionInfo);

      // Set up connection lifecycle handlers
      this.setupConnectionLifecycle(connectionInfo);

      // Subscribe to default channels
      this.subscribeToDefaultChannels(connectionInfo);

      // Send welcome message
      this.sendToConnection(connectionId, {
        type: 'welcome',
        data: {
          connectionId,
          user: {
            id: user.id,
            name: user.name,
            workspaceId: user.workspaceId,
          },
        },
        timestamp: new Date().toISOString(),
        messageId: `welcome_${connectionId}`,
      });

      // Update metrics
      this.metrics.connectionsEstablished++;
      this.metrics.totalConnections = this.connections.size;

      this.logger.info('WebSocket connection established successfully', {
        userId: user.id,
        workspaceId: user.workspaceId,
        connectionId,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error('Error handling WebSocket connection', error as Error, {
        ip: clientIp,
        duration: Date.now() - startTime,
      });

      this.metrics.errors++;
      connection.socket.close(1011, 'Internal server error');
    }
  }

  private async authenticateConnection(
    request: FastifyRequest
  ): Promise<WebSocketUser | null> {
    try {
      // Extract token from query params or headers
      const token =
        (request.query as any)?.token ||
        request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return null;
      }

      const payload = await this.jwtService.verifyToken(token);

      if (!payload.sub || !payload.email) {
        return null;
      }

      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        workspaceId: payload.workspaceId,
        roles: payload.roles || ['user'],
      };
    } catch (error) {
      this.logger.error('WebSocket authentication error', error as Error);
      return null;
    }
  }

  private setupMessageHandling(connectionInfo: WebSocketConnectionInfo): void {
    connectionInfo.socket.socket.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleMessage(connectionInfo, data);
        this.metrics.messagesReceived++;
      } catch (error) {
        this.logger.error('Error handling WebSocket message', error as Error, {
          userId: connectionInfo.user.id,
          connectionId: connectionInfo.id,
        });
        this.metrics.errors++;
      }
    });
  }

  private setupConnectionLifecycle(
    connectionInfo: WebSocketConnectionInfo
  ): void {
    connectionInfo.socket.socket.on('close', (code: number, reason: Buffer) => {
      this.logger.info('WebSocket connection closed', {
        userId: connectionInfo.user.id,
        connectionId: connectionInfo.id,
        code,
        reason: reason?.toString(),
      });

      this.removeConnection(connectionInfo.id);
      this.metrics.connectionsClosed++;
      this.metrics.totalConnections = this.connections.size;
    });

    connectionInfo.socket.socket.on('error', (error: Error) => {
      this.logger.error('WebSocket connection error', error, {
        userId: connectionInfo.user.id,
        connectionId: connectionInfo.id,
      });
      this.metrics.errors++;
    });

    connectionInfo.socket.socket.on('pong', () => {
      connectionInfo.lastPingTime = Date.now();
    });
  }

  private async handleMessage(
    connectionInfo: WebSocketConnectionInfo,
    data: WebSocketMessage
  ): Promise<void> {
    this.logger.debug('WebSocket message received', {
      connectionId: connectionInfo.id,
      type: data.type,
    });

    switch (data.type) {
      case 'ping':
        this.sendToConnection(connectionInfo.id, {
          type: 'pong',
          timestamp: new Date().toISOString(),
          messageId: `pong_${Date.now()}`,
        });
        break;

      case 'subscribe':
        if (data.channel) {
          this.subscribeToChannel(connectionInfo.id, data.channel);
          this.sendToConnection(connectionInfo.id, {
            type: 'subscribed',
            data: { channel: data.channel },
            timestamp: new Date().toISOString(),
            messageId: `sub_${Date.now()}`,
          });
        }
        break;

      case 'unsubscribe':
        if (data.channel) {
          this.unsubscribeFromChannel(connectionInfo.id, data.channel);
          this.sendToConnection(connectionInfo.id, {
            type: 'unsubscribed',
            data: { channel: data.channel },
            timestamp: new Date().toISOString(),
            messageId: `unsub_${Date.now()}`,
          });
        }
        break;

      case 'join_project':
        if (data.projectId) {
          this.subscribeToProject(connectionInfo.id, data.projectId);
          this.sendToConnection(connectionInfo.id, {
            type: 'project_joined',
            data: { projectId: data.projectId },
            timestamp: new Date().toISOString(),
            messageId: `join_${Date.now()}`,
          });
        }
        break;

      case 'leave_project':
        if (data.projectId) {
          this.unsubscribeFromProject(connectionInfo.id, data.projectId);
          this.sendToConnection(connectionInfo.id, {
            type: 'project_left',
            data: { projectId: data.projectId },
            timestamp: new Date().toISOString(),
            messageId: `leave_${Date.now()}`,
          });
        }
        break;

      case 'presence_update':
        this.handlePresenceUpdate(connectionInfo, data.data || data.payload);
        break;

      case 'typing_start':
        this.broadcastToChannel(
          data.channel || `project:${data.projectId}`,
          {
            type: 'user_typing',
            data: {
              userId: connectionInfo.user.id,
              userName: connectionInfo.user.name,
              channel: data.channel,
              projectId: data.projectId,
            },
            timestamp: new Date().toISOString(),
            messageId: `typing_${Date.now()}`,
          },
          connectionInfo.id
        );
        break;

      case 'typing_stop':
        this.broadcastToChannel(
          data.channel || `project:${data.projectId}`,
          {
            type: 'user_stopped_typing',
            data: {
              userId: connectionInfo.user.id,
              channel: data.channel,
              projectId: data.projectId,
            },
            timestamp: new Date().toISOString(),
            messageId: `stop_typing_${Date.now()}`,
          },
          connectionInfo.id
        );
        break;

      case 'document_edit':
        this.broadcastToChannel(
          data.channel || `project:${data.projectId}`,
          {
            type: 'document_edit',
            data: {
              userId: connectionInfo.user.id,
              userName: connectionInfo.user.name,
              edit: data.data || data.payload,
              channel: data.channel,
              projectId: data.projectId,
            },
            timestamp: new Date().toISOString(),
            messageId: `edit_${Date.now()}`,
          },
          connectionInfo.id
        );
        break;

      case 'get_notifications':
        this.handleGetNotifications(connectionInfo, data.data || data.payload);
        break;

      case 'mark_notification_read':
        await this.handleMarkNotificationRead(
          connectionInfo,
          data.data || data.payload
        );
        break;

      default:
        this.logger.warn('Unknown WebSocket message type', {
          connectionId: connectionInfo.id,
          type: data.type,
        });
    }
  }

  private addConnection(connectionInfo: WebSocketConnectionInfo): void {
    const { id, user } = connectionInfo;

    // Store connection
    this.connections.set(id, connectionInfo);

    // Index by user
    if (!this.connectionsByUser.has(user.id)) {
      this.connectionsByUser.set(user.id, new Set());
    }
    this.connectionsByUser.get(user.id)!.add(id);

    // Index by workspace
    if (user.workspaceId) {
      if (!this.connectionsByWorkspace.has(user.workspaceId)) {
        this.connectionsByWorkspace.set(user.workspaceId, new Set());
      }
      this.connectionsByWorkspace.get(user.workspaceId)!.add(id);
    }

    this.logger.debug('Connection added', {
      connectionId: id,
      userId: user.id,
      workspaceId: user.workspaceId,
      totalConnections: this.connections.size,
    });
  }

  private removeConnection(connectionId: string): void {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) {
      return;
    }

    const { user } = connectionInfo;

    // Remove from main connections map
    this.connections.delete(connectionId);

    // Remove from user index
    const userConnections = this.connectionsByUser.get(user.id);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.connectionsByUser.delete(user.id);
      }
    }

    // Remove from workspace index
    if (user.workspaceId) {
      const workspaceConnections = this.connectionsByWorkspace.get(
        user.workspaceId
      );
      if (workspaceConnections) {
        workspaceConnections.delete(connectionId);
        if (workspaceConnections.size === 0) {
          this.connectionsByWorkspace.delete(user.workspaceId);
        }
      }
    }

    // Remove from all project indexes
    for (const [projectId, projectConnections] of this.connectionsByProject) {
      if (projectConnections.has(connectionId)) {
        projectConnections.delete(connectionId);
        if (projectConnections.size === 0) {
          this.connectionsByProject.delete(projectId);
        }
      }
    }

    this.logger.debug('Connection removed', {
      connectionId,
      userId: user.id,
      workspaceId: user.workspaceId,
      totalConnections: this.connections.size,
    });
  }

  private subscribeToDefaultChannels(
    connectionInfo: WebSocketConnectionInfo
  ): void {
    const { user } = connectionInfo;

    // Subscribe to user-specific channel
    this.subscribeToChannel(connectionInfo.id, `user:${user.id}`);

    // Subscribe to workspace channel if user has workspace
    if (user.workspaceId) {
      this.subscribeToChannel(
        connectionInfo.id,
        `workspace:${user.workspaceId}`
      );
    }

    // Subscribe to role-based channels
    for (const role of user.roles) {
      this.subscribeToChannel(connectionInfo.id, `role:${role}`);
    }
  }

  private subscribeToChannel(connectionId: string, channel: string): void {
    const connectionInfo = this.connections.get(connectionId);
    if (connectionInfo) {
      connectionInfo.subscriptions.add(channel);
      this.logger.debug('Connection subscribed to channel', {
        connectionId,
        channel,
      });
    }
  }

  private unsubscribeFromChannel(connectionId: string, channel: string): void {
    const connectionInfo = this.connections.get(connectionId);
    if (connectionInfo) {
      connectionInfo.subscriptions.delete(channel);
      this.logger.debug('Connection unsubscribed from channel', {
        connectionId,
        channel,
      });
    }
  }

  private subscribeToProject(connectionId: string, projectId: string): void {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) {
      return;
    }

    // Add to project index
    if (!this.connectionsByProject.has(projectId)) {
      this.connectionsByProject.set(projectId, new Set());
    }
    this.connectionsByProject.get(projectId)!.add(connectionId);

    // Subscribe to project channel
    this.subscribeToChannel(connectionId, `project:${projectId}`);

    this.logger.debug('Connection subscribed to project', {
      connectionId,
      projectId,
      userId: connectionInfo.user.id,
    });
  }

  private unsubscribeFromProject(
    connectionId: string,
    projectId: string
  ): void {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) {
      return;
    }

    // Remove from project index
    const projectConnections = this.connectionsByProject.get(projectId);
    if (projectConnections) {
      projectConnections.delete(connectionId);
      if (projectConnections.size === 0) {
        this.connectionsByProject.delete(projectId);
      }
    }

    // Unsubscribe from project channel
    this.unsubscribeFromChannel(connectionId, `project:${projectId}`);

    this.logger.debug('Connection unsubscribed from project', {
      connectionId,
      projectId,
      userId: connectionInfo.user.id,
    });
  }

  private handlePresenceUpdate(
    connectionInfo: WebSocketConnectionInfo,
    presence: any
  ): void {
    // Broadcast presence update to workspace
    if (connectionInfo.user.workspaceId) {
      this.broadcastToWorkspace(
        connectionInfo.user.workspaceId,
        {
          type: 'presence_update',
          data: {
            userId: connectionInfo.user.id,
            userName: connectionInfo.user.name,
            presence,
          },
          timestamp: new Date().toISOString(),
          messageId: `presence_${Date.now()}`,
        },
        connectionInfo.id
      );
    }
  }

  private handleGetNotifications(
    connectionInfo: WebSocketConnectionInfo,
    payload: any
  ): void {
    if (!connectionInfo.user.id) return;

    const notifications = this.realtimeEventService.getUserNotifications(
      connectionInfo.user.id,
      payload?.unreadOnly || false
    );

    this.sendToConnection(connectionInfo.id, {
      type: 'notifications_list',
      data: { notifications },
      timestamp: new Date().toISOString(),
      messageId: nanoid(),
    });
  }

  private async handleMarkNotificationRead(
    connectionInfo: WebSocketConnectionInfo,
    payload: any
  ): Promise<void> {
    if (!connectionInfo.user.id || !payload?.notificationId) return;

    const success = await this.realtimeEventService.markNotificationAsRead(
      payload.notificationId,
      connectionInfo.user.id
    );

    this.sendToConnection(connectionInfo.id, {
      type: 'notification_marked_read',
      data: {
        notificationId: payload.notificationId,
        success,
      },
      timestamp: new Date().toISOString(),
      messageId: nanoid(),
    });
  }

  private sendToConnection(
    connectionId: string,
    message: WebSocketMessage
  ): void {
    const connectionInfo = this.connections.get(connectionId);
    if (connectionInfo && connectionInfo.socket.socket.readyState === 1) {
      try {
        connectionInfo.socket.socket.send(JSON.stringify(message));
        this.metrics.messagesSent++;
      } catch (error) {
        this.logger.error(
          'Failed to send message to connection',
          error as Error,
          {
            connectionId,
          }
        );
        this.metrics.errors++;
      }
    }
  }

  private broadcastToChannel(
    channel: string,
    message: WebSocketMessage,
    excludeConnectionId?: string
  ): void {
    let sentCount = 0;
    for (const [connectionId, connectionInfo] of this.connections) {
      if (
        connectionId !== excludeConnectionId &&
        connectionInfo.subscriptions.has(channel)
      ) {
        this.sendToConnection(connectionId, message);
        sentCount++;
      }
    }

    this.logger.debug('Broadcast to channel', {
      channel,
      messageType: message.type,
      sentCount,
    });
  }

  // Public methods for broadcasting messages
  broadcastToWorkspace(
    workspaceId: string,
    message: WebSocketMessage,
    excludeConnectionId?: string
  ): void {
    this.broadcastToChannel(
      `workspace:${workspaceId}`,
      message,
      excludeConnectionId
    );
  }

  broadcastToProject(
    projectId: string,
    message: WebSocketMessage,
    excludeConnectionId?: string
  ): void {
    this.broadcastToChannel(
      `project:${projectId}`,
      message,
      excludeConnectionId
    );
  }

  broadcastToUser(userId: string, message: WebSocketMessage): boolean {
    const connectionIds = this.connectionsByUser.get(userId);
    if (!connectionIds || connectionIds.size === 0) {
      return false;
    }

    for (const connectionId of connectionIds) {
      this.sendToConnection(connectionId, message);
    }

    return true;
  }

  broadcast(message: WebSocketMessage): void {
    for (const connectionId of this.connections.keys()) {
      this.sendToConnection(connectionId, message);
    }
  }

  // Utility methods
  getConnectedUsers(): string[] {
    return Array.from(this.connectionsByUser.keys());
  }

  isUserConnected(userId: string): boolean {
    return this.connectionsByUser.has(userId);
  }

  getConnectionStats() {
    return {
      ...this.metrics,
      activeConnections: this.connections.size,
      userConnections: this.connectionsByUser.size,
      workspaceConnections: this.connectionsByWorkspace.size,
      projectConnections: this.connectionsByProject.size,
    };
  }

  getUserPresence(userId: string) {
    return this.webSocketService.getPresence(userId);
  }

  private getHealthStatus() {
    return {
      healthy: true,
      timestamp: new Date(),
      connections: {
        total: this.connections.size,
        byWorkspace: Object.fromEntries(
          Array.from(this.connectionsByWorkspace.entries()).map(
            ([id, conns]) => [id, conns.size]
          )
        ),
      },
      metrics: this.metrics,
    };
  }

  private getMetrics() {
    return {
      ...this.metrics,
      activeConnections: this.connections.size,
      connectionsByUser: this.connectionsByUser.size,
      connectionsByWorkspace: this.connectionsByWorkspace.size,
      connectionsByProject: this.connectionsByProject.size,
      uptime: process.uptime(),
    };
  }

  private getConnectionInfo() {
    return {
      totalConnections: this.connections.size,
      activeConnections: this.connections.size,
      connectionsByWorkspace: Object.fromEntries(
        Array.from(this.connectionsByWorkspace.entries()).map(([id, conns]) => [
          id,
          conns.size,
        ])
      ),
      connectionsByUser: Object.fromEntries(
        Array.from(this.connectionsByUser.entries()).map(([id, conns]) => [
          id,
          conns.size,
        ])
      ),
    };
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
      this.pingAllConnections();
    }, this.config.heartbeatInterval);
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [connectionId, connectionInfo] of this.connections) {
      const timeSinceLastPing = now - connectionInfo.lastPingTime;
      if (timeSinceLastPing > this.config.connectionTimeout) {
        staleConnections.push(connectionId);
      }
    }

    // Remove stale connections
    for (const connectionId of staleConnections) {
      const connectionInfo = this.connections.get(connectionId);
      if (connectionInfo) {
        connectionInfo.socket.socket.close(1001, 'Connection timeout');
        this.removeConnection(connectionId);
      }
    }

    if (staleConnections.length > 0) {
      this.logger.info('Cleaned up stale WebSocket connections', {
        count: staleConnections.length,
        remaining: this.connections.size,
      });
    }
  }

  private pingAllConnections(): void {
    for (const connectionInfo of this.connections.values()) {
      if (connectionInfo.socket.socket.readyState === 1) {
        connectionInfo.socket.socket.ping();
      }
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Enhanced WebSocket handler...');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all connections gracefully
    for (const connectionInfo of this.connections.values()) {
      connectionInfo.socket.socket.close(1001, 'Server shutting down');
    }

    this.connections.clear();
    this.connectionsByUser.clear();
    this.connectionsByWorkspace.clear();
    this.connectionsByProject.clear();

    this.logger.info('Enhanced WebSocket handler shutdown complete');
  }
}
