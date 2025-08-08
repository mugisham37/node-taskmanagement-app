import { WebSocketConnectionManager } from './websocket-connection-manager';
import { WebSocketAuthenticator } from './websocket-authenticator';
import { logger } from '@/infrastructure/logging/logger';
import { EventEmitter } from 'events';

export interface BroadcastEvent {
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
  target: {
    type: 'workspace' | 'project' | 'user' | 'role' | 'global';
    id: string;
    excludeUsers?: string[];
  };
  priority: 'high' | 'normal' | 'low';
  persistent: boolean;
  ttl?: number; // Time to live in milliseconds
}

export interface EventFilter {
  eventTypes?: string[];
  workspaceIds?: string[];
  projectIds?: string[];
  userIds?: string[];
  minPriority?: 'high' | 'normal' | 'low';
}

export interface BroadcastResult {
  eventId: string;
  delivered: number;
  failed: number;
  filtered: number;
  duration: number;
}

export class EventBroadcaster extends EventEmitter {
  private connectionManager: WebSocketConnectionManager;
  private authenticator: WebSocketAuthenticator;
  private eventStore: Map<string, BroadcastEvent> = new Map();
  private eventFilters: Map<string, EventFilter> = new Map();
  private deliveryQueue: BroadcastEvent[] = [];
  private isProcessingQueue: boolean = false;
  private metrics = {
    totalEvents: 0,
    deliveredEvents: 0,
    failedEvents: 0,
    filteredEvents: 0,
  };

  constructor(
    connectionManager: WebSocketConnectionManager,
    authenticator: WebSocketAuthenticator
  ) {
    super();
    this.connectionManager = connectionManager;
    this.authenticator = authenticator;

    this.startEventCleanup();
    this.startQueueProcessor();

    logger.info('Event broadcaster initialized');
  }

  /**
   * Broadcast event to specified targets
   */
  async broadcast(
    event: Omit<BroadcastEvent, 'id' | 'timestamp'>
  ): Promise<BroadcastResult> {
    const startTime = Date.now();
    const broadcastEvent: BroadcastEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
    };

    this.metrics.totalEvents++;

    try {
      // Store event if persistent
      if (broadcastEvent.persistent) {
        this.storeEvent(broadcastEvent);
      }

      // Add to delivery queue based on priority
      this.queueEvent(broadcastEvent);

      // Process immediately if high priority
      if (broadcastEvent.priority === 'high') {
        await this.processEvent(broadcastEvent);
      }

      const result: BroadcastResult = {
        eventId: broadcastEvent.id,
        delivered: 0,
        failed: 0,
        filtered: 0,
        duration: Date.now() - startTime,
      };

      logger.debug('Event broadcast initiated', {
        eventId: broadcastEvent.id,
        type: broadcastEvent.type,
        target: broadcastEvent.target,
        priority: broadcastEvent.priority,
      });

      return result;
    } catch (error) {
      logger.error('Error broadcasting event', {
        error: error instanceof Error ? error.message : String(error),
        eventId: broadcastEvent.id,
      });

      this.metrics.failedEvents++;
      throw error;
    }
  }

  /**
   * Broadcast task update event
   */
  async broadcastTaskUpdate(taskData: {
    taskId: string;
    projectId: string;
    workspaceId: string;
    action: 'created' | 'updated' | 'deleted' | 'assigned' | 'completed';
    task: any;
    userId: string;
  }): Promise<BroadcastResult> {
    return await this.broadcast({
      type: 'task',
      event: 'task.updated',
      data: {
        taskId: taskData.taskId,
        action: taskData.action,
        task: taskData.task,
      },
      source: {
        userId: taskData.userId,
        workspaceId: taskData.workspaceId,
        projectId: taskData.projectId,
      },
      target: {
        type: 'project',
        id: taskData.projectId,
        excludeUsers: [taskData.userId],
      },
      priority: 'normal',
      persistent: true,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    });
  }

  /**
   * Broadcast comment added event
   */
  async broadcastCommentAdded(commentData: {
    commentId: string;
    taskId: string;
    projectId: string;
    workspaceId: string;
    comment: any;
    userId: string;
  }): Promise<BroadcastResult> {
    return await this.broadcast({
      type: 'comment',
      event: 'comment.added',
      data: {
        commentId: commentData.commentId,
        taskId: commentData.taskId,
        comment: commentData.comment,
      },
      source: {
        userId: commentData.userId,
        workspaceId: commentData.workspaceId,
        projectId: commentData.projectId,
      },
      target: {
        type: 'project',
        id: commentData.projectId,
        excludeUsers: [commentData.userId],
      },
      priority: 'normal',
      persistent: true,
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  /**
   * Broadcast assignment event
   */
  async broadcastTaskAssignment(assignmentData: {
    taskId: string;
    projectId: string;
    workspaceId: string;
    assigneeId: string;
    assignedBy: string;
    task: any;
  }): Promise<BroadcastResult> {
    return await this.broadcast({
      type: 'assignment',
      event: 'task.assigned',
      data: {
        taskId: assignmentData.taskId,
        assigneeId: assignmentData.assigneeId,
        task: assignmentData.task,
      },
      source: {
        userId: assignmentData.assignedBy,
        workspaceId: assignmentData.workspaceId,
        projectId: assignmentData.projectId,
      },
      target: {
        type: 'user',
        id: assignmentData.assigneeId,
      },
      priority: 'high',
      persistent: true,
      ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }

  /**
   * Broadcast workspace-level event
   */
  async broadcastWorkspaceEvent(eventData: {
    workspaceId: string;
    event: string;
    data: any;
    userId: string;
    priority?: 'high' | 'normal' | 'low';
    excludeUsers?: string[];
  }): Promise<BroadcastResult> {
    return await this.broadcast({
      type: 'workspace',
      event: eventData.event,
      data: eventData.data,
      source: {
        userId: eventData.userId,
        workspaceId: eventData.workspaceId,
      },
      target: {
        type: 'workspace',
        id: eventData.workspaceId,
        excludeUsers: eventData.excludeUsers || [eventData.userId],
      },
      priority: eventData.priority || 'normal',
      persistent: true,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    });
  }

  /**
   * Set event filter for a connection
   */
  setEventFilter(connectionId: string, filter: EventFilter): void {
    this.eventFilters.set(connectionId, filter);

    logger.debug('Event filter set for connection', {
      connectionId,
      filter,
    });
  }

  /**
   * Remove event filter for a connection
   */
  removeEventFilter(connectionId: string): void {
    this.eventFilters.delete(connectionId);

    logger.debug('Event filter removed for connection', {
      connectionId,
    });
  }

  /**
   * Get stored events for offline user replay
   */
  getStoredEvents(
    userId: string,
    since: number,
    filter?: EventFilter
  ): BroadcastEvent[] {
    const userEvents: BroadcastEvent[] = [];

    for (const event of this.eventStore.values()) {
      // Check if event is relevant to user
      if (!this.isEventRelevantToUser(event, userId)) {
        continue;
      }

      // Check timestamp
      if (event.timestamp < since) {
        continue;
      }

      // Apply filter if provided
      if (filter && !this.passesFilter(event, filter)) {
        continue;
      }

      userEvents.push(event);
    }

    // Sort by timestamp
    userEvents.sort((a, b) => a.timestamp - b.timestamp);

    logger.debug('Retrieved stored events for user', {
      userId,
      since: new Date(since).toISOString(),
      eventCount: userEvents.length,
    });

    return userEvents;
  }

  /**
   * Get broadcaster metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      storedEvents: this.eventStore.size,
      queuedEvents: this.deliveryQueue.length,
      activeFilters: this.eventFilters.size,
    };
  }

  /**
   * Process a single event
   */
  private async processEvent(event: BroadcastEvent): Promise<void> {
    try {
      let connections: any[] = [];

      // Get target connections based on event target
      switch (event.target.type) {
        case 'workspace':
          connections = this.connectionManager.getConnectionsByWorkspace(
            event.target.id
          );
          break;
        case 'project':
          connections = this.connectionManager.getConnectionsByProject(
            event.target.id
          );
          break;
        case 'user':
          connections = this.connectionManager.getConnectionsByUser(
            event.target.id
          );
          break;
        case 'global':
          connections = this.connectionManager.getAllConnections();
          break;
      }

      // Filter connections
      const filteredConnections = connections.filter(conn => {
        const user = conn.getUser();

        // Exclude specified users
        if (event.target.excludeUsers?.includes(user.id)) {
          return false;
        }

        // Apply connection-specific filters
        const filter = this.eventFilters.get(conn.getId());
        if (filter && !this.passesFilter(event, filter)) {
          this.metrics.filteredEvents++;
          return false;
        }

        return true;
      });

      // Send event to filtered connections
      const sendPromises = filteredConnections.map(async conn => {
        try {
          await conn.send(event.event, event.data, {
            priority: event.priority === 'high' ? 'high' : 'normal',
          });
          this.metrics.deliveredEvents++;
        } catch (error) {
          logger.error('Failed to send event to connection', {
            error: error instanceof Error ? error.message : String(error),
            connectionId: conn.getId(),
            eventId: event.id,
          });
          this.metrics.failedEvents++;
        }
      });

      await Promise.allSettled(sendPromises);

      logger.debug('Event processed', {
        eventId: event.id,
        targetConnections: connections.length,
        filteredConnections: filteredConnections.length,
        delivered: filteredConnections.length,
      });
    } catch (error) {
      logger.error('Error processing event', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.id,
      });
      this.metrics.failedEvents++;
    }
  }

  /**
   * Queue event for processing
   */
  private queueEvent(event: BroadcastEvent): void {
    // Insert based on priority
    if (event.priority === 'high') {
      this.deliveryQueue.unshift(event);
    } else {
      this.deliveryQueue.push(event);
    }

    // Start processing if not already running
    if (!this.isProcessingQueue) {
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Process event queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.deliveryQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.deliveryQueue.length > 0) {
        const event = this.deliveryQueue.shift();
        if (event) {
          await this.processEvent(event);
        }
      }
    } catch (error) {
      logger.error('Error processing event queue', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Store event for persistence
   */
  private storeEvent(event: BroadcastEvent): void {
    this.eventStore.set(event.id, event);

    // Set TTL cleanup if specified
    if (event.ttl) {
      setTimeout(() => {
        this.eventStore.delete(event.id);
      }, event.ttl);
    }
  }

  /**
   * Check if event passes filter
   */
  private passesFilter(event: BroadcastEvent, filter: EventFilter): boolean {
    // Check event types
    if (filter.eventTypes && !filter.eventTypes.includes(event.event)) {
      return false;
    }

    // Check workspace IDs
    if (
      filter.workspaceIds &&
      event.source.workspaceId &&
      !filter.workspaceIds.includes(event.source.workspaceId)
    ) {
      return false;
    }

    // Check project IDs
    if (
      filter.projectIds &&
      event.source.projectId &&
      !filter.projectIds.includes(event.source.projectId)
    ) {
      return false;
    }

    // Check user IDs
    if (filter.userIds && !filter.userIds.includes(event.source.userId)) {
      return false;
    }

    // Check priority
    if (filter.minPriority) {
      const priorityOrder = { low: 0, normal: 1, high: 2 };
      if (priorityOrder[event.priority] < priorityOrder[filter.minPriority]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if event is relevant to user
   */
  private isEventRelevantToUser(
    event: BroadcastEvent,
    userId: string
  ): boolean {
    // Direct user target
    if (event.target.type === 'user' && event.target.id === userId) {
      return true;
    }

    // Check if user is in workspace/project
    const userConnections = this.connectionManager.getConnectionsByUser(userId);
    if (userConnections.length === 0) {
      return false;
    }

    const user = userConnections[0].getUser();

    // Workspace events
    if (
      event.target.type === 'workspace' &&
      user.workspaceId === event.target.id
    ) {
      return true;
    }

    // Project events - would need to check project membership
    if (event.target.type === 'project') {
      // This would require checking if user is member of project
      // For now, assume relevance based on workspace
      return user.workspaceId === event.source.workspaceId;
    }

    return false;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessingQueue && this.deliveryQueue.length > 0) {
        this.processQueue();
      }
    }, 100); // Process queue every 100ms
  }

  /**
   * Start event cleanup for expired events
   */
  private startEventCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredEvents: string[] = [];

      for (const [eventId, event] of this.eventStore) {
        if (event.ttl && event.timestamp + event.ttl < now) {
          expiredEvents.push(eventId);
        }
      }

      for (const eventId of expiredEvents) {
        this.eventStore.delete(eventId);
      }

      if (expiredEvents.length > 0) {
        logger.debug('Cleaned up expired events', {
          count: expiredEvents.length,
          remaining: this.eventStore.size,
        });
      }
    }, 60000); // Cleanup every minute
  }
}
