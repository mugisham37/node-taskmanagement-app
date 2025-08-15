export interface RealtimeEvent {
  id: string;
  type: string;
  entityType: 'task' | 'project' | 'workspace' | 'user';
  entityId: string;
  userId: string;
  action: 'created' | 'updated' | 'deleted' | 'assigned' | 'completed' | 'commented';
  payload: any;
  timestamp: Date;
  workspaceId?: string;
  projectId?: string;
}

export interface NotificationEvent {
  id: string;
  recipientId: string;
  type: 'task_assigned' | 'task_completed' | 'project_invitation' | 'mention' | 'deadline_reminder';
  title: string;
  message: string;
  payload: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: Date;
  read: boolean;
}

export interface RealtimeService {
  /**
   * Publish a realtime event
   */
  publishEvent(event: RealtimeEvent): Promise<void>;

  /**
   * Publish a notification
   */
  publishNotification(notification: NotificationEvent): Promise<void>;

  /**
   * Get event history for an entity
   */
  getEventHistory(entityId: string, limit?: number): RealtimeEvent[];

  /**
   * Get user notifications
   */
  getUserNotifications(userId: string, unreadOnly?: boolean): NotificationEvent[];

  /**
   * Mark notification as read
   */
  markNotificationAsRead(notificationId: string, userId: string): Promise<boolean>;

  /**
   * Publish user presence update
   */
  publishUserPresenceUpdate(userId: string, status: string, metadata?: any): Promise<void>;
}