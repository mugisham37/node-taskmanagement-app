import { ActivityTrackingEntity } from '../entities/ActivityTrackingEntity';
import { IActivityTrackingRepository } from '../repositories/IActivityTrackingRepository';
import {
  ActivityType,
  ActivityMetadata,
  ActivityContext,
  ActivityTypeValidator,
} from '../value-objects/ActivityTypes';
import { BaseService } from '../../shared/services/BaseService';
import { DomainError } from '../../shared/errors/DomainError';

export interface TrackActivityRequest {
  userId: string;
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
  type: ActivityType;
  action: string;
  description: string;
  metadata?: ActivityMetadata;
  context?: ActivityContext;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  duration?: number;
}

export interface ActivityAnalytics {
  totalActivities: number;
  uniqueUsers: number;
  uniqueSessions: number;
  averageDuration: number;
  topActions: Array<{ action: string; count: number; percentage: number }>;
  topUsers: Array<{ userId: string; count: number; percentage: number }>;
  activityByHour: Array<{ hour: number; count: number }>;
  activityByDay: Array<{ day: string; count: number }>;
  performanceMetrics: {
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  trends: {
    dailyGrowth: number;
    weeklyGrowth: number;
    monthlyGrowth: number;
  };
}

export interface UserActivityProfile {
  userId: string;
  totalActivities: number;
  uniqueDays: number;
  averageActivitiesPerDay: number;
  mostActiveHour: number;
  mostActiveDay: string;
  topActions: Array<{ action: string; count: number }>;
  productivityScore: number;
  activityStreak: number;
  lastActivityAt: Date;
  activityPattern: {
    morningActivities: number;
    afternoonActivities: number;
    eveningActivities: number;
    nightActivities: number;
  };
}

export class ActivityTrackingService extends BaseService {
  constructor(
    private readonly activityRepository: IActivityTrackingRepository
  ) {
    super('ActivityTrackingService');
  }

  async trackActivity(
    request: TrackActivityRequest
  ): Promise<ActivityTrackingEntity> {
    try {
      // Validate activity data
      const validation = ActivityTypeValidator.validateActivityData(
        request.type,
        request.action,
        request.metadata,
        request.context
      );

      if (!validation.isValid) {
        throw new DomainError(
          'INVALID_ACTIVITY_DATA',
          `Invalid activity data: ${validation.errors.join(', ')}`,
          { errors: validation.errors }
        );
      }

      // Create activity entity
      const activity = ActivityTrackingEntity.create({
        userId: request.userId,
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        taskId: request.taskId,
        type: request.type,
        action: request.action,
        description: request.description,
        metadata: request.metadata || {},
        context: request.context || {},
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        sessionId: request.sessionId,
        duration: request.duration,
      });

      // Save to repository
      const savedActivity = await this.activityRepository.create(activity);

      // Log the tracking event
      this.logger.info('Activity tracked successfully', {
        activityId: savedActivity.id,
        userId: request.userId,
        type: request.type,
        action: request.action,
      });

      return savedActivity;
    } catch (error) {
      this.logger.error('Failed to track activity', {
        error: error.message,
        request,
      });
      throw error;
    }
  }

  async trackBulkActivities(
    requests: TrackActivityRequest[]
  ): Promise<ActivityTrackingEntity[]> {
    try {
      const activities: ActivityTrackingEntity[] = [];

      // Validate and create all activities
      for (const request of requests) {
        const validation = ActivityTypeValidator.validateActivityData(
          request.type,
          request.action,
          request.metadata,
          request.context
        );

        if (!validation.isValid) {
          this.logger.warn('Skipping invalid activity in bulk operation', {
            request,
            errors: validation.errors,
          });
          continue;
        }

        const activity = ActivityTrackingEntity.create({
          userId: request.userId,
          workspaceId: request.workspaceId,
          projectId: request.projectId,
          taskId: request.taskId,
          type: request.type,
          action: request.action,
          description: request.description,
          metadata: request.metadata || {},
          context: request.context || {},
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          sessionId: request.sessionId,
          duration: request.duration,
        });

        activities.push(activity);
      }

      // Bulk save to repository
      const savedActivities =
        await this.activityRepository.createMany(activities);

      this.logger.info('Bulk activities tracked successfully', {
        totalRequested: requests.length,
        totalSaved: savedActivities.length,
      });

      return savedActivities;
    } catch (error) {
      this.logger.error('Failed to track bulk activities', {
        error: error.message,
        requestCount: requests.length,
      });
      throw error;
    }
  }

  async getActivityAnalytics(filter: {
    userId?: string;
    workspaceId?: string;
    projectId?: string;
    taskId?: string;
    type?: ActivityType;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ActivityAnalytics> {
    try {
      // Get basic insights
      const insights =
        await this.activityRepository.getActivityInsights(filter);

      // Calculate trends
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [dailyInsights, weeklyInsights, monthlyInsights] =
        await Promise.all([
          this.activityRepository.getActivityInsights({
            ...filter,
            startDate: oneDayAgo,
            endDate: now,
          }),
          this.activityRepository.getActivityInsights({
            ...filter,
            startDate: oneWeekAgo,
            endDate: now,
          }),
          this.activityRepository.getActivityInsights({
            ...filter,
            startDate: oneMonthAgo,
            endDate: now,
          }),
        ]);

      // Calculate growth rates
      const dailyGrowth = this.calculateGrowthRate(
        insights.totalActivities,
        dailyInsights.totalActivities
      );
      const weeklyGrowth = this.calculateGrowthRate(
        insights.totalActivities,
        weeklyInsights.totalActivities
      );
      const monthlyGrowth = this.calculateGrowthRate(
        insights.totalActivities,
        monthlyInsights.totalActivities
      );

      // Add percentages to top actions and users
      const topActions = insights.topActions.map(action => ({
        ...action,
        percentage: (action.count / insights.totalActivities) * 100,
      }));

      const topUsers = insights.topUsers.map(user => ({
        ...user,
        percentage: (user.count / insights.totalActivities) * 100,
      }));

      return {
        totalActivities: insights.totalActivities,
        uniqueUsers: insights.uniqueUsers,
        uniqueSessions: insights.uniqueSessions,
        averageDuration: insights.averageDuration,
        topActions,
        topUsers,
        activityByHour: insights.activityByHour,
        activityByDay: insights.activityByDay,
        performanceMetrics: {
          ...insights.performanceMetrics,
          throughput:
            insights.totalActivities /
            (filter.endDate && filter.startDate
              ? (filter.endDate.getTime() - filter.startDate.getTime()) /
                (1000 * 60 * 60)
              : 24), // activities per hour
        },
        trends: {
          dailyGrowth,
          weeklyGrowth,
          monthlyGrowth,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get activity analytics', {
        error: error.message,
        filter,
      });
      throw error;
    }
  }

  async getUserActivityProfile(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<UserActivityProfile> {
    try {
      const endDate = options.endDate || new Date();
      const startDate =
        options.startDate ||
        new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get user activity summary
      const summary = await this.activityRepository.getUserActivitySummary(
        userId,
        startDate,
        endDate
      );

      // Get user activities for pattern analysis
      const activities = await this.activityRepository.findByUser(userId, {
        startDate,
        endDate,
        limit: 10000, // Large limit for pattern analysis
      });

      // Calculate activity pattern
      const activityPattern = this.calculateActivityPattern(activities);

      // Calculate activity streak
      const activityStreak = await this.calculateActivityStreak(
        userId,
        endDate
      );

      // Get last activity
      const lastActivity =
        activities.length > 0
          ? activities.reduce((latest, current) =>
              current.createdAt > latest.createdAt ? current : latest
            ).createdAt
          : new Date(0);

      return {
        userId,
        totalActivities: summary.totalActivities,
        uniqueDays: summary.uniqueDays,
        averageActivitiesPerDay: summary.averageActivitiesPerDay,
        mostActiveHour: summary.mostActiveHour,
        mostActiveDay: summary.mostActiveDay,
        topActions: summary.topActions,
        productivityScore: summary.productivityScore,
        activityStreak,
        lastActivityAt: lastActivity,
        activityPattern,
      };
    } catch (error) {
      this.logger.error('Failed to get user activity profile', {
        error: error.message,
        userId,
        options,
      });
      throw error;
    }
  }

  async getActivityHeatmap(
    filter: {
      userId?: string;
      workspaceId?: string;
      projectId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<
    Array<{
      timestamp: Date;
      count: number;
      intensity: 'low' | 'medium' | 'high';
    }>
  > {
    try {
      return await this.activityRepository.getActivityHeatmap(
        filter,
        granularity
      );
    } catch (error) {
      this.logger.error('Failed to get activity heatmap', {
        error: error.message,
        filter,
        granularity,
      });
      throw error;
    }
  }

  async getUserJourney(
    userId: string,
    sessionId: string
  ): Promise<ActivityTrackingEntity[]> {
    try {
      return await this.activityRepository.getUserJourney(userId, sessionId);
    } catch (error) {
      this.logger.error('Failed to get user journey', {
        error: error.message,
        userId,
        sessionId,
      });
      throw error;
    }
  }

  async getCollaborationMetrics(
    workspaceId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    totalCollaborativeActions: number;
    uniqueCollaborators: number;
    averageCollaboratorsPerProject: number;
    collaborationScore: number;
    topCollaborativePairs: Array<{
      user1Id: string;
      user2Id: string;
      sharedActions: number;
    }>;
  }> {
    try {
      const endDate = options.endDate || new Date();
      const startDate =
        options.startDate ||
        new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      return await this.activityRepository.getCollaborationMetrics(
        workspaceId,
        startDate,
        endDate
      );
    } catch (error) {
      this.logger.error('Failed to get collaboration metrics', {
        error: error.message,
        workspaceId,
        options,
      });
      throw error;
    }
  }

  async cleanupOldActivities(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const deletedCount = await this.activityRepository.cleanup(cutoffDate);

      this.logger.info('Old activities cleaned up', {
        deletedCount,
        cutoffDate,
        olderThanDays,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old activities', {
        error: error.message,
        olderThanDays,
      });
      throw error;
    }
  }

  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private calculateActivityPattern(activities: ActivityTrackingEntity[]): {
    morningActivities: number;
    afternoonActivities: number;
    eveningActivities: number;
    nightActivities: number;
  } {
    const pattern = {
      morningActivities: 0, // 6-12
      afternoonActivities: 0, // 12-18
      eveningActivities: 0, // 18-22
      nightActivities: 0, // 22-6
    };

    activities.forEach(activity => {
      const hour = activity.createdAt.getHours();

      if (hour >= 6 && hour < 12) {
        pattern.morningActivities++;
      } else if (hour >= 12 && hour < 18) {
        pattern.afternoonActivities++;
      } else if (hour >= 18 && hour < 22) {
        pattern.eveningActivities++;
      } else {
        pattern.nightActivities++;
      }
    });

    return pattern;
  }

  private async calculateActivityStreak(
    userId: string,
    endDate: Date
  ): Promise<number> {
    try {
      // Get activities for the last 100 days to calculate streak
      const startDate = new Date(endDate.getTime() - 100 * 24 * 60 * 60 * 1000);
      const activities = await this.activityRepository.findByUser(userId, {
        startDate,
        endDate,
      });

      // Group activities by date
      const activityDates = new Set<string>();
      activities.forEach(activity => {
        const dateStr = activity.createdAt.toISOString().split('T')[0];
        activityDates.add(dateStr);
      });

      // Calculate streak from end date backwards
      let streak = 0;
      const currentDate = new Date(endDate);

      while (true) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (activityDates.has(dateStr)) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      this.logger.error('Failed to calculate activity streak', {
        error: error.message,
        userId,
        endDate,
      });
      return 0;
    }
  }
}
