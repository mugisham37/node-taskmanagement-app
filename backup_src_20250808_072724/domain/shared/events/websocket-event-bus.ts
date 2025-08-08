import { DomainEvent } from './domain-event';
import { IntegrationEvent } from './integration-event';
import { logger } from '@/infrastructure/logging/logger';

export interface WebSocketEvent {
  id: string;
  type: string;
  event: string;
  data: any;
  timestamp: number;
  source: {
    userId: string;
    workspaceId?: string;
    projectId?: string;
  };
  target: WebSocketEventTarget;
  priority: 'high' | 'normal' | 'low';
  persistent: boolean;
  ttl?: number;
}

export interface WebSocketEventTarget {
  type: 'workspace' | 'project' | 'user' | 'role' | 'global';
  id: string;
  excludeUsers?: string[];
}

export interface WebSocketEventBus {
  broadcast(event: WebSocketEvent): Promise<void>;
  broadcastToRoom(room: string, event: WebSocketEvent): Promise<void>;
  broadcastToUser(userId: string, event: WebSocketEvent): Promise<void>;
  broadcastToWorkspace(
    workspaceId: string,
    event: WebSocketEvent
  ): Promise<void>;
  broadcastToProject(projectId: string, event: WebSocketEvent): Promise<void>;

  // Integration with domain events
  publishDomainEvent(domainEvent: DomainEvent): Promise<void>;
  publishIntegrationEvent(integrationEvent: IntegrationEvent): Promise<void>;

  // Connection management
  addConnection(connection: WebSocketConnection): void;
  removeConnection(connectionId: string): void;
  getConnection(connectionId: string): WebSocketConnection | null;
  getConnectionsByUser(userId: string): WebSocketConnection[];
  getConnectionsByWorkspace(workspaceId: string): WebSocketConnection[];
  getConnectionsByProject(projectId: string): WebSocketConnection[];

  // Metrics
  getMetrics(): WebSocketEventBusMetrics;
}

export interface WebSocketConnection {
  id: string;
  userId: string;
  workspaceId?: string;
  projectIds: string[];
  roles: string[];
  isAuthenticated: boolean;
  connectedAt: Date;
  lastActivity: Date;

  send(
    event: string,
    data: any,
    options?: { priority?: 'high' | 'normal' }
  ): Promise<void>;
  close(reason?: string): void;
  ping(): Promise<boolean>;

  // Presence tracking
  updatePresence(presence: UserPresence): void;
  getPresence(): UserPresence;
}

export interface UserPresence {
  status: 'online' | 'away' | 'busy' | 'offline';
  location?: {
    type: 'workspace' | 'project' | 'task';
    id: string;
    name?: string;
  };
  activity?: {
    type: 'viewing' | 'editing' | 'commenting';
    target: string;
    startedAt: Date;
  };
  customStatus?: string;
  lastSeen: Date;
}

export interface WebSocketEventBusMetrics {
  totalConnections: number;
  authenticatedConnections: number;
  totalEventsBroadcast: number;
  totalEventsDelivered: number;
  totalEventsFailed: number;
  averageDeliveryTime: number;
  presenceUpdates: number;
}

export class DefaultWebSocketEventBus implements WebSocketEventBus {
  private connections = new Map<string, WebSocketConnection>();
  private userConnections = new Map<string, Set<string>>();
  private workspaceConnections = new Map<string, Set<string>>();
  private projectConnections = new Map<string, Set<string>>();
  private presenceData = new Map<string, UserPresence>();

  private metrics: WebSocketEventBusMetrics = {
    totalConnections: 0,
    authenticatedConnections: 0,
    totalEventsBroadcast: 0,
    totalEventsDelivered: 0,
    totalEventsFailed: 0,
    averageDeliveryTime: 0,
    presenceUpdates: 0,
  };

  private deliveryTimes: number[] = [];

  async broadcast(event: WebSocketEvent): Promise<void> {
    const startTime = Date.now();
    this.metrics.totalEventsBroadcast++;

    try {
      let targetConnections: WebSocketConnection[] = [];

      // Get target connections based on event target
      switch (event.target.type) {
        case 'workspace':
          targetConnections = this.getConnectionsByWorkspace(event.target.id);
          break;
        case 'project':
          targetConnections = this.getConnectionsByProject(event.target.id);
          break;
        case 'user':
          targetConnections = this.getConnectionsByUser(event.target.id);
          break;
        case 'global':
          targetConnections = Array.from(this.connections.values());
          break;
        case 'role':
          targetConnections = this.getConnectionsByRole(event.target.id);
          break;
      }

      // Filter out excluded users
      if (event.target.excludeUsers && event.target.excludeUsers.length > 0) {
        targetConnections = targetConnections.filter(
          conn => !event.target.excludeUsers!.includes(conn.userId)
        );
      }

      // Send event to all target connections
      const sendPromises = targetConnections.map(async connection => {
        try {
          await connection.send(event.event, event.data, {
            priority: event.priority === 'high' ? 'high' : 'normal',
          });
          this.metrics.totalEventsDelivered++;
        } catch (error) {
          this.metrics.totalEventsFailed++;
          logger.error('Failed to send WebSocket event to connection', {
            error: error instanceof Error ? error.message : String(error),
            connectionId: connection.id,
            userId: connection.userId,
            eventId: event.id,
            eventType: event.type,
          });
        }
      });

      await Promise.allSettled(sendPromises);

      // Update metrics
      const deliveryTime = Date.now() - startTime;
      this.deliveryTimes.push(deliveryTime);

      if (this.deliveryTimes.length > 100) {
        this.deliveryTimes.shift();
      }

      this.metrics.averageDeliveryTime =
        this.deliveryTimes.reduce((sum, time) => sum + time, 0) /
        this.deliveryTimes.length;

      logger.debug('WebSocket event broadcast completed', {
        eventId: event.id,
        eventType: event.type,
        targetType: event.target.type,
        targetId: event.target.id,
        connectionCount: targetConnections.length,
        deliveryTime,
      });
    } catch (error) {
      this.metrics.totalEventsFailed++;
      logger.error('Error broadcasting WebSocket event', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.id,
        eventType: event.type,
      });
      throw error;
    }
  }

  async broadcastToRoom(room: string, event: WebSocketEvent): Promise<void> {
    // Room-based broadcasting (could be workspace, project, or custom room)
    const roomEvent: WebSocketEvent = {
      ...event,
      target: {
        type: 'workspace', // Assuming room maps to workspace for now
        id: room,
      },
    };

    await this.broadcast(roomEvent);
  }

  async broadcastToUser(userId: string, event: WebSocketEvent): Promise<void> {
    const userEvent: WebSocketEvent = {
      ...event,
      target: {
        type: 'user',
        id: userId,
      },
    };

    await this.broadcast(userEvent);
  }

  async broadcastToWorkspace(
    workspaceId: string,
    event: WebSocketEvent
  ): Promise<void> {
    const workspaceEvent: WebSocketEvent = {
      ...event,
      target: {
        type: 'workspace',
        id: workspaceId,
      },
    };

    await this.broadcast(workspaceEvent);
  }

  async broadcastToProject(
    projectId: string,
    event: WebSocketEvent
  ): Promise<void> {
    const projectEvent: WebSocketEvent = {
      ...event,
      target: {
        type: 'project',
        id: projectId,
      },
    };

    await this.broadcast(projectEvent);
  }

  async publishDomainEvent(domainEvent: DomainEvent): Promise<void> {
    // Convert domain event to WebSocket event
    const websocketEvent: WebSocketEvent = {
      id: `ws_${domainEvent.eventId}`,
      type: 'domain',
      event: domainEvent.eventName,
      data: {
        eventId: domainEvent.eventId,
        aggregateId: domainEvent.getAggregateId(),
        aggregateType: domainEvent.getAggregateType(),
        eventData: domainEvent.getEventData(),
        occurredAt: domainEvent.occurredAt,
      },
      timestamp: domainEvent.occurredAt.getTime(),
      source: {
        userId: 'system', // Domain events are system-generated
        workspaceId: this.extractWorkspaceId(domainEvent),
        projectId: this.extractProjectId(domainEvent),
      },
      target: {
        type: 'workspace',
        id: this.extractWorkspaceId(domainEvent) || 'global',
      },
      priority: 'normal',
      persistent: true,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    };

    await this.broadcast(websocketEvent);

    logger.debug('Domain event published to WebSocket', {
      domainEventId: domainEvent.eventId,
      domainEventName: domainEvent.eventName,
      websocketEventId: websocketEvent.id,
    });
  }

  async publishIntegrationEvent(
    integrationEvent: IntegrationEvent
  ): Promise<void> {
    // Convert integration event to WebSocket event
    const websocketEvent: WebSocketEvent = {
      id: `ws_${integrationEvent.eventId}`,
      type: 'integration',
      event: integrationEvent.eventName,
      data: {
        eventId: integrationEvent.eventId,
        eventVersion: integrationEvent.eventVersion,
        eventData: integrationEvent.getEventData(),
        source: integrationEvent.source,
        routingKey: integrationEvent.getRoutingKey(),
        occurredAt: integrationEvent.occurredAt,
      },
      timestamp: integrationEvent.occurredAt.getTime(),
      source: {
        userId: integrationEvent.source.userId || 'system',
        workspaceId: integrationEvent.source.workspaceId,
      },
      target: {
        type: 'workspace',
        id: integrationEvent.source.workspaceId || 'global',
      },
      priority: 'normal',
      persistent: true,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    };

    await this.broadcast(websocketEvent);

    logger.debug('Integration event published to WebSocket', {
      integrationEventId: integrationEvent.eventId,
      integrationEventName: integrationEvent.eventName,
      websocketEventId: websocketEvent.id,
    });
  }

  addConnection(connection: WebSocketConnection): void {
    this.connections.set(connection.id, connection);
    this.metrics.totalConnections++;

    if (connection.isAuthenticated) {
      this.metrics.authenticatedConnections++;
    }

    // Index by user
    if (!this.userConnections.has(connection.userId)) {
      this.userConnections.set(connection.userId, new Set());
    }
    this.userConnections.get(connection.userId)!.add(connection.id);

    // Index by workspace
    if (connection.workspaceId) {
      if (!this.workspaceConnections.has(connection.workspaceId)) {
        this.workspaceConnections.set(connection.workspaceId, new Set());
      }
      this.workspaceConnections.get(connection.workspaceId)!.add(connection.id);
    }

    // Index by projects
    connection.projectIds.forEach(projectId => {
      if (!this.projectConnections.has(projectId)) {
        this.projectConnections.set(projectId, new Set());
      }
      this.projectConnections.get(projectId)!.add(connection.id);
    });

    // Initialize presence
    this.presenceData.set(connection.userId, {
      status: 'online',
      lastSeen: new Date(),
    });

    logger.info('WebSocket connection added', {
      connectionId: connection.id,
      userId: connection.userId,
      workspaceId: connection.workspaceId,
      projectCount: connection.projectIds.length,
      isAuthenticated: connection.isAuthenticated,
    });
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.connections.delete(connectionId);
    this.metrics.totalConnections--;

    if (connection.isAuthenticated) {
      this.metrics.authenticatedConnections--;
    }

    // Remove from user index
    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId);

        // Update presence to offline if no more connections
        const presence = this.presenceData.get(connection.userId);
        if (presence) {
          presence.status = 'offline';
          presence.lastSeen = new Date();
          this.presenceData.set(connection.userId, presence);
        }
      }
    }

    // Remove from workspace index
    if (connection.workspaceId) {
      const workspaceConnections = this.workspaceConnections.get(
        connection.workspaceId
      );
      if (workspaceConnections) {
        workspaceConnections.delete(connectionId);
        if (workspaceConnections.size === 0) {
          this.workspaceConnections.delete(connection.workspaceId);
        }
      }
    }

    // Remove from project indexes
    connection.projectIds.forEach(projectId => {
      const projectConnections = this.projectConnections.get(projectId);
      if (projectConnections) {
        projectConnections.delete(connectionId);
        if (projectConnections.size === 0) {
          this.projectConnections.delete(projectId);
        }
      }
    });

    logger.info('WebSocket connection removed', {
      connectionId,
      userId: connection.userId,
      workspaceId: connection.workspaceId,
    });
  }

  getConnection(connectionId: string): WebSocketConnection | null {
    return this.connections.get(connectionId) || null;
  }

  getConnectionsByUser(userId: string): WebSocketConnection[] {
    const connectionIds = this.userConnections.get(userId) || new Set();
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  getConnectionsByWorkspace(workspaceId: string): WebSocketConnection[] {
    const connectionIds =
      this.workspaceConnections.get(workspaceId) || new Set();
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  getConnectionsByProject(projectId: string): WebSocketConnection[] {
    const connectionIds = this.projectConnections.get(projectId) || new Set();
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  private getConnectionsByRole(role: string): WebSocketConnection[] {
    return Array.from(this.connections.values()).filter(conn =>
      conn.roles.includes(role)
    );
  }

  getMetrics(): WebSocketEventBusMetrics {
    return { ...this.metrics };
  }

  // Presence management
  updateUserPresence(userId: string, presence: Partial<UserPresence>): void {
    const currentPresence = this.presenceData.get(userId) || {
      status: 'offline',
      lastSeen: new Date(),
    };

    const updatedPresence: UserPresence = {
      ...currentPresence,
      ...presence,
      lastSeen: new Date(),
    };

    this.presenceData.set(userId, updatedPresence);
    this.metrics.presenceUpdates++;

    // Broadcast presence update
    const presenceEvent: WebSocketEvent = {
      id: `presence_${Date.now()}_${userId}`,
      type: 'presence',
      event: 'presence.updated',
      data: {
        userId,
        presence: updatedPresence,
      },
      timestamp: Date.now(),
      source: {
        userId,
        workspaceId: this.getConnectionsByUser(userId)[0]?.workspaceId,
      },
      target: {
        type: 'workspace',
        id: this.getConnectionsByUser(userId)[0]?.workspaceId || 'global',
        excludeUsers: [userId],
      },
      priority: 'low',
      persistent: false,
    };

    this.broadcast(presenceEvent).catch(error => {
      logger.error('Error broadcasting presence update', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
    });

    logger.debug('User presence updated', {
      userId,
      status: updatedPresence.status,
      location: updatedPresence.location,
    });
  }

  getUserPresence(userId: string): UserPresence | null {
    return this.presenceData.get(userId) || null;
  }

  getAllPresence(): Map<string, UserPresence> {
    return new Map(this.presenceData);
  }

  // Utility methods
  private extractWorkspaceId(domainEvent: DomainEvent): string | undefined {
    const eventData = domainEvent.getEventData();
    return eventData.workspaceId;
  }

  private extractProjectId(domainEvent: DomainEvent): string | undefined {
    const eventData = domainEvent.getEventData();
    return eventData.projectId;
  }

  // Cleanup
  cleanup(): void {
    this.connections.clear();
    this.userConnections.clear();
    this.workspaceConnections.clear();
    this.projectConnections.clear();
    this.presenceData.clear();

    this.metrics = {
      totalConnections: 0,
      authenticatedConnections: 0,
      totalEventsBroadcast: 0,
      totalEventsDelivered: 0,
      totalEventsFailed: 0,
      averageDeliveryTime: 0,
      presenceUpdates: 0,
    };

    logger.info('WebSocket event bus cleaned up');
  }
}
