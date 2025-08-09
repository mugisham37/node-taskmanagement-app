import { FastifyInstance } from 'fastify';
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
  payload: any;
  timestamp: string;
  messageId?: string;
  userId?: string;
  channel?: string;
}

export interface AuthenticatedSocket extends SocketStream {
  userId?: string;
  userEmail?: string;
  connectionId?: string;
}

export class WebSocketHandler {
  constructor(
    private readonly logger: LoggingService,
    private readonly jwtService: JWTService,
    private readonly webSocketService: WebSocketService,
    private readonly realtimeEventService: RealtimeEventService
  ) {}

  async handleConnection(
    connection: SocketStream,
    request: any
  ): Promise<void> {
    const socket = connection as AuthenticatedSocket;

    try {
      // Authenticate the WebSocket connection
      await this.authenticateSocket(socket, request);

      // Generate connection ID
      socket.connectionId = nanoid();

      // Create WebSocket connection object
      if (socket.userId && socket.userEmail && socket.connectionId) {
        const wsConnection: WebSocketConnection = {
          id: socket.connectionId,
          userId: socket.userId,
          userEmail: socket.userEmail,
          socket,
          subscriptions: new Set(),
          lastActivity: new Date(),
          metadata: {
            userAgent: request.headers['user-agent'],
            ip: request.ip,
            connectedAt: new Date(),
          },
        };

        // Add to WebSocket service
        this.webSocketService.addConnection(wsConnection);

        this.logger.info('WebSocket client connected', {
          connectionId: socket.connectionId,
          userId: socket.userId,
          userEmail: socket.userEmail,
          totalConnections:
            this.webSocketService.getConnectionStats().totalConnections,
        });

        // Send welcome message with connection info
        this.sendMessage(socket, {
          type: 'connection_established',
          payload: {
            connectionId: socket.connectionId,
            message: 'Connected successfully',
            stats: this.webSocketService.getConnectionStats(),
          },
          timestamp: new Date().toISOString(),
          messageId: nanoid(),
        });

        // Auto-subscribe to user's personal channel
        this.webSocketService.subscribeToChannel(
          socket.connectionId,
          `user:${socket.userId}`
        );
      }

      // Handle incoming messages
      socket.on('message', (data: Buffer) => {
        this.handleMessage(socket, data);
      });

      // Handle disconnection
      socket.on('close', () => {
        this.handleDisconnection(socket);
      });

      socket.on('error', (error: Error) => {
        this.logger.error('WebSocket error', error, {
          connectionId: socket.connectionId,
          userId: socket.userId,
          userEmail: socket.userEmail,
        });
      });
    } catch (error) {
      this.logger.warn('WebSocket authentication failed', error as Error);
      socket.close(1008, 'Authentication failed');
    }
  }

  private async authenticateSocket(
    socket: AuthenticatedSocket,
    request: any
  ): Promise<void> {
    // Extract token from query parameters or headers
    const token =
      request.query?.token ||
      request.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AuthorizationError('Missing authentication token');
    }

    try {
      const payload = await this.jwtService.verifyToken(token);

      if (!payload.sub || !payload.email) {
        throw new AuthorizationError('Invalid token payload');
      }

      socket.userId = payload.sub;
      socket.userEmail = payload.email;
    } catch (error) {
      throw new AuthorizationError('Invalid authentication token');
    }
  }

  private handleMessage(socket: AuthenticatedSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;

      this.logger.debug('WebSocket message received', {
        connectionId: socket.connectionId,
        userId: socket.userId,
        messageType: message.type,
        timestamp: message.timestamp,
      });

      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.sendMessage(socket, {
            type: 'pong',
            payload: { timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString(),
            messageId: nanoid(),
          });
          break;

        case 'subscribe':
          this.handleSubscription(socket, message.payload);
          break;

        case 'unsubscribe':
          this.handleUnsubscription(socket, message.payload);
          break;

        case 'presence_update':
          this.handlePresenceUpdate(socket, message.payload);
          break;

        case 'document_edit':
          this.handleDocumentEdit(socket, message.payload);
          break;

        case 'typing_start':
          this.handleTypingIndicator(socket, message.payload, true);
          break;

        case 'typing_stop':
          this.handleTypingIndicator(socket, message.payload, false);
          break;

        case 'get_notifications':
          this.handleGetNotifications(socket, message.payload);
          break;

        case 'mark_notification_read':
          this.handleMarkNotificationRead(socket, message.payload);
          break;

        default:
          this.logger.warn('Unknown WebSocket message type', {
            connectionId: socket.connectionId,
            userId: socket.userId,
            messageType: message.type,
          });
      }
    } catch (error) {
      this.logger.error('Error handling WebSocket message', error as Error, {
        connectionId: socket.connectionId,
        userId: socket.userId,
      });

      this.sendMessage(socket, {
        type: 'error',
        payload: { message: 'Invalid message format' },
        timestamp: new Date().toISOString(),
        messageId: nanoid(),
      });
    }
  }

  private handleSubscription(socket: AuthenticatedSocket, payload: any): void {
    if (!socket.connectionId || !payload.channel) {
      this.sendMessage(socket, {
        type: 'subscription_error',
        payload: { message: 'Invalid subscription request' },
        timestamp: new Date().toISOString(),
        messageId: nanoid(),
      });
      return;
    }

    const success = this.webSocketService.subscribeToChannel(
      socket.connectionId,
      payload.channel
    );

    this.logger.debug('WebSocket subscription', {
      connectionId: socket.connectionId,
      userId: socket.userId,
      channel: payload.channel,
      success,
    });

    this.sendMessage(socket, {
      type: success ? 'subscription_confirmed' : 'subscription_error',
      payload: {
        channel: payload.channel,
        message: success ? 'Subscribed successfully' : 'Subscription failed',
      },
      timestamp: new Date().toISOString(),
      messageId: nanoid(),
    });
  }

  private handleUnsubscription(
    socket: AuthenticatedSocket,
    payload: any
  ): void {
    if (!socket.connectionId || !payload.channel) {
      this.sendMessage(socket, {
        type: 'unsubscription_error',
        payload: { message: 'Invalid unsubscription request' },
        timestamp: new Date().toISOString(),
        messageId: nanoid(),
      });
      return;
    }

    const success = this.webSocketService.unsubscribeFromChannel(
      socket.connectionId,
      payload.channel
    );

    this.logger.debug('WebSocket unsubscription', {
      connectionId: socket.connectionId,
      userId: socket.userId,
      channel: payload.channel,
      success,
    });

    this.sendMessage(socket, {
      type: success ? 'unsubscription_confirmed' : 'unsubscription_error',
      payload: {
        channel: payload.channel,
        message: success
          ? 'Unsubscribed successfully'
          : 'Unsubscription failed',
      },
      timestamp: new Date().toISOString(),
      messageId: nanoid(),
    });
  }

  private handlePresenceUpdate(
    socket: AuthenticatedSocket,
    payload: any
  ): void {
    if (!socket.userId) return;

    this.webSocketService.updatePresence(socket.userId, {
      userId: socket.userId,
      userEmail: socket.userEmail!,
      status: payload.status || 'online',
      lastSeen: new Date(),
      currentWorkspace: payload.workspaceId,
      currentProject: payload.projectId,
    });

    this.realtimeEventService.publishUserPresenceUpdate(
      socket.userId,
      payload.status || 'online',
      {
        workspaceId: payload.workspaceId,
        projectId: payload.projectId,
      }
    );
  }

  private handleDocumentEdit(socket: AuthenticatedSocket, payload: any): void {
    if (!socket.userId || !payload.documentId || !payload.operation) return;

    this.realtimeEventService.publishDocumentEdit(
      payload.documentId,
      socket.userId,
      payload.operation,
      payload.documentType || 'task'
    );
  }

  private handleTypingIndicator(
    socket: AuthenticatedSocket,
    payload: any,
    isTyping: boolean
  ): void {
    if (!socket.userId || !payload.documentId) return;

    const message: WebSocketMessage = {
      type: isTyping ? 'user_typing_start' : 'user_typing_stop',
      payload: {
        userId: socket.userId,
        userEmail: socket.userEmail,
        documentId: payload.documentId,
        documentType: payload.documentType,
      },
      timestamp: new Date().toISOString(),
      messageId: nanoid(),
      userId: socket.userId,
    };

    this.webSocketService.broadcastToChannel(
      `document:${payload.documentId}`,
      message
    );
  }

  private handleGetNotifications(
    socket: AuthenticatedSocket,
    payload: any
  ): void {
    if (!socket.userId) return;

    const notifications = this.realtimeEventService.getUserNotifications(
      socket.userId,
      payload.unreadOnly || false
    );

    this.sendMessage(socket, {
      type: 'notifications_list',
      payload: { notifications },
      timestamp: new Date().toISOString(),
      messageId: nanoid(),
    });
  }

  private async handleMarkNotificationRead(
    socket: AuthenticatedSocket,
    payload: any
  ): Promise<void> {
    if (!socket.userId || !payload.notificationId) return;

    const success = await this.realtimeEventService.markNotificationAsRead(
      payload.notificationId,
      socket.userId
    );

    this.sendMessage(socket, {
      type: 'notification_marked_read',
      payload: {
        notificationId: payload.notificationId,
        success,
      },
      timestamp: new Date().toISOString(),
      messageId: nanoid(),
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    if (socket.connectionId) {
      this.webSocketService.removeConnection(socket.connectionId);

      this.logger.info('WebSocket client disconnected', {
        connectionId: socket.connectionId,
        userId: socket.userId,
        userEmail: socket.userEmail,
        totalConnections:
          this.webSocketService.getConnectionStats().totalConnections,
      });
    }
  }

  private sendMessage(
    socket: AuthenticatedSocket,
    message: WebSocketMessage
  ): void {
    try {
      socket.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error('Error sending WebSocket message', error as Error, {
        connectionId: socket.connectionId,
        userId: socket.userId,
        messageType: message.type,
      });
    }
  }

  // Public methods for broadcasting messages (delegated to WebSocketService)
  broadcastToUser(userId: string, message: WebSocketMessage): number {
    return this.webSocketService.sendToUser(userId, message);
  }

  broadcastToChannel(channel: string, message: WebSocketMessage): number {
    return this.webSocketService.broadcastToChannel(channel, message);
  }

  broadcastToAll(message: WebSocketMessage): number {
    return this.webSocketService.broadcastToAll(message);
  }

  getConnectedUsers(): string[] {
    return this.webSocketService.getAllPresence().map(p => p.userId);
  }

  isUserConnected(userId: string): boolean {
    return this.webSocketService.isUserOnline(userId);
  }

  getConnectionStats() {
    return this.webSocketService.getConnectionStats();
  }

  getUserPresence(userId: string) {
    return this.webSocketService.getPresence(userId);
  }
}
