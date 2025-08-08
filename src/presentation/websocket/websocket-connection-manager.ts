import { WebSocketConnection } from './websocket-connection';
import { logger } from '@/infrastructure/logging/logger';

export interface ConnectionInfo {
  totalConnections: number;
  activeConnections: number;
  connectionsByWorkspace: Record<string, number>;
  connectionsByUser: Record<string, number>;
}

export interface WebSocketServerConfig {
  heartbeatInterval: number;
  connectionTimeout: number;
  maxConnections: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export class WebSocketConnectionManager {
  private connections: Map<string, WebSocketConnection> = new Map();
  private connectionsByUser: Map<string, Set<string>> = new Map();
  private connectionsByWorkspace: Map<string, Set<string>> = new Map();
  private connectionsByProject: Map<string, Set<string>> = new Map();
  private config: WebSocketServerConfig;

  constructor(config: WebSocketServerConfig) {
    this.config = config;

    // Start cleanup interval
    this.startCleanupInterval();

    logger.info('WebSocket connection manager initialized');
  }

  /**
   * Add a new connection
   */
  async addConnection(connection: WebSocketConnection): Promise<void> {
    const connectionId = connection.getId();
    const user = connection.getUser();

    // Store connection
    this.connections.set(connectionId, connection);

    // Index by user
    if (!this.connectionsByUser.has(user.id)) {
      this.connectionsByUser.set(user.id, new Set());
    }
    this.connectionsByUser.get(user.id)!.add(connectionId);

    // Index by workspace
    if (user.workspaceId) {
      if (!this.connectionsByWorkspace.has(user.workspaceId)) {
        this.connectionsByWorkspace.set(user.workspaceId, new Set());
      }
      this.connectionsByWorkspace.get(user.workspaceId)!.add(connectionId);
    }

    // Subscribe to default channels
    await this.subscribeToDefaultChannels(connection);

    logger.debug('Connection added to manager', {
      connectionId,
      userId: user.id,
      workspaceId: user.workspaceId,
      totalConnections: this.connections.size,
    });
  }

  /**
   * Remove a connection
   */
  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const user = connection.getUser();

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

    logger.debug('Connection removed from manager', {
      connectionId,
      userId: user.id,
      workspaceId: user.workspaceId,
      totalConnections: this.connections.size,
    });
  }

  /**
   * Subscribe connection to project
   */
  subscribeToProject(connectionId: string, projectId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn('Attempted to subscribe non-existent connection to project', {
        connectionId,
        projectId,
      });
      return;
    }

    // Add to project index
    if (!this.connectionsByProject.has(projectId)) {
      this.connectionsByProject.set(projectId, new Set());
    }
    this.connectionsByProject.get(projectId)!.add(connectionId);

    // Subscribe connection to project channel
    connection.subscribe(`project:${projectId}`);

    logger.debug('Connection subscribed to project', {
      connectionId,
      projectId,
      userId: connection.getUser().id,
    });
  }

  /**
   * Unsubscribe connection from project
   */
  unsubscribeFromProject(connectionId: string, projectId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
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

    // Unsubscribe connection from project channel
    connection.unsubscribe(`project:${projectId}`);

    logger.debug('Connection unsubscribed from project', {
      connectionId,
      projectId,
      userId: connection.getUser().id,
    });
  }

  /**
   * Get connections by user ID
   */
  getConnectionsByUser(userId: string): WebSocketConnection[] {
    const connectionIds = this.connectionsByUser.get(userId);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  /**
   * Get connections by workspace ID
   */
  getConnectionsByWorkspace(workspaceId: string): WebSocketConnection[] {
    const connectionIds = this.connectionsByWorkspace.get(workspaceId);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  /**
   * Get connections by project ID
   */
  getConnectionsByProject(projectId: string): WebSocketConnection[] {
    const connectionIds = this.connectionsByProject.get(projectId);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all active connections
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get active connection count
   */
  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connection info for monitoring
   */
  getConnectionInfo(): ConnectionInfo {
    const connectionsByWorkspace: Record<string, number> = {};
    for (const [workspaceId, connections] of this.connectionsByWorkspace) {
      connectionsByWorkspace[workspaceId] = connections.size;
    }

    const connectionsByUser: Record<string, number> = {};
    for (const [userId, connections] of this.connectionsByUser) {
      connectionsByUser[userId] = connections.size;
    }

    return {
      totalConnections: this.connections.size,
      activeConnections: this.connections.size,
      connectionsByWorkspace,
      connectionsByUser,
    };
  }

  /**
   * Close all connections
   */
  async closeAllConnections(
    code: number = 1001,
    reason: string = 'Server shutdown'
  ): Promise<void> {
    logger.info('Closing all WebSocket connections', {
      count: this.connections.size,
      code,
      reason,
    });

    const closePromises = Array.from(this.connections.values()).map(
      connection => connection.close(code, reason)
    );

    await Promise.allSettled(closePromises);

    // Clear all indexes
    this.connections.clear();
    this.connectionsByUser.clear();
    this.connectionsByWorkspace.clear();
    this.connectionsByProject.clear();

    logger.info('All WebSocket connections closed');
  }

  /**
   * Subscribe connection to default channels
   */
  private async subscribeToDefaultChannels(
    connection: WebSocketConnection
  ): Promise<void> {
    const user = connection.getUser();

    // Subscribe to user-specific channel
    connection.subscribe(`user:${user.id}`);

    // Subscribe to workspace channel if user has workspace
    if (user.workspaceId) {
      connection.subscribe(`workspace:${user.workspaceId}`);
    }

    // Subscribe to role-based channels
    for (const role of user.roles) {
      connection.subscribe(`role:${role}`);
    }
  }

  /**
   * Start cleanup interval for stale connections
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupStaleConnections();
    }, this.config.heartbeatInterval);
  }

  /**
   * Clean up stale connections
   */
  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      const lastPing = connection.getLastPingTime();
      const timeSinceLastPing = now - lastPing;

      if (timeSinceLastPing > this.config.connectionTimeout) {
        staleConnections.push(connectionId);
      } else if (!connection.isConnectionAlive()) {
        staleConnections.push(connectionId);
      }
    }

    // Remove stale connections
    for (const connectionId of staleConnections) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        logger.info('Removing stale WebSocket connection', {
          connectionId,
          userId: connection.getUser().id,
        });

        connection.close(1001, 'Connection timeout');
        this.removeConnection(connectionId);
      }
    }

    if (staleConnections.length > 0) {
      logger.info('Cleaned up stale WebSocket connections', {
        count: staleConnections.length,
        remaining: this.connections.size,
      });
    }
  }

  /**
   * Send ping to all connections
   */
  pingAllConnections(): void {
    for (const connection of this.connections.values()) {
      if (connection.isConnectionAlive()) {
        connection.ping();
      }
    }
  }
}
