import { EventEmitter } from 'events';
import { LoggingService } from '../monitoring/logging-service';
import { CacheService } from '../caching/cache-service';

export interface WebSocketConnection {
  id: string;
  userId: string;
  userEmail: string;
  socket: any;
  subscriptions: Set<string>;
  lastActivity: Date;
  metadata: Record<string, any>;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  messageId: string;
  userId?: string;
  channel?: string;
}

export interface PresenceInfo {
  userId: string;
  userEmail: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  currentWorkspace?: string;
  currentProject?: string;
}

export class WebSocketService extends EventEmitter {
  private connections = new Map<string, WebSocketConnection>();
  private userConnections = new Map<string, Set<string>>();
  private channelSubscriptions = new Map<string, Set<string>>();
  private presenceInfo = new Map<string, PresenceInfo>();

  constructor(
    private readonly logger: LoggingService,
    private readonly cacheService: CacheService
  ) {
    super();
    this.setupCleanupInterval();
  }

  addConnection(connection: WebSocketConnection): void {
    this.connections.set(connection.id, connection);

    // Track user connections
    if (!this.userConnections.has(connection.userId)) {
      this.userConnections.set(connection.userId, new Set());
    }
    this.userConnections.get(connection.userId)!.add(connection.id);

    // Update presence
    this.updatePresence(connection.userId, {
      userId: connection.userId,
      userEmail: connection.userEmail,
      status: 'online',
      lastSeen: new Date(),
    });

    this.logger.info('WebSocket connection added', {
      connectionId: connection.id,
      userId: connection.userId,
      totalConnections: this.connections.size,
    });

    this.emit('connection:added', connection);
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user connections
    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId);
        // Update presence to offline if no more connections
        this.updatePresence(connection.userId, {
          userId: connection.userId,
          userEmail: connection.userEmail,
          status: 'offline',
          lastSeen: new Date(),
        });
      }
    }

    // Remove from channel subscriptions
    connection.subscriptions.forEach(channel => {
      this.unsubscribeFromChannel(connectionId, channel);
    });

    this.connections.delete(connectionId);

    this.logger.info('WebSocket connection removed', {
      connectionId,
      userId: connection.userId,
      totalConnections: this.connections.size,
    });

    this.emit('connection:removed', connection);
  }

  subscribeToChannel(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    connection.subscriptions.add(channel);

    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set());
    }
    this.channelSubscriptions.get(channel)!.add(connectionId);

    this.logger.debug('Connection subscribed to channel', {
      connectionId,
      userId: connection.userId,
      channel,
    });

    return true;
  }

  unsubscribeFromChannel(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    connection.subscriptions.delete(channel);

    const channelSubs = this.channelSubscriptions.get(channel);
    if (channelSubs) {
      channelSubs.delete(connectionId);
      if (channelSubs.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }

    this.logger.debug('Connection unsubscribed from channel', {
      connectionId,
      userId: connection.userId,
      channel,
    });

    return true;
  }

  sendToConnection(connectionId: string, message: WebSocketMessage): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    try {
      connection.socket.send(JSON.stringify(message));
      connection.lastActivity = new Date();
      return true;
    } catch (error) {
      this.logger.error(
        'Failed to send message to connection',
        error as Error,
        {
          connectionId,
          userId: connection.userId,
          messageType: message.type,
        }
      );
      return false;
    }
  }

  sendToUser(userId: string, message: WebSocketMessage): number {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return 0;

    let sentCount = 0;
    userConnections.forEach(connectionId => {
      if (this.sendToConnection(connectionId, message)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  broadcastToChannel(channel: string, message: WebSocketMessage): number {
    const channelSubs = this.channelSubscriptions.get(channel);
    if (!channelSubs) return 0;

    let sentCount = 0;
    channelSubs.forEach(connectionId => {
      if (this.sendToConnection(connectionId, message)) {
        sentCount++;
      }
    });

    this.logger.debug('Broadcast to channel', {
      channel,
      messageType: message.type,
      recipientCount: sentCount,
    });

    return sentCount;
  }

  broadcastToAll(message: WebSocketMessage): number {
    let sentCount = 0;
    this.connections.forEach((_, connectionId) => {
      if (this.sendToConnection(connectionId, message)) {
        sentCount++;
      }
    });

    this.logger.debug('Broadcast to all connections', {
      messageType: message.type,
      recipientCount: sentCount,
    });

    return sentCount;
  }

  updatePresence(userId: string, presence: Partial<PresenceInfo>): void {
    const current = this.presenceInfo.get(userId) || {
      userId,
      userEmail: '',
      status: 'offline' as const,
      lastSeen: new Date(),
    };

    const updated = { ...current, ...presence };
    this.presenceInfo.set(userId, updated);

    // Cache presence info
    this.cacheService.set(
      `presence:${userId}`,
      JSON.stringify(updated),
      { ttl: 300 } // 5 minutes TTL
    );

    // Broadcast presence update
    this.broadcastToChannel(`presence:${userId}`, {
      type: 'presence_updated',
      payload: updated,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });
  }

  getPresence(userId: string): PresenceInfo | null {
    return this.presenceInfo.get(userId) || null;
  }

  getAllPresence(): PresenceInfo[] {
    return Array.from(this.presenceInfo.values());
  }

  getChannelSubscribers(channel: string): string[] {
    const subs = this.channelSubscriptions.get(channel);
    if (!subs) return [];

    return Array.from(subs)
      .map(connectionId => this.connections.get(connectionId))
      .filter(conn => conn !== undefined)
      .map(conn => conn!.userId);
  }

  getConnectionStats(): {
    totalConnections: number;
    uniqueUsers: number;
    channels: number;
    averageSubscriptionsPerConnection: number;
  } {
    const totalSubscriptions = Array.from(this.connections.values()).reduce(
      (sum, conn) => sum + conn.subscriptions.size,
      0
    );

    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userConnections.size,
      channels: this.channelSubscriptions.size,
      averageSubscriptionsPerConnection:
        this.connections.size > 0
          ? totalSubscriptions / this.connections.size
          : 0,
    };
  }

  isUserOnline(userId: string): boolean {
    return this.userConnections.has(userId);
  }

  getUserConnections(userId: string): WebSocketConnection[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) return [];

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter(conn => conn !== undefined) as WebSocketConnection[];
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupCleanupInterval(): void {
    // Clean up stale connections every 5 minutes
    setInterval(
      () => {
        const now = new Date();
        const staleThreshold = 30 * 60 * 1000; // 30 minutes

        this.connections.forEach((connection, connectionId) => {
          if (
            now.getTime() - connection.lastActivity.getTime() >
            staleThreshold
          ) {
            this.logger.warn('Removing stale WebSocket connection', {
              connectionId,
              userId: connection.userId,
              lastActivity: connection.lastActivity,
            });
            this.removeConnection(connectionId);
          }
        });
      },
      5 * 60 * 1000
    );
  }
}
