import { EventEmitter } from 'events';
import { WebSocketService, WebSocketMessage } from './websocket-service';
import { LoggingService } from '../monitoring/logging-service';
import { CacheService } from '../caching/cache-service';

export interface RealtimeEvent {
  id: string;
  type: string;
  entityType: 'task' | 'project' | 'workspace' | 'user';
  entityId: string;
  userId: string;
  action:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'assigned'
    | 'completed'
    | 'commented';
  payload: any;
  timestamp: Date;
  workspaceId?: string;
  projectId?: string;
}

export interface NotificationEvent {
  id: string;
  recipientId: string;
  type:
    | 'task_assigned'
    | 'task_completed'
    | 'project_invitation'
    | 'mention'
    | 'deadline_reminder';
  title: string;
  message: string;
  payload: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: Date;
  read: boolean;
}

export class RealtimeEventService extends EventEmitter {
  private eventHistory = new Map<string, RealtimeEvent[]>();
  private userNotifications = new Map<string, NotificationEvent[]>();

  constructor(
    private readonly webSocketService: WebSocketService,
    private readonly logger: LoggingService,
    private readonly cacheService: CacheService
  ) {
    super();
    this.setupEventHandlers();
  }

  async publishEvent(event: RealtimeEvent): Promise<void> {
    try {
      // Store event in history
      this.addToEventHistory(event);

      // Cache event for offline users
      await this.cacheEvent(event);

      // Determine channels to broadcast to
      const channels = this.getChannelsForEvent(event);

      // Create WebSocket message
      const message: WebSocketMessage = {
        type: 'realtime_event',
        payload: event,
        timestamp: event.timestamp.toISOString(),
        messageId: this.generateMessageId(),
        userId: event.userId,
      };

      // Broadcast to relevant channels
      let totalRecipients = 0;
      channels.forEach(channel => {
        const recipients = this.webSocketService.broadcastToChannel(
          channel,
          message
        );
        totalRecipients += recipients;
      });

      this.logger.info('Realtime event published', {
        eventId: event.id,
        eventType: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        channels: channels.length,
        recipients: totalRecipients,
      });

      this.emit('event:published', event);
    } catch (error) {
      this.logger.error('Failed to publish realtime event', error as Error, {
        eventId: event.id,
        eventType: event.type,
      });
      throw error;
    }
  }

  async publishNotification(notification: NotificationEvent): Promise<void> {
    try {
      // Store notification
      this.addToUserNotifications(notification);

      // Cache notification
      await this.cacheNotification(notification);

      // Send to user if online
      const message: WebSocketMessage = {
        type: 'notification',
        payload: notification,
        timestamp: notification.timestamp.toISOString(),
        messageId: this.generateMessageId(),
      };

      const sent = this.webSocketService.sendToUser(
        notification.recipientId,
        message
      );

      this.logger.info('Notification published', {
        notificationId: notification.id,
        recipientId: notification.recipientId,
        type: notification.type,
        priority: notification.priority,
        delivered: sent > 0,
      });

      this.emit('notification:published', notification);
    } catch (error) {
      this.logger.error('Failed to publish notification', error as Error, {
        notificationId: notification.id,
        recipientId: notification.recipientId,
      });
      throw error;
    }
  }

  // Task-related events
  async publishTaskCreated(
    taskId: string,
    userId: string,
    projectId: string,
    workspaceId: string,
    taskData: any
  ): Promise<void> {
    const event: RealtimeEvent = {
      id: this.generateEventId(),
      type: 'task_created',
      entityType: 'task',
      entityId: taskId,
      userId,
      action: 'created',
      payload: taskData,
      timestamp: new Date(),
      workspaceId,
      projectId,
    };

    await this.publishEvent(event);
  }

  async publishTaskAssigned(
    taskId: string,
    assigneeId: string,
    assignerId: string,
    projectId: string,
    workspaceId: string,
    taskData: any
  ): Promise<void> {
    const event: RealtimeEvent = {
      id: this.generateEventId(),
      type: 'task_assigned',
      entityType: 'task',
      entityId: taskId,
      userId: assignerId,
      action: 'assigned',
      payload: { ...taskData, assigneeId },
      timestamp: new Date(),
      workspaceId,
      projectId,
    };

    await this.publishEvent(event);

    // Send notification to assignee
    const notification: NotificationEvent = {
      id: this.generateEventId(),
      recipientId: assigneeId,
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: `You have been assigned a new task: ${taskData.title}`,
      payload: { taskId, projectId, workspaceId },
      priority: 'medium',
      timestamp: new Date(),
      read: false,
    };

    await this.publishNotification(notification);
  }

  async publishTaskCompleted(
    taskId: string,
    userId: string,
    projectId: string,
    workspaceId: string,
    taskData: any
  ): Promise<void> {
    const event: RealtimeEvent = {
      id: this.generateEventId(),
      type: 'task_completed',
      entityType: 'task',
      entityId: taskId,
      userId,
      action: 'completed',
      payload: taskData,
      timestamp: new Date(),
      workspaceId,
      projectId,
    };

    await this.publishEvent(event);
  }

  async publishTaskUpdated(
    taskId: string,
    userId: string,
    projectId: string,
    workspaceId: string,
    changes: any
  ): Promise<void> {
    const event: RealtimeEvent = {
      id: this.generateEventId(),
      type: 'task_updated',
      entityType: 'task',
      entityId: taskId,
      userId,
      action: 'updated',
      payload: changes,
      timestamp: new Date(),
      workspaceId,
      projectId,
    };

    await this.publishEvent(event);
  }

  // Project-related events
  async publishProjectCreated(
    projectId: string,
    userId: string,
    workspaceId: string,
    projectData: any
  ): Promise<void> {
    const event: RealtimeEvent = {
      id: this.generateEventId(),
      type: 'project_created',
      entityType: 'project',
      entityId: projectId,
      userId,
      action: 'created',
      payload: projectData,
      timestamp: new Date(),
      workspaceId,
    };

    await this.publishEvent(event);
  }

  async publishProjectMemberAdded(
    projectId: string,
    memberId: string,
    addedById: string,
    workspaceId: string,
    memberData: any
  ): Promise<void> {
    const event: RealtimeEvent = {
      id: this.generateEventId(),
      type: 'project_member_added',
      entityType: 'project',
      entityId: projectId,
      userId: addedById,
      action: 'updated',
      payload: { memberId, ...memberData },
      timestamp: new Date(),
      workspaceId,
      projectId,
    };

    await this.publishEvent(event);

    // Send notification to new member
    const notification: NotificationEvent = {
      id: this.generateEventId(),
      recipientId: memberId,
      type: 'project_invitation',
      title: 'Added to Project',
      message: `You have been added to project: ${memberData.projectName}`,
      payload: { projectId, workspaceId },
      priority: 'medium',
      timestamp: new Date(),
      read: false,
    };

    await this.publishNotification(notification);
  }

  // User presence events
  async publishUserPresenceUpdate(
    userId: string,
    status: string,
    metadata?: any
  ): Promise<void> {
    const message: WebSocketMessage = {
      type: 'user_presence',
      payload: {
        userId,
        status,
        metadata,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
      userId,
    };

    // Broadcast to presence channel
    this.webSocketService.broadcastToChannel(`presence:${userId}`, message);
  }

  // Collaborative editing events
  async publishDocumentEdit(
    documentId: string,
    userId: string,
    operation: any,
    documentType: 'task' | 'project'
  ): Promise<void> {
    const message: WebSocketMessage = {
      type: 'document_edit',
      payload: {
        documentId,
        documentType,
        userId,
        operation,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
      userId,
      channel: `document:${documentId}`,
    };

    this.webSocketService.broadcastToChannel(`document:${documentId}`, message);
  }

  // Get events and notifications
  getEventHistory(entityId: string, limit: number = 50): RealtimeEvent[] {
    const events = this.eventHistory.get(entityId) || [];
    return events.slice(-limit);
  }

  getUserNotifications(
    userId: string,
    unreadOnly: boolean = false
  ): NotificationEvent[] {
    const notifications = this.userNotifications.get(userId) || [];
    return unreadOnly ? notifications.filter(n => !n.read) : notifications;
  }

  async markNotificationAsRead(
    notificationId: string,
    userId: string
  ): Promise<boolean> {
    const notifications = this.userNotifications.get(userId) || [];
    const notification = notifications.find(n => n.id === notificationId);

    if (notification) {
      notification.read = true;
      await this.cacheNotification(notification);
      return true;
    }

    return false;
  }

  private getChannelsForEvent(event: RealtimeEvent): string[] {
    const channels: string[] = [];

    // Entity-specific channel
    channels.push(`${event.entityType}:${event.entityId}`);

    // Project-specific channel
    if (event.projectId) {
      channels.push(`project:${event.projectId}`);
    }

    // Workspace-specific channel
    if (event.workspaceId) {
      channels.push(`workspace:${event.workspaceId}`);
    }

    // User-specific channel
    channels.push(`user:${event.userId}`);

    return channels;
  }

  private addToEventHistory(event: RealtimeEvent): void {
    if (!this.eventHistory.has(event.entityId)) {
      this.eventHistory.set(event.entityId, []);
    }

    const events = this.eventHistory.get(event.entityId)!;
    events.push(event);

    // Keep only last 100 events per entity
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
  }

  private addToUserNotifications(notification: NotificationEvent): void {
    if (!this.userNotifications.has(notification.recipientId)) {
      this.userNotifications.set(notification.recipientId, []);
    }

    const notifications = this.userNotifications.get(notification.recipientId)!;
    notifications.push(notification);

    // Keep only last 50 notifications per user
    if (notifications.length > 50) {
      notifications.splice(0, notifications.length - 50);
    }
  }

  private async cacheEvent(event: RealtimeEvent): Promise<void> {
    const key = `event:${event.entityId}:${event.id}`;
    await this.cacheService.set(key, JSON.stringify(event), 3600); // 1 hour TTL
  }

  private async cacheNotification(
    notification: NotificationEvent
  ): Promise<void> {
    const key = `notification:${notification.recipientId}:${notification.id}`;
    await this.cacheService.set(key, JSON.stringify(notification), 86400); // 24 hours TTL
  }

  private setupEventHandlers(): void {
    this.webSocketService.on('connection:added', connection => {
      // Send cached notifications to newly connected user
      this.sendCachedNotifications(connection.userId);
    });
  }

  private async sendCachedNotifications(userId: string): Promise<void> {
    try {
      const notifications = this.getUserNotifications(userId, true);

      for (const notification of notifications) {
        const message: WebSocketMessage = {
          type: 'notification',
          payload: notification,
          timestamp: notification.timestamp.toISOString(),
          messageId: this.generateMessageId(),
        };

        this.webSocketService.sendToUser(userId, message);
      }
    } catch (error) {
      this.logger.error('Failed to send cached notifications', error as Error, {
        userId,
      });
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
