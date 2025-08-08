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
import { EventEmitter } from 'events';
import { Logger } from '../../../infrastructure/logging/logger';

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

export interface DataProcessingOptions {
  batchSize?: number;
  processingInterval?: number;
  enableRealTimeProcessing?: boolean;
  enableBatchProcessing?: boolean;
  retentionPeriodDays?: number;
  compressionEnabled?: boolean;
  aggregationLevel?: 'minute' | 'hour' | 'day' | 'week' | 'month';
}

export interface MetricsAggregation {
  timestamp: Date;
  period: string;
  totalActivities: number;
  uniqueUsers: number;
  uniqueSessions: number;
  averageDuration: number;
  peakConcurrentUsers: number;
  errorCount: number;
  successRate: number;
  topActions: Array<{ action: string; count: number }>;
  performanceMetrics: {
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export interface DataWarehouseSchema {
  factTables: {
    activities: string;
    userSessions: string;
    performanceMetrics: string;
    errorLogs: string;
  };
  dimensionTables: {
    users: string;
    workspaces: string;
    projects: string;
    tasks: string;
    time: string;
  };
  aggregationTables: {
    hourlyMetrics: string;
    dailyMetrics: string;
    weeklyMetrics: string;
    monthlyMetrics: string;
  };
}

export class ActivityTrackingService extends BaseService {
  private eventEmitter: EventEmitter;
  private processingQueue: TrackActivityRequest[] = [];
  private batchProcessor: NodeJS.Timeout | null = null;
  private readonly dataProcessingOptions: DataProcessingOptions;

  constructor(
    private readonly activityRepository: IActivityTrackingRepository,
    options: DataProcessingOptions = {}
  ) {
    super('ActivityTrackingService');
    this.eventEmitter = new EventEmitter();
    this.dataProcessingOptions = {
      batchSize: 1000,
      processingInterval: 5000, // 5 seconds
      enableRealTimeProcessing: true,
      enableBatchProcessing: true,
      retentionPeriodDays: 365,
      compressionEnabled: true,
      aggregationLevel: 'hour',
      ...options,
    };

    this.initializeBatchProcessor();
    this.setupEventListeners();
  }

  private initializeBatchProcessor(): void {
    if (this.dataProcessingOptions.enableBatchProcessing) {
      this.batchProcessor = setInterval(
        () => this.processBatch(),
        this.dataProcessingOptions.processingInterval
      );
    }
  }

  private setupEventListeners(): void {
    this.eventEmitter.on(
      'activity:tracked',
      this.handleActivityTracked.bind(this)
    );
    this.eventEmitter.on(
      'batch:processed',
      this.handleBatchProcessed.bind(this)
    );
    this.eventEmitter.on(
      'metrics:aggregated',
      this.handleMetricsAggregated.bind(this)
    );
  }

  private async handleActivityTracked(
    activity: ActivityTrackingEntity
  ): Promise<void> {
    try {
      // Real-time processing
      if (this.dataProcessingOptions.enableRealTimeProcessing) {
        await this.processActivityRealTime(activity);
      }

      // Emit domain events for other services
      this.eventEmitter.emit('activity:processed', {
        activityId: activity.id,
        userId: activity.userId,
        type: activity.type,
        timestamp: activity.createdAt,
      });
    } catch (error) {
      this.logger.error('Failed to handle activity tracked event', {
        error: error.message,
        activityId: activity.id,
      });
    }
  }

  private async handleBatchProcessed(batchInfo: {
    size: number;
    duration: number;
  }): Promise<void> {
    this.logger.info('Batch processed successfully', batchInfo);

    // Trigger aggregation if needed
    await this.triggerAggregation();
  }

  private async handleMetricsAggregated(
    aggregation: MetricsAggregation
  ): Promise<void> {
    this.logger.info('Metrics aggregated', {
      period: aggregation.period,
      totalActivities: aggregation.totalActivities,
      timestamp: aggregation.timestamp,
    });
  }

  private async processActivityRealTime(
    activity: ActivityTrackingEntity
  ): Promise<void> {
    try {
      // Update real-time metrics
      await this.updateRealTimeMetrics(activity);

      // Check for anomalies
      await this.detectAnomalies(activity);

      // Update user session tracking
      await this.updateUserSession(activity);
    } catch (error) {
      this.logger.error('Failed to process activity in real-time', {
        error: error.message,
        activityId: activity.id,
      });
    }
  }

  private async processBatch(): Promise<void> {
    if (this.processingQueue.length === 0) return;

    const startTime = Date.now();
    const batchSize = Math.min(
      this.processingQueue.length,
      this.dataProcessingOptions.batchSize!
    );

    const batch = this.processingQueue.splice(0, batchSize);

    try {
      // Process batch activities
      const activities = await this.trackBulkActivities(batch);

      // Emit batch processed event
      this.eventEmitter.emit('batch:processed', {
        size: activities.length,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error('Failed to process batch', {
        error: error.message,
        batchSize,
      });

      // Re-queue failed items
      this.processingQueue.unshift(...batch);
    }
  }

  private async updateRealTimeMetrics(
    activity: ActivityTrackingEntity
  ): Promise<void> {
    // Implementation for real-time metrics updates
    // This would typically update Redis or in-memory cache
  }

  private async detectAnomalies(
    activity: ActivityTrackingEntity
  ): Promise<void> {
    // Implementation for anomaly detection
    // Could detect unusual patterns, spikes, or suspicious activities
  }

  private async updateUserSession(
    activity: ActivityTrackingEntity
  ): Promise<void> {
    // Implementation for user session tracking
    // Update session duration, activity count, etc.
  }

  private async triggerAggregation(): Promise<void> {
    try {
      const now = new Date();
      const aggregation = await this.aggregateMetrics(now);

      this.eventEmitter.emit('metrics:aggregated', aggregation);
    } catch (error) {
      this.logger.error('Failed to trigger aggregation', {
        error: error.message,
      });
    }
  }

  async aggregateMetrics(timestamp: Date): Promise<MetricsAggregation> {
    try {
      const period = this.getPeriodString(
        timestamp,
        this.dataProcessingOptions.aggregationLevel!
      );
      const startTime = this.getPeriodStart(
        timestamp,
        this.dataProcessingOptions.aggregationLevel!
      );
      const endTime = this.getPeriodEnd(
        timestamp,
        this.dataProcessingOptions.aggregationLevel!
      );

      // Get activities for the period
      const activities = await this.activityRepository.findByDateRange(
        startTime,
        endTime
      );

      // Calculate aggregated metrics
      const totalActivities = activities.length;
      const uniqueUsers = new Set(activities.map(a => a.userId)).size;
      const uniqueSessions = new Set(
        activities.map(a => a.sessionId).filter(Boolean)
      ).size;

      const durations = activities
        .map(a => a.duration)
        .filter(Boolean) as number[];
      const averageDuration =
        durations.length > 0
          ? durations.reduce((sum, d) => sum + d, 0) / durations.length
          : 0;

      // Calculate performance metrics
      const performanceMetrics =
        await this.calculatePerformanceMetrics(activities);

      // Get top actions
      const actionCounts = new Map<string, number>();
      activities.forEach(activity => {
        const count = actionCounts.get(activity.action) || 0;
        actionCounts.set(activity.action, count + 1);
      });

      const topActions = Array.from(actionCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const aggregation: MetricsAggregation = {
        timestamp,
        period,
        totalActivities,
        uniqueUsers,
        uniqueSessions,
        averageDuration,
        peakConcurrentUsers: await this.calculatePeakConcurrentUsers(
          startTime,
          endTime
        ),
        errorCount: activities.filter(a => a.metadata?.error).length,
        successRate:
          totalActivities > 0
            ? ((totalActivities -
                activities.filter(a => a.metadata?.error).length) /
                totalActivities) *
              100
            : 100,
        topActions,
        performanceMetrics,
      };

      // Store aggregation
      await this.storeAggregation(aggregation);

      return aggregation;
    } catch (error) {
      this.logger.error('Failed to aggregate metrics', {
        error: error.message,
        timestamp,
      });
      throw error;
    }
  }

  private async calculatePerformanceMetrics(
    activities: ActivityTrackingEntity[]
  ): Promise<{
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
    errorRate: number;
  }> {
    const responseTimes = activities
      .map(a => a.metadata?.responseTime)
      .filter(Boolean) as number[];

    if (responseTimes.length === 0) {
      return {
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 0,
      };
    }

    responseTimes.sort((a, b) => a - b);

    const averageResponseTime =
      responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    const p50ResponseTime =
      responseTimes[Math.floor(responseTimes.length * 0.5)];
    const p95ResponseTime =
      responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99ResponseTime =
      responseTimes[Math.floor(responseTimes.length * 0.99)];

    const errorCount = activities.filter(a => a.metadata?.error).length;
    const errorRate = (errorCount / activities.length) * 100;

    // Calculate throughput (activities per hour)
    const timeSpanHours = 1; // Assuming 1-hour aggregation
    const throughput = activities.length / timeSpanHours;

    return {
      averageResponseTime,
      p50ResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      throughput,
      errorRate,
    };
  }

  private async calculatePeakConcurrentUsers(
    startTime: Date,
    endTime: Date
  ): Promise<number> {
    // Implementation to calculate peak concurrent users
    // This would require session tracking and overlap analysis
    return 0; // Placeholder
  }

  private async storeAggregation(
    aggregation: MetricsAggregation
  ): Promise<void> {
    // Store aggregation in data warehouse
    // Implementation would depend on the data warehouse solution
  }

  private getPeriodString(timestamp: Date, level: string): string {
    switch (level) {
      case 'minute':
        return timestamp.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
      case 'hour':
        return timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      case 'day':
        return timestamp.toISOString().substring(0, 10); // YYYY-MM-DD
      case 'week':
        const weekStart = new Date(timestamp);
        weekStart.setDate(timestamp.getDate() - timestamp.getDay());
        return weekStart.toISOString().substring(0, 10);
      case 'month':
        return timestamp.toISOString().substring(0, 7); // YYYY-MM
      default:
        return timestamp.toISOString().substring(0, 13);
    }
  }

  private getPeriodStart(timestamp: Date, level: string): Date {
    const date = new Date(timestamp);

    switch (level) {
      case 'minute':
        date.setSeconds(0, 0);
        break;
      case 'hour':
        date.setMinutes(0, 0, 0);
        break;
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week':
        date.setDate(date.getDate() - date.getDay());
        date.setHours(0, 0, 0, 0);
        break;
      case 'month':
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date;
  }

  private getPeriodEnd(timestamp: Date, level: string): Date {
    const date = this.getPeriodStart(timestamp, level);

    switch (level) {
      case 'minute':
        date.setMinutes(date.getMinutes() + 1);
        break;
      case 'hour':
        date.setHours(date.getHours() + 1);
        break;
      case 'day':
        date.setDate(date.getDate() + 1);
        break;
      case 'week':
        date.setDate(date.getDate() + 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() + 1);
        break;
    }

    return date;
  }

  async setupDataWarehouse(): Promise<DataWarehouseSchema> {
    try {
      const schema: DataWarehouseSchema = {
        factTables: {
          activities: 'fact_activities',
          userSessions: 'fact_user_sessions',
          performanceMetrics: 'fact_performance_metrics',
          errorLogs: 'fact_error_logs',
        },
        dimensionTables: {
          users: 'dim_users',
          workspaces: 'dim_workspaces',
          projects: 'dim_projects',
          tasks: 'dim_tasks',
          time: 'dim_time',
        },
        aggregationTables: {
          hourlyMetrics: 'agg_hourly_metrics',
          dailyMetrics: 'agg_daily_metrics',
          weeklyMetrics: 'agg_weekly_metrics',
          monthlyMetrics: 'agg_monthly_metrics',
        },
      };

      // Create data warehouse tables
      await this.createDataWarehouseTables(schema);

      this.logger.info('Data warehouse setup completed', { schema });

      return schema;
    } catch (error) {
      this.logger.error('Failed to setup data warehouse', {
        error: error.message,
      });
      throw error;
    }
  }

  private async createDataWarehouseTables(
    schema: DataWarehouseSchema
  ): Promise<void> {
    // Implementation for creating data warehouse tables
    // This would depend on the specific database/warehouse solution
  }

  async implementDataRetentionPolicy(): Promise<void> {
    try {
      const retentionDate = new Date();
      retentionDate.setDate(
        retentionDate.getDate() -
          this.dataProcessingOptions.retentionPeriodDays!
      );

      // Archive old data before deletion
      await this.archiveOldData(retentionDate);

      // Delete old data
      const deletedCount = await this.cleanupOldActivities(
        this.dataProcessingOptions.retentionPeriodDays!
      );

      this.logger.info('Data retention policy executed', {
        retentionDate,
        deletedCount,
        retentionPeriodDays: this.dataProcessingOptions.retentionPeriodDays,
      });
    } catch (error) {
      this.logger.error('Failed to implement data retention policy', {
        error: error.message,
      });
      throw error;
    }
  }

  private async archiveOldData(cutoffDate: Date): Promise<void> {
    // Implementation for archiving old data to cold storage
    // Could use AWS S3, Google Cloud Storage, etc.
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

      // Enrich metadata with processing information
      const enrichedMetadata = {
        ...request.metadata,
        processingTimestamp: new Date(),
        processingMode: this.dataProcessingOptions.enableRealTimeProcessing
          ? 'realtime'
          : 'batch',
        version: '1.0',
      };

      // Create activity entity
      const activity = ActivityTrackingEntity.create({
        userId: request.userId,
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        taskId: request.taskId,
        type: request.type,
        action: request.action,
        description: request.description,
        metadata: enrichedMetadata,
        context: request.context || {},
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        sessionId: request.sessionId,
        duration: request.duration,
      });

      let savedActivity: ActivityTrackingEntity;

      if (this.dataProcessingOptions.enableRealTimeProcessing) {
        // Process immediately for real-time
        savedActivity = await this.activityRepository.create(activity);

        // Emit event for real-time processing
        this.eventEmitter.emit('activity:tracked', savedActivity);
      } else {
        // Add to batch processing queue
        this.processingQueue.push(request);

        // Return the activity entity (not yet persisted)
        savedActivity = activity;
      }

      // Log the tracking event
      this.logger.info('Activity tracked successfully', {
        activityId: savedActivity.id,
        userId: request.userId,
        type: request.type,
        action: request.action,
        processingMode: this.dataProcessingOptions.enableRealTimeProcessing
          ? 'realtime'
          : 'batch',
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
