import { BaseService } from './base.service';
import logger from '../utils/logger';
import { userRepository } from '../db/repositories';

export interface PresenceInfo {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  currentActivity?: {
    type: 'viewing' | 'editing' | 'commenting';
    resourceType: 'task' | 'project' | 'workspace';
    resourceId: string;
    resourceTitle?: string;
    startedAt: Date;
  };
  workspaceId?: string;
  projectId?: string;
  deviceInfo?: {
    type: 'desktop' | 'mobile' | 'tablet';
    browser?: string;
    os?: string;
  };
  // Enhanced presence tracking
  location?: {
    workspaceId?: string;
    projectId?: string;
    taskId?: string;
  };
  customStatus?: {
    message: string;
    emoji?: string;
    expiresAt?: Date;
  };
}

export interface ActivityIndicator {
  userId: string;
  userName: string;
  userAvatar?: string;
  activity: {
    type: 'viewing' | 'editing' | 'commenting' | 'typing';
    resourceType: 'task' | 'project' | 'workspace' | 'comment';
    resourceId: string;
    resourceTitle?: string;
    startedAt: Date;
    lastUpdate: Date;
  };
  presence: {
    status: 'online' | 'away' | 'busy' | 'offline';
    lastSeen: Date;
  };
}

export interface ActivityFeedItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: string;
  resourceType: 'task' | 'project' | 'workspace' | 'comment' | 'attachment';
  resourceId: string;
  resourceTitle?: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  workspaceId: string;
  projectId?: string;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  resourceType: 'task' | 'comment';
  resourceId: string;
  startedAt: Date;
  lastUpdate: Date;
}

export class PresenceService extends BaseService {
  private presenceMap = new Map<string, PresenceInfo>();
  private activityIndicators = new Map<string, ActivityIndicator>();
  private typingIndicators = new Map<string, TypingIndicator>();
  private activityFeed = new Map<string, ActivityFeedItem[]>(); // workspaceId -> activities
  private presenceCleanupInterval: NodeJS.Timeout | null = null;
  private typingCleanupInterval: NodeJS.Timeout | null = null;

  // Enhanced tracking for task 4.4
  private userLocations = new Map<
    string,
    { workspaceId?: string; projectId?: string; taskId?: string }
  >();
  private customStatuses = new Map<
    string,
    { message: string; emoji?: string; expiresAt?: Date }
  >();
  private activityHistory = new Map<string, ActivityFeedItem[]>(); // userId -> recent activities

  constructor() {
    super('PresenceService', {
      enableCache: true,
      enableAudit: true,
      enableMetrics: true,
    });

    this.startCleanupIntervals();
  }

  /**
   * Update user presence status
   */
  async updatePresence(
    userId: string,
    status: 'online' | 'away' | 'busy' | 'offline',
    workspaceId?: string,
    deviceInfo?: PresenceInfo['deviceInfo']
  ): Promise<PresenceInfo> {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const existingPresence = this.presenceMap.get(userId);
      const location = this.userLocations.get(userId);
      const customStatus = this.customStatuses.get(userId);

      const presenceInfo: PresenceInfo = {
        userId,
        status,
        lastSeen: new Date(),
        workspaceId: workspaceId || existingPresence?.workspaceId,
        deviceInfo,
        location,
        customStatus:
          customStatus &&
          (!customStatus.expiresAt || customStatus.expiresAt > new Date())
            ? customStatus
            : undefined,
      };

      // Preserve current activity if exists
      if (existingPresence?.currentActivity) {
        presenceInfo.currentActivity = existingPresence.currentActivity;
      }

      this.presenceMap.set(userId, presenceInfo);

      // Record activity in feed
      if (workspaceId && status === 'online') {
        await this.addActivityToFeed({
          userId,
          userName: `${user.firstName} ${user.lastName}`,
          userAvatar: user.avatar,
          action: 'came_online',
          resourceType: 'workspace',
          resourceId: workspaceId,
          description: 'came online',
          workspaceId,
          timestamp: new Date(),
        });
      }

      this.recordMetric('presence.status.updated', 1, {
        userId,
        status,
        workspaceId: workspaceId || 'none',
      });

      logger.debug(`Presence updated for user ${userId}: ${status}`);
      return presenceInfo;
    } catch (error) {
      logger.error('Error updating presence:', error);
      throw error;
    }
  }

  /**
   * Update user activity (what they're currently doing)
   */
  async updateActivity(
    userId: string,
    activity: PresenceInfo['currentActivity']
  ): Promise<void> {
    try {
      const presence = this.presenceMap.get(userId);
      if (!presence) {
        // Create basic presence if doesn't exist
        await this.updatePresence(userId, 'online');
      }

      const updatedPresence = this.presenceMap.get(userId)!;
      updatedPresence.currentActivity = activity;
      this.presenceMap.set(userId, updatedPresence);

      // Update activity indicator
      if (activity) {
        const user = await userRepository.findById(userId);
        if (user) {
          const indicator: ActivityIndicator = {
            userId,
            userName: `${user.firstName} ${user.lastName}`,
            userAvatar: user.profilePicture,
            activity: {
              type: activity.type,
              resourceType: activity.resourceType,
              resourceId: activity.resourceId,
              resourceTitle: activity.resourceTitle,
              startedAt: new Date(),
              lastUpdate: new Date(),
            },
            presence: {
              status: updatedPresence.status,
              lastSeen: updatedPresence.lastSeen,
            },
          };

          this.activityIndicators.set(
            `${userId}:${activity.resourceId}`,
            indicator
          );

          // Add to activity feed for certain activities
          if (activity.type === 'editing') {
            await this.addActivityToFeed({
              userId,
              userName: `${user.firstName} ${user.lastName}`,
              userAvatar: user.profilePicture,
              action: 'started_editing',
              resourceType: activity.resourceType,
              resourceId: activity.resourceId,
              resourceTitle: activity.resourceTitle,
              description: `started editing ${activity.resourceType}`,
              workspaceId: updatedPresence.workspaceId!,
              projectId: updatedPresence.projectId,
              timestamp: new Date(),
            });
          }
        }
      }

      this.recordMetric('presence.activity.updated', 1, {
        userId,
        activityType: activity?.type || 'none',
        resourceType: activity?.resourceType || 'none',
      });

      logger.debug(`Activity updated for user ${userId}:`, activity);
    } catch (error) {
      logger.error('Error updating activity:', error);
      throw error;
    }
  }

  /**
   * Clear user activity
   */
  async clearActivity(userId: string, resourceId?: string): Promise<void> {
    try {
      const presence = this.presenceMap.get(userId);
      if (presence) {
        if (
          !resourceId ||
          presence.currentActivity?.resourceId === resourceId
        ) {
          presence.currentActivity = undefined;
          this.presenceMap.set(userId, presence);
        }
      }

      // Remove activity indicator
      if (resourceId) {
        this.activityIndicators.delete(`${userId}:${resourceId}`);
      } else {
        // Remove all activity indicators for this user
        for (const key of this.activityIndicators.keys()) {
          if (key.startsWith(`${userId}:`)) {
            this.activityIndicators.delete(key);
          }
        }
      }

      this.recordMetric('presence.activity.cleared', 1, { userId });
      logger.debug(`Activity cleared for user ${userId}`);
    } catch (error) {
      logger.error('Error clearing activity:', error);
      throw error;
    }
  }

  /**
   * Start typing indicator
   */
  async startTyping(
    userId: string,
    resourceType: 'task' | 'comment',
    resourceId: string
  ): Promise<void> {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const indicator: TypingIndicator = {
        userId,
        userName: `${user.firstName} ${user.lastName}`,
        resourceType,
        resourceId,
        startedAt: new Date(),
        lastUpdate: new Date(),
      };

      this.typingIndicators.set(`${userId}:${resourceId}`, indicator);

      this.recordMetric('presence.typing.started', 1, {
        userId,
        resourceType,
        resourceId,
      });

      logger.debug(
        `Typing started for user ${userId} on ${resourceType} ${resourceId}`
      );
    } catch (error) {
      logger.error('Error starting typing indicator:', error);
      throw error;
    }
  }

  /**
   * Stop typing indicator
   */
  async stopTyping(userId: string, resourceId: string): Promise<void> {
    try {
      this.typingIndicators.delete(`${userId}:${resourceId}`);

      this.recordMetric('presence.typing.stopped', 1, {
        userId,
        resourceId,
      });

      logger.debug(
        `Typing stopped for user ${userId} on resource ${resourceId}`
      );
    } catch (error) {
      logger.error('Error stopping typing indicator:', error);
      throw error;
    }
  }

  /**
   * Get presence info for a user
   */
  getPresence(userId: string): PresenceInfo | null {
    return this.presenceMap.get(userId) || null;
  }

  /**
   * Get presence info for multiple users
   */
  getMultiplePresence(userIds: string[]): Map<string, PresenceInfo> {
    const result = new Map<string, PresenceInfo>();

    for (const userId of userIds) {
      const presence = this.presenceMap.get(userId);
      if (presence) {
        result.set(userId, presence);
      }
    }

    return result;
  }

  /**
   * Get activity indicators for a resource
   */
  getActivityIndicators(resourceId: string): ActivityIndicator[] {
    const indicators: ActivityIndicator[] = [];

    for (const [key, indicator] of this.activityIndicators.entries()) {
      if (key.endsWith(`:${resourceId}`)) {
        indicators.push(indicator);
      }
    }

    return indicators.sort(
      (a, b) =>
        b.activity.lastUpdate.getTime() - a.activity.lastUpdate.getTime()
    );
  }

  /**
   * Get typing indicators for a resource
   */
  getTypingIndicators(resourceId: string): TypingIndicator[] {
    const indicators: TypingIndicator[] = [];

    for (const [key, indicator] of this.typingIndicators.entries()) {
      if (key.endsWith(`:${resourceId}`)) {
        indicators.push(indicator);
      }
    }

    return indicators.sort(
      (a, b) => b.lastUpdate.getTime() - a.lastUpdate.getTime()
    );
  }

  /**
   * Get online users in a workspace
   */
  getOnlineUsersInWorkspace(workspaceId: string): PresenceInfo[] {
    const onlineUsers: PresenceInfo[] = [];

    for (const presence of this.presenceMap.values()) {
      if (
        presence.workspaceId === workspaceId &&
        presence.status !== 'offline' &&
        this.isRecentlyActive(presence.lastSeen)
      ) {
        onlineUsers.push(presence);
      }
    }

    return onlineUsers.sort(
      (a, b) => b.lastSeen.getTime() - a.lastSeen.getTime()
    );
  }

  /**
   * Get activity feed for a workspace
   */
  getActivityFeed(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0
  ): ActivityFeedItem[] {
    const activities = this.activityFeed.get(workspaceId) || [];

    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Add activity to feed
   */
  async addActivityToFeed(
    activity: Omit<ActivityFeedItem, 'id'>
  ): Promise<void> {
    try {
      const activityItem: ActivityFeedItem = {
        ...activity,
        id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      let workspaceActivities =
        this.activityFeed.get(activity.workspaceId) || [];
      workspaceActivities.unshift(activityItem);

      // Keep only last 1000 activities per workspace
      if (workspaceActivities.length > 1000) {
        workspaceActivities = workspaceActivities.slice(0, 1000);
      }

      this.activityFeed.set(activity.workspaceId, workspaceActivities);

      this.recordMetric('presence.activity.added', 1, {
        workspaceId: activity.workspaceId,
        action: activity.action,
        resourceType: activity.resourceType,
      });

      logger.debug(
        `Activity added to feed for workspace ${activity.workspaceId}:`,
        activity.action
      );
    } catch (error) {
      logger.error('Error adding activity to feed:', error);
      throw error;
    }
  }

  /**
   * Remove user from all presence tracking
   */
  async removeUser(userId: string): Promise<void> {
    try {
      // Remove from presence map
      this.presenceMap.delete(userId);

      // Remove from activity indicators
      for (const key of this.activityIndicators.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.activityIndicators.delete(key);
        }
      }

      // Remove from typing indicators
      for (const key of this.typingIndicators.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.typingIndicators.delete(key);
        }
      }

      this.recordMetric('presence.user.removed', 1, { userId });
      logger.debug(`User ${userId} removed from presence tracking`);
    } catch (error) {
      logger.error('Error removing user from presence:', error);
      throw error;
    }
  }

  /**
   * Get presence statistics
   */
  getPresenceStats(): {
    totalUsers: number;
    onlineUsers: number;
    awayUsers: number;
    busyUsers: number;
    offlineUsers: number;
    activeIndicators: number;
    typingIndicators: number;
  } {
    const stats = {
      totalUsers: this.presenceMap.size,
      onlineUsers: 0,
      awayUsers: 0,
      busyUsers: 0,
      offlineUsers: 0,
      activeIndicators: this.activityIndicators.size,
      typingIndicators: this.typingIndicators.size,
    };

    for (const presence of this.presenceMap.values()) {
      switch (presence.status) {
        case 'online':
          stats.onlineUsers++;
          break;
        case 'away':
          stats.awayUsers++;
          break;
        case 'busy':
          stats.busyUsers++;
          break;
        case 'offline':
          stats.offlineUsers++;
          break;
      }
    }

    return stats;
  }

  /**
   * Check if user was recently active (within last 5 minutes)
   */
  private isRecentlyActive(lastSeen: Date): boolean {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeen > fiveMinutesAgo;
  }

  /**
   * Start cleanup intervals for stale data
   */
  private startCleanupIntervals(): void {
    // Clean up stale presence data every 5 minutes
    this.presenceCleanupInterval = setInterval(
      () => {
        this.cleanupStalePresence();
      },
      5 * 60 * 1000
    );

    // Clean up stale typing indicators every 30 seconds
    this.typingCleanupInterval = setInterval(() => {
      this.cleanupStaleTypingIndicators();
    }, 30 * 1000);
  }

  /**
   * Clean up stale presence data
   */
  private cleanupStalePresence(): void {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    let cleanedCount = 0;

    for (const [userId, presence] of this.presenceMap.entries()) {
      if (
        presence.lastSeen < thirtyMinutesAgo &&
        presence.status !== 'offline'
      ) {
        presence.status = 'offline';
        presence.currentActivity = undefined;
        this.presenceMap.set(userId, presence);
        cleanedCount++;
      }
    }

    // Clean up stale activity indicators
    for (const [key, indicator] of this.activityIndicators.entries()) {
      if (indicator.activity.lastUpdate < thirtyMinutesAgo) {
        this.activityIndicators.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(
        `Cleaned up ${cleanedCount} stale presence/activity records`
      );
      this.recordMetric('presence.cleanup.stale', cleanedCount);
    }
  }

  /**
   * Clean up stale typing indicators
   */
  private cleanupStaleTypingIndicators(): void {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    let cleanedCount = 0;

    for (const [key, indicator] of this.typingIndicators.entries()) {
      if (indicator.lastUpdate < twoMinutesAgo) {
        this.typingIndicators.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} stale typing indicators`);
      this.recordMetric('presence.cleanup.typing', cleanedCount);
    }
  }

  /**
   * Update user location context (workspace, project, task)
   */
  async updateUserLocation(
    userId: string,
    location: { workspaceId?: string; projectId?: string; taskId?: string }
  ): Promise<void> {
    try {
      this.userLocations.set(userId, location);

      // Update presence with new location
      const presence = this.presenceMap.get(userId);
      if (presence) {
        presence.location = location;
        presence.workspaceId = location.workspaceId || presence.workspaceId;
        presence.projectId = location.projectId || presence.projectId;
        this.presenceMap.set(userId, presence);
      }

      this.recordMetric('presence.location.updated', 1, {
        userId,
        workspaceId: location.workspaceId || 'none',
        projectId: location.projectId || 'none',
        taskId: location.taskId || 'none',
      });

      logger.debug(`Location updated for user ${userId}:`, location);
    } catch (error) {
      logger.error('Error updating user location:', error);
      throw error;
    }
  }

  /**
   * Set custom status message for user
   */
  async setCustomStatus(
    userId: string,
    message: string,
    emoji?: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      const customStatus = { message, emoji, expiresAt };
      this.customStatuses.set(userId, customStatus);

      // Update presence with custom status
      const presence = this.presenceMap.get(userId);
      if (presence) {
        presence.customStatus = customStatus;
        this.presenceMap.set(userId, presence);
      }

      this.recordMetric('presence.custom_status.set', 1, {
        userId,
        hasEmoji: emoji ? 'true' : 'false',
        hasExpiry: expiresAt ? 'true' : 'false',
      });

      logger.debug(`Custom status set for user ${userId}: ${message}`);
    } catch (error) {
      logger.error('Error setting custom status:', error);
      throw error;
    }
  }

  /**
   * Clear custom status for user
   */
  async clearCustomStatus(userId: string): Promise<void> {
    try {
      this.customStatuses.delete(userId);

      // Update presence
      const presence = this.presenceMap.get(userId);
      if (presence) {
        presence.customStatus = undefined;
        this.presenceMap.set(userId, presence);
      }

      this.recordMetric('presence.custom_status.cleared', 1, { userId });
      logger.debug(`Custom status cleared for user ${userId}`);
    } catch (error) {
      logger.error('Error clearing custom status:', error);
      throw error;
    }
  }

  /**
   * Get users currently viewing a specific resource
   */
  getUsersViewingResource(resourceId: string): ActivityIndicator[] {
    const viewers: ActivityIndicator[] = [];

    for (const [key, indicator] of this.activityIndicators.entries()) {
      if (
        key.endsWith(`:${resourceId}`) &&
        indicator.activity.type === 'viewing' &&
        this.isRecentActivity(indicator.activity.lastUpdate)
      ) {
        viewers.push(indicator);
      }
    }

    return viewers.sort(
      (a, b) =>
        b.activity.lastUpdate.getTime() - a.activity.lastUpdate.getTime()
    );
  }

  /**
   * Get users currently editing a specific resource
   */
  getUsersEditingResource(resourceId: string): ActivityIndicator[] {
    const editors: ActivityIndicator[] = [];

    for (const [key, indicator] of this.activityIndicators.entries()) {
      if (
        key.endsWith(`:${resourceId}`) &&
        indicator.activity.type === 'editing' &&
        this.isRecentActivity(indicator.activity.lastUpdate)
      ) {
        editors.push(indicator);
      }
    }

    return editors.sort(
      (a, b) =>
        b.activity.lastUpdate.getTime() - a.activity.lastUpdate.getTime()
    );
  }

  /**
   * Get comprehensive activity summary for a resource
   */
  getResourceActivitySummary(resourceId: string): {
    viewers: ActivityIndicator[];
    editors: ActivityIndicator[];
    commenters: ActivityIndicator[];
    typing: TypingIndicator[];
    totalActiveUsers: number;
  } {
    const viewers = this.getUsersViewingResource(resourceId);
    const editors = this.getUsersEditingResource(resourceId);
    const commenters = this.getActivityIndicators(resourceId).filter(
      indicator => indicator.activity.type === 'commenting'
    );
    const typing = this.getTypingIndicators(resourceId);

    // Get unique users
    const activeUserIds = new Set([
      ...viewers.map(v => v.userId),
      ...editors.map(e => e.userId),
      ...commenters.map(c => c.userId),
      ...typing.map(t => t.userId),
    ]);

    return {
      viewers,
      editors,
      commenters,
      typing,
      totalActiveUsers: activeUserIds.size,
    };
  }

  /**
   * Get user activity history
   */
  getUserActivityHistory(
    userId: string,
    limit: number = 50
  ): ActivityFeedItem[] {
    const userActivities = this.activityHistory.get(userId) || [];
    return userActivities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Track user activity in history
   */
  private async trackUserActivity(
    userId: string,
    activity: Omit<
      ActivityFeedItem,
      'id' | 'userId' | 'userName' | 'userAvatar'
    >
  ): Promise<void> {
    try {
      const user = await userRepository.findById(userId);
      if (!user) return;

      const activityItem: ActivityFeedItem = {
        ...activity,
        id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        userName: `${user.firstName} ${user.lastName}`,
        userAvatar: user.avatar,
      };

      let userActivities = this.activityHistory.get(userId) || [];
      userActivities.unshift(activityItem);

      // Keep only last 100 activities per user
      if (userActivities.length > 100) {
        userActivities = userActivities.slice(0, 100);
      }

      this.activityHistory.set(userId, userActivities);
    } catch (error) {
      logger.error('Error tracking user activity:', error);
    }
  }

  /**
   * Get presence statistics with enhanced metrics
   */
  getEnhancedPresenceStats(): {
    totalUsers: number;
    onlineUsers: number;
    awayUsers: number;
    busyUsers: number;
    offlineUsers: number;
    activeIndicators: number;
    typingIndicators: number;
    customStatuses: number;
    userLocations: number;
    recentActivities: number;
  } {
    const basicStats = this.getPresenceStats();

    return {
      ...basicStats,
      customStatuses: this.customStatuses.size,
      userLocations: this.userLocations.size,
      recentActivities: Array.from(this.activityHistory.values()).reduce(
        (total, activities) => total + activities.length,
        0
      ),
    };
  }

  /**
   * Check if activity is recent (within last 2 minutes)
   */
  private isRecentActivity(lastUpdate: Date): boolean {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    return lastUpdate > twoMinutesAgo;
  }

  /**
   * Enhanced update activity method with history tracking
   */
  async updateActivity(
    userId: string,
    activity: PresenceInfo['currentActivity']
  ): Promise<void> {
    try {
      const presence = this.presenceMap.get(userId);
      if (!presence) {
        // Create basic presence if doesn't exist
        await this.updatePresence(userId, 'online');
      }

      const updatedPresence = this.presenceMap.get(userId)!;

      // Add startedAt timestamp if not present
      if (activity) {
        activity.startedAt = activity.startedAt || new Date();
      }

      updatedPresence.currentActivity = activity;
      this.presenceMap.set(userId, updatedPresence);

      // Update activity indicator
      if (activity) {
        const user = await userRepository.findById(userId);
        if (user) {
          const indicator: ActivityIndicator = {
            userId,
            userName: `${user.firstName} ${user.lastName}`,
            userAvatar: user.avatar,
            activity: {
              type: activity.type,
              resourceType: activity.resourceType,
              resourceId: activity.resourceId,
              resourceTitle: activity.resourceTitle,
              startedAt: activity.startedAt,
              lastUpdate: new Date(),
            },
            presence: {
              status: updatedPresence.status,
              lastSeen: updatedPresence.lastSeen,
            },
          };

          this.activityIndicators.set(
            `${userId}:${activity.resourceId}`,
            indicator
          );

          // Track activity in history
          await this.trackUserActivity(userId, {
            action: `started_${activity.type}`,
            resourceType: activity.resourceType,
            resourceId: activity.resourceId,
            resourceTitle: activity.resourceTitle,
            description: `started ${activity.type} ${activity.resourceType}`,
            workspaceId: updatedPresence.workspaceId!,
            projectId: updatedPresence.projectId,
            timestamp: new Date(),
          });

          // Add to activity feed for certain activities
          if (activity.type === 'editing') {
            await this.addActivityToFeed({
              userId,
              userName: `${user.firstName} ${user.lastName}`,
              userAvatar: user.avatar,
              action: 'started_editing',
              resourceType: activity.resourceType,
              resourceId: activity.resourceId,
              resourceTitle: activity.resourceTitle,
              description: `started editing ${activity.resourceType}`,
              workspaceId: updatedPresence.workspaceId!,
              projectId: updatedPresence.projectId,
              timestamp: new Date(),
            });
          }
        }
      }

      this.recordMetric('presence.activity.updated', 1, {
        userId,
        activityType: activity?.type || 'none',
        resourceType: activity?.resourceType || 'none',
      });

      logger.debug(`Activity updated for user ${userId}:`, activity);
    } catch (error) {
      logger.error('Error updating activity:', error);
      throw error;
    }
  }

  /**
   * Cleanup on service shutdown
   */
  async shutdown(): Promise<void> {
    if (this.presenceCleanupInterval) {
      clearInterval(this.presenceCleanupInterval);
    }
    if (this.typingCleanupInterval) {
      clearInterval(this.typingCleanupInterval);
    }

    logger.info('PresenceService shutdown completed');
  }
}

// Export singleton instance
export const presenceService = new PresenceService();
