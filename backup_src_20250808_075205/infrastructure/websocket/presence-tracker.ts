import { logger } from '@/infrastructure/logging/logger';
import { WebSocketConnectionManager } from './websocket-connection-manager';
import { EventBroadcaster } from './event-broadcaster';

export interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: number;
  location?: {
    type: 'workspace' | 'project' | 'task' | 'document';
    id: string;
    name?: string;
  };
  device?: {
    type: 'desktop' | 'mobile' | 'tablet';
    browser?: string;
    os?: string;
  };
  customStatus?: {
    message: string;
    emoji?: string;
    expiresAt?: number;
  };
}

export interface ActivityEvent {
  id: string;
  userId: string;
  type:
    | 'view'
    | 'edit'
    | 'comment'
    | 'assign'
    | 'complete'
    | 'create'
    | 'delete';
  resource: {
    type: 'workspace' | 'project' | 'task' | 'document' | 'comment';
    id: string;
    name?: string;
  };
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TypingIndicator {
  userId: string;
  resourceId: string;
  resourceType: 'task' | 'document' | 'comment';
  isTyping: boolean;
  timestamp: number;
}

export interface ActivityFeed {
  workspaceId: string;
  activities: ActivityEvent[];
  lastUpdated: number;
  totalCount: number;
}

export class PresenceTracker {
  private userPresences: Map<string, UserPresence> = new Map();
  private workspacePresences: Map<string, Set<string>> = new Map(); // workspaceId -> userIds
  private projectPresences: Map<string, Set<string>> = new Map(); // projectId -> userIds
  private taskPresences: Map<string, Set<string>> = new Map(); // taskId -> userIds
  private typingIndicators: Map<string, Map<string, TypingIndicator>> =
    new Map(); // resourceId -> userId -> indicator
  private activityFeeds: Map<string, ActivityEvent[]> = new Map(); // workspaceId -> activities
  private connectionManager: WebSocketConnectionManager;
  private eventBroadcaster: EventBroadcaster;
  private presenceUpdateInterval: NodeJS.Timeout | null = null;
  private activityCleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    connectionManager: WebSocketConnectionManager,
    eventBroadcaster: EventBroadcaster
  ) {
    this.connectionManager = connectionManager;
    this.eventBroadcaster = eventBroadcaster;

    this.startPresenceUpdates();
    this.startActivityCleanup();

    logger.info('Presence tracker initialized');
  }

  /**
   * Update user presence
   */
  async updatePresence(
    userId: string,
    status: UserPresence['status'],
    location?: UserPresence['location'],
    device?: UserPresence['device'],
    customStatus?: UserPresence['customStatus']
  ): Promise<void> {
    const currentPresence = this.userPresences.get(userId);
    const previousStatus = currentPresence?.status;
    const previousLocation = currentPresence?.location;

    const presence: UserPresence = {
      userId,
      status,
      lastSeen: Date.now(),
      location,
      device,
      customStatus,
    };

    this.userPresences.set(userId, presence);

    // Update workspace presence
    if (location?.type === 'workspace') {
      this.updateWorkspacePresence(userId, location.id, previousLocation);
    }

    // Update project presence
    if (location?.type === 'project') {
      this.updateProjectPresence(userId, location.id, previousLocation);
    }

    // Update task presence
    if (location?.type === 'task') {
      this.updateTaskPresence(userId, location.id, previousLocation);
    }

    // Broadcast presence update if status or location changed
    if (
      previousStatus !== status ||
      previousLocation?.id !== location?.id ||
      previousLocation?.type !== location?.type
    ) {
      await this.broadcastPresenceUpdate(presence);
    }

    logger.debug('User presence updated', {
      userId,
      status,
      location,
      previousStatus,
      previousLocation,
    });
  }

  /**
   * Get user presence
   */
  getUserPresence(userId: string): UserPresence | null {
    return this.userPresences.get(userId) || null;
  }

  /**
   * Get workspace presence
   */
  getWorkspacePresence(workspaceId: string): UserPresence[] {
    const userIds = this.workspacePresences.get(workspaceId);
    if (!userIds) {
      return [];
    }

    return Array.from(userIds)
      .map(userId => this.userPresences.get(userId))
      .filter((presence): presence is UserPresence => presence !== undefined);
  }

  /**
   * Get project presence
   */
  getProjectPresence(projectId: string): UserPresence[] {
    const userIds = this.projectPresences.get(projectId);
    if (!userIds) {
      return [];
    }

    return Array.from(userIds)
      .map(userId => this.userPresences.get(userId))
      .filter((presence): presence is UserPresence => presence !== undefined);
  }

  /**
   * Get task presence
   */
  getTaskPresence(taskId: string): UserPresence[] {
    const userIds = this.taskPresences.get(taskId);
    if (!userIds) {
      return [];
    }

    return Array.from(userIds)
      .map(userId => this.userPresences.get(userId))
      .filter((presence): presence is UserPresence => presence !== undefined);
  }

  /**
   * Set user offline
   */
  async setUserOffline(userId: string): Promise<void> {
    const presence = this.userPresences.get(userId);
    if (!presence) {
      return;
    }

    presence.status = 'offline';
    presence.lastSeen = Date.now();

    // Remove from all presence maps
    this.removeFromAllPresences(userId);

    // Broadcast offline status
    await this.broadcastPresenceUpdate(presence);

    logger.debug('User set offline', { userId });
  }

  /**
   * Update typing indicator
   */
  async updateTypingIndicator(
    userId: string,
    resourceId: string,
    resourceType: TypingIndicator['resourceType'],
    isTyping: boolean
  ): Promise<void> {
    let resourceIndicators = this.typingIndicators.get(resourceId);
    if (!resourceIndicators) {
      resourceIndicators = new Map();
      this.typingIndicators.set(resourceId, resourceIndicators);
    }

    const indicator: TypingIndicator = {
      userId,
      resourceId,
      resourceType,
      isTyping,
      timestamp: Date.now(),
    };

    if (isTyping) {
      resourceIndicators.set(userId, indicator);
    } else {
      resourceIndicators.delete(userId);

      // Clean up empty resource maps
      if (resourceIndicators.size === 0) {
        this.typingIndicators.delete(resourceId);
      }
    }

    // Broadcast typing indicator update
    await this.broadcastTypingIndicator(indicator);

    logger.debug('Typing indicator updated', {
      userId,
      resourceId,
      resourceType,
      isTyping,
    });
  }

  /**
   * Get typing indicators for resource
   */
  getTypingIndicators(resourceId: string): TypingIndicator[] {
    const resourceIndicators = this.typingIndicators.get(resourceId);
    if (!resourceIndicators) {
      return [];
    }

    return Array.from(resourceIndicators.values());
  }

  /**
   * Record activity event
   */
  async recordActivity(
    userId: string,
    type: ActivityEvent['type'],
    resource: ActivityEvent['resource'],
    metadata?: Record<string, any>
  ): Promise<ActivityEvent> {
    const activity: ActivityEvent = {
      id: this.generateActivityId(),
      userId,
      type,
      resource,
      timestamp: Date.now(),
      metadata,
    };

    // Determine workspace ID from resource or user presence
    const workspaceId = await this.getWorkspaceIdForActivity(userId, resource);
    if (workspaceId) {
      let workspaceActivities = this.activityFeeds.get(workspaceId);
      if (!workspaceActivities) {
        workspaceActivities = [];
        this.activityFeeds.set(workspaceId, workspaceActivities);
      }

      workspaceActivities.unshift(activity); // Add to beginning

      // Limit activity feed size
      if (workspaceActivities.length > 1000) {
        workspaceActivities.splice(1000);
      }

      // Broadcast activity to workspace
      await this.broadcastActivity(workspaceId, activity);
    }

    logger.debug('Activity recorded', {
      activityId: activity.id,
      userId,
      type,
      resource,
      workspaceId,
    });

    return activity;
  }

  /**
   * Get activity feed for workspace
   */
  getActivityFeed(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0,
    filters?: {
      userIds?: string[];
      types?: ActivityEvent['type'][];
      resourceTypes?: ActivityEvent['resource']['type'][];
      since?: number;
    }
  ): ActivityFeed {
    let activities = this.activityFeeds.get(workspaceId) || [];

    // Apply filters
    if (filters) {
      activities = activities.filter(activity => {
        if (filters.userIds && !filters.userIds.includes(activity.userId)) {
          return false;
        }
        if (filters.types && !filters.types.includes(activity.type)) {
          return false;
        }
        if (
          filters.resourceTypes &&
          !filters.resourceTypes.includes(activity.resource.type)
        ) {
          return false;
        }
        if (filters.since && activity.timestamp < filters.since) {
          return false;
        }
        return true;
      });
    }

    const totalCount = activities.length;
    const paginatedActivities = activities.slice(offset, offset + limit);

    return {
      workspaceId,
      activities: paginatedActivities,
      lastUpdated: Date.now(),
      totalCount,
    };
  }

  /**
   * Get user activity summary
   */
  getUserActivitySummary(
    userId: string,
    workspaceId: string,
    timeRange: { start: number; end: number }
  ): {
    totalActivities: number;
    activitiesByType: Record<ActivityEvent['type'], number>;
    activitiesByResource: Record<ActivityEvent['resource']['type'], number>;
    mostActiveHour: number;
    averageActivitiesPerDay: number;
  } {
    const activities = (this.activityFeeds.get(workspaceId) || []).filter(
      activity =>
        activity.userId === userId &&
        activity.timestamp >= timeRange.start &&
        activity.timestamp <= timeRange.end
    );

    const activitiesByType: Record<string, number> = {};
    const activitiesByResource: Record<string, number> = {};
    const activitiesByHour: Record<number, number> = {};

    activities.forEach(activity => {
      // Count by type
      activitiesByType[activity.type] =
        (activitiesByType[activity.type] || 0) + 1;

      // Count by resource type
      activitiesByResource[activity.resource.type] =
        (activitiesByResource[activity.resource.type] || 0) + 1;

      // Count by hour
      const hour = new Date(activity.timestamp).getHours();
      activitiesByHour[hour] = (activitiesByHour[hour] || 0) + 1;
    });

    // Find most active hour
    const mostActiveHour = Object.entries(activitiesByHour).reduce(
      (max, [hour, count]) =>
        count > max.count ? { hour: parseInt(hour), count } : max,
      { hour: 0, count: 0 }
    ).hour;

    // Calculate average activities per day
    const daysDiff = Math.max(
      1,
      Math.ceil((timeRange.end - timeRange.start) / (24 * 60 * 60 * 1000))
    );
    const averageActivitiesPerDay = activities.length / daysDiff;

    return {
      totalActivities: activities.length,
      activitiesByType: activitiesByType as Record<
        ActivityEvent['type'],
        number
      >,
      activitiesByResource: activitiesByResource as Record<
        ActivityEvent['resource']['type'],
        number
      >,
      mostActiveHour,
      averageActivitiesPerDay,
    };
  }

  /**
   * Update workspace presence
   */
  private updateWorkspacePresence(
    userId: string,
    workspaceId: string,
    previousLocation?: UserPresence['location']
  ): void {
    // Remove from previous workspace
    if (
      previousLocation?.type === 'workspace' &&
      previousLocation.id !== workspaceId
    ) {
      const prevWorkspaceUsers = this.workspacePresences.get(
        previousLocation.id
      );
      if (prevWorkspaceUsers) {
        prevWorkspaceUsers.delete(userId);
        if (prevWorkspaceUsers.size === 0) {
          this.workspacePresences.delete(previousLocation.id);
        }
      }
    }

    // Add to current workspace
    let workspaceUsers = this.workspacePresences.get(workspaceId);
    if (!workspaceUsers) {
      workspaceUsers = new Set();
      this.workspacePresences.set(workspaceId, workspaceUsers);
    }
    workspaceUsers.add(userId);
  }

  /**
   * Update project presence
   */
  private updateProjectPresence(
    userId: string,
    projectId: string,
    previousLocation?: UserPresence['location']
  ): void {
    // Remove from previous project
    if (
      previousLocation?.type === 'project' &&
      previousLocation.id !== projectId
    ) {
      const prevProjectUsers = this.projectPresences.get(previousLocation.id);
      if (prevProjectUsers) {
        prevProjectUsers.delete(userId);
        if (prevProjectUsers.size === 0) {
          this.projectPresences.delete(previousLocation.id);
        }
      }
    }

    // Add to current project
    let projectUsers = this.projectPresences.get(projectId);
    if (!projectUsers) {
      projectUsers = new Set();
      this.projectPresences.set(projectId, projectUsers);
    }
    projectUsers.add(userId);
  }

  /**
   * Update task presence
   */
  private updateTaskPresence(
    userId: string,
    taskId: string,
    previousLocation?: UserPresence['location']
  ): void {
    // Remove from previous task
    if (previousLocation?.type === 'task' && previousLocation.id !== taskId) {
      const prevTaskUsers = this.taskPresences.get(previousLocation.id);
      if (prevTaskUsers) {
        prevTaskUsers.delete(userId);
        if (prevTaskUsers.size === 0) {
          this.taskPresences.delete(previousLocation.id);
        }
      }
    }

    // Add to current task
    let taskUsers = this.taskPresences.get(taskId);
    if (!taskUsers) {
      taskUsers = new Set();
      this.taskPresences.set(taskId, taskUsers);
    }
    taskUsers.add(userId);
  }

  /**
   * Remove user from all presence maps
   */
  private removeFromAllPresences(userId: string): void {
    // Remove from workspace presences
    for (const [workspaceId, users] of this.workspacePresences) {
      users.delete(userId);
      if (users.size === 0) {
        this.workspacePresences.delete(workspaceId);
      }
    }

    // Remove from project presences
    for (const [projectId, users] of this.projectPresences) {
      users.delete(userId);
      if (users.size === 0) {
        this.projectPresences.delete(projectId);
      }
    }

    // Remove from task presences
    for (const [taskId, users] of this.taskPresences) {
      users.delete(userId);
      if (users.size === 0) {
        this.taskPresences.delete(taskId);
      }
    }
  }

  /**
   * Broadcast presence update
   */
  private async broadcastPresenceUpdate(presence: UserPresence): Promise<void> {
    // Broadcast to workspace if user has workspace location
    if (presence.location?.type === 'workspace') {
      await this.eventBroadcaster.broadcast({
        type: 'presence',
        event: 'presence.updated',
        data: { presence },
        source: { userId: presence.userId },
        target: {
          type: 'workspace',
          id: presence.location.id,
          excludeUsers: [presence.userId],
        },
        priority: 'low',
        persistent: false,
      });
    }

    // Also broadcast to any active connections for this user
    const userConnections = this.connectionManager.getConnectionsByUser(
      presence.userId
    );
    if (userConnections.length > 0) {
      const user = userConnections[0].getUser();
      if (user.workspaceId) {
        await this.eventBroadcaster.broadcast({
          type: 'presence',
          event: 'presence.updated',
          data: { presence },
          source: { userId: presence.userId },
          target: {
            type: 'workspace',
            id: user.workspaceId,
            excludeUsers: [presence.userId],
          },
          priority: 'low',
          persistent: false,
        });
      }
    }
  }

  /**
   * Broadcast typing indicator
   */
  private async broadcastTypingIndicator(
    indicator: TypingIndicator
  ): Promise<void> {
    // Determine broadcast target based on resource type
    let targetType: 'workspace' | 'project' | 'global' = 'global';
    let targetId = 'all';

    // For now, broadcast globally - in a real implementation,
    // you'd determine the appropriate scope based on the resource
    await this.eventBroadcaster.broadcast({
      type: 'typing',
      event: indicator.isTyping ? 'typing.started' : 'typing.stopped',
      data: { indicator },
      source: { userId: indicator.userId },
      target: {
        type: targetType,
        id: targetId,
        excludeUsers: [indicator.userId],
      },
      priority: 'low',
      persistent: false,
    });
  }

  /**
   * Broadcast activity event
   */
  private async broadcastActivity(
    workspaceId: string,
    activity: ActivityEvent
  ): Promise<void> {
    await this.eventBroadcaster.broadcast({
      type: 'activity',
      event: 'activity.recorded',
      data: { activity },
      source: { userId: activity.userId },
      target: {
        type: 'workspace',
        id: workspaceId,
        excludeUsers: [activity.userId],
      },
      priority: 'low',
      persistent: true,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    });
  }

  /**
   * Get workspace ID for activity
   */
  private async getWorkspaceIdForActivity(
    userId: string,
    resource: ActivityEvent['resource']
  ): Promise<string | null> {
    // Try to get workspace from user presence
    const presence = this.userPresences.get(userId);
    if (presence?.location?.type === 'workspace') {
      return presence.location.id;
    }

    // Try to get workspace from user connections
    const userConnections = this.connectionManager.getConnectionsByUser(userId);
    if (userConnections.length > 0) {
      const user = userConnections[0].getUser();
      if (user.workspaceId) {
        return user.workspaceId;
      }
    }

    // In a real implementation, you'd query the database to get
    // the workspace ID based on the resource
    return null;
  }

  /**
   * Start presence updates
   */
  private startPresenceUpdates(): void {
    this.presenceUpdateInterval = setInterval(() => {
      this.updateStalePresences();
      this.cleanupTypingIndicators();
    }, 30000); // Every 30 seconds
  }

  /**
   * Start activity cleanup
   */
  private startActivityCleanup(): void {
    this.activityCleanupInterval = setInterval(
      () => {
        this.cleanupOldActivities();
      },
      60 * 60 * 1000
    ); // Every hour
  }

  /**
   * Update stale presences
   */
  private updateStalePresences(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const offlineThreshold = 15 * 60 * 1000; // 15 minutes

    for (const [userId, presence] of this.userPresences) {
      const timeSinceLastSeen = now - presence.lastSeen;

      if (presence.status === 'online' && timeSinceLastSeen > staleThreshold) {
        presence.status = 'away';
        this.broadcastPresenceUpdate(presence);
      } else if (
        presence.status !== 'offline' &&
        timeSinceLastSeen > offlineThreshold
      ) {
        this.setUserOffline(userId);
      }
    }
  }

  /**
   * Cleanup old typing indicators
   */
  private cleanupTypingIndicators(): void {
    const now = Date.now();
    const staleThreshold = 10 * 1000; // 10 seconds

    for (const [resourceId, indicators] of this.typingIndicators) {
      const staleUserIds: string[] = [];

      for (const [userId, indicator] of indicators) {
        if (now - indicator.timestamp > staleThreshold) {
          staleUserIds.push(userId);
        }
      }

      // Remove stale indicators
      for (const userId of staleUserIds) {
        indicators.delete(userId);

        // Broadcast typing stopped
        this.broadcastTypingIndicator({
          userId,
          resourceId,
          resourceType: 'task', // Default type
          isTyping: false,
          timestamp: now,
        });
      }

      // Clean up empty resource maps
      if (indicators.size === 0) {
        this.typingIndicators.delete(resourceId);
      }
    }
  }

  /**
   * Cleanup old activities
   */
  private cleanupOldActivities(): void {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    for (const [workspaceId, activities] of this.activityFeeds) {
      const filteredActivities = activities.filter(
        activity => now - activity.timestamp < maxAge
      );

      if (filteredActivities.length !== activities.length) {
        this.activityFeeds.set(workspaceId, filteredActivities);

        logger.debug('Cleaned up old activities', {
          workspaceId,
          removed: activities.length - filteredActivities.length,
          remaining: filteredActivities.length,
        });
      }
    }
  }

  /**
   * Generate unique activity ID
   */
  private generateActivityId(): string {
    return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get presence tracker metrics
   */
  getMetrics() {
    const onlineUsers = Array.from(this.userPresences.values()).filter(
      p => p.status === 'online'
    ).length;
    const awayUsers = Array.from(this.userPresences.values()).filter(
      p => p.status === 'away'
    ).length;
    const busyUsers = Array.from(this.userPresences.values()).filter(
      p => p.status === 'busy'
    ).length;
    const offlineUsers = Array.from(this.userPresences.values()).filter(
      p => p.status === 'offline'
    ).length;

    const totalActivities = Array.from(this.activityFeeds.values()).reduce(
      (sum, activities) => sum + activities.length,
      0
    );

    const activeTypingIndicators = Array.from(
      this.typingIndicators.values()
    ).reduce((sum, indicators) => sum + indicators.size, 0);

    return {
      totalUsers: this.userPresences.size,
      onlineUsers,
      awayUsers,
      busyUsers,
      offlineUsers,
      workspacesWithPresence: this.workspacePresences.size,
      projectsWithPresence: this.projectPresences.size,
      tasksWithPresence: this.taskPresences.size,
      totalActivities,
      workspacesWithActivities: this.activityFeeds.size,
      activeTypingIndicators,
    };
  }

  /**
   * Shutdown presence tracker
   */
  shutdown(): void {
    if (this.presenceUpdateInterval) {
      clearInterval(this.presenceUpdateInterval);
      this.presenceUpdateInterval = null;
    }

    if (this.activityCleanupInterval) {
      clearInterval(this.activityCleanupInterval);
      this.activityCleanupInterval = null;
    }

    logger.info('Presence tracker shutdown');
  }
}
