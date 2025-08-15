import { EventEmitter } from 'events';
import {
    ConnectionStats,
    PresenceInfo,
    WebSocketConnection,
    WebSocketMessage,
    WebSocketService
} from './interfaces';

export class DefaultWebSocketService extends EventEmitter implements WebSocketService {
  readonly name = 'websocket-service';
  private connections = new Map<string, WebSocketConnection>();
  private userConnections = new Map<string, Set<string>>();
  private channelSubscriptions = new Map<string, Set<string>>();
  private presenceInfo = new Map<string, PresenceInfo>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
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

    return sentCount;
  }

  broadcastToAll(message: WebSocketMessage): number {
    let sentCount = 0;
    this.connections.forEach((_, connectionId) => {
      if (this.sendToConnection(connectionId, message)) {
        sentCount++;
      }
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

  isUserOnline(userId: string): boolean {
    return this.userConnections.has(userId);
  }

  getConnectionStats(): ConnectionStats {
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

  async isHealthy(): Promise<boolean> {
    return true; // WebSocket service is always healthy if running
  }

  async getHealthStatus(): Promise<Record<string, any>> {
    const stats = this.getConnectionStats();
    return {
      connections: stats.totalConnections,
      users: stats.uniqueUsers,
      channels: stats.channels,
      healthy: true,
    };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupCleanupInterval(): void {
    // Clean up stale connections every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        const now = new Date();
        const staleThreshold = 30 * 60 * 1000; // 30 minutes

        this.connections.forEach((connection, connectionId) => {
          if (
            now.getTime() - connection.lastActivity.getTime() >
            staleThreshold
          ) {
            this.removeConnection(connectionId);
          }
        });
      },
      5 * 60 * 1000
    );
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
  }
}