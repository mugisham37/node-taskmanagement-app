import { MetricsEntity } from '../entities/MetricsEntity';
import { IMetricsRepository } from '../repositories/IMetricsRepository';
import {
  MetricType,
  MetricTimeSeries,
  MetricCalculator,
  MetricRegistry,
} from '../value-objects/MetricTypes';
import { BaseService } from '../../shared/services/BaseService';
import { DomainError } from '../../shared/errors/DomainError';

export interface MetricRecordRequest {
  name: string;
  value: number;
  tags?: Record<string, string>;
  workspaceId?: string;
  projectId?: string;
  userId?: string;
  timestamp?: Date;
}

export interface MetricQueryRequest {
  name: string;
  aggregation?:
    | 'sum'
    | 'avg'
    | 'min'
    | 'max'
    | 'count'
    | 'p50'
    | 'p90'
    | 'p95'
    | 'p99';
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  tags?: Record<string, string>;
  workspaceId?: string;
  projectId?: string;
  userId?: string;
  startTime: Date;
  endTime: Date;
}

export interface DashboardMetrics {
  userMetrics: {
    activeUsers: number;
    newUsers: number;
    userGrowthRate: number;
    averageSessionDuration: number;
    userRetentionRate: number;
  };
  taskMetrics: {
    tasksCreated: number;
    tasksCompleted: number;
    completionRate: number;
    averageCompletionTime: number;
    overdueTasksCount: number;
    taskVelocity: number;
  };
  projectMetrics: {
    activeProjects: number;
    projectCompletionRate: number;
    averageProjectDuration: number;
    projectsAtRisk: number;
  };
  performanceMetrics: {
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    systemUptime: number;
  };
  collaborationMetrics: {
    commentsPerDay: number;
    collaborationScore: number;
    realTimeSessionsActive: number;
    fileSharesCount: number;
  };
}

export interface DataAggregationOptions {
  enableRealTimeAggregation?: boolean;
  aggregationIntervals?: ('minute' | 'hour' | 'day' | 'week' | 'month')[];
  retentionPolicies?: {
    raw: number; // days
    hourly: number; // days
    daily: number; // days
    weekly: number; // days
    monthly: number; // days
  };
  compressionEnabled?: boolean;
  precomputedMetrics?: string[];
}

export interface MetricsDataWarehouse {
  rawMetrics: string;
  aggregatedMetrics: {
    minute: string;
    hour: string;
    day: string;
    week: string;
    month: string;
  };
  dimensionTables: {
    users: string;
    workspaces: string;
    projects: string;
    time: string;
  };
}

export class MetricsCollectionService extends BaseService {
  private readonly batchBuffer: MetricRecordRequest[] = [];
  private readonly batchSize = 100;
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchInterval = 5000; // 5 seconds
  private readonly aggregationOptions: DataAggregationOptions;
  private aggregationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private readonly metricsRepository: IMetricsRepository,
    options: DataAggregationOptions = {}
  ) {
    super('MetricsCollectionService');

    this.aggregationOptions = {
      enableRealTimeAggregation: true,
      aggregationIntervals: ['minute', 'hour', 'day', 'week', 'month'],
      retentionPolicies: {
        raw: 7,
        hourly: 30,
        daily: 365,
        weekly: 730,
        monthly: 2555, // ~7 years
      },
      compressionEnabled: true,
      precomputedMetrics: [
        'task.completion_rate',
        'user.productivity_score',
        'project.health_score',
        'system.performance_metrics',
      ],
      ...options,
    };

    this.startBatchProcessor();
    this.initializeAggregationProcessors();
  }

  async recordMetric(request: MetricRecordRequest): Promise<void> {
    try {
      // Validate metric name
      if (!MetricRegistry.isValidMetricName(request.name)) {
        this.logger.warn('Recording custom metric (not in registry)', {
          metricName: request.name,
        });
      }

      // Add to batch buffer for efficient processing
      this.batchBuffer.push(request);

      // Process immediately if batch is full
      if (this.batchBuffer.length >= this.batchSize) {
        await this.processBatch();
      }
    } catch (error) {
      this.logger.error('Failed to record metric', {
        error: error.message,
        request,
      });
      throw error;
    }
  }

  async recordCounter(
    name: string,
    increment: number = 1,
    tags?: Record<string, string>,
    context?: {
      workspaceId?: string;
      projectId?: string;
      userId?: string;
    }
  ): Promise<void> {
    await this.recordMetric({
      name,
      value: increment,
      tags,
      ...context,
    });
  }

  async recordGauge(
    name: string,
    value: number,
    tags?: Record<string, string>,
    context?: {
      workspaceId?: string;
      projectId?: string;
      userId?: string;
    }
  ): Promise<void> {
    await this.recordMetric({
      name,
      value,
      tags,
      ...context,
    });
  }

  async recordHistogram(
    name: string,
    value: number,
    tags?: Record<string, string>,
    context?: {
      workspaceId?: string;
      projectId?: string;
      userId?: string;
    }
  ): Promise<void> {
    await this.recordMetric({
      name,
      value,
      tags,
      ...context,
    });
  }

  async recordBulkMetrics(requests: MetricRecordRequest[]): Promise<void> {
    try {
      // Validate all requests
      const validRequests = requests.filter(request => {
        if (!request.name || typeof request.value !== 'number') {
          this.logger.warn('Skipping invalid metric in bulk operation', {
            request,
          });
          return false;
        }
        return true;
      });

      // Add to batch buffer
      this.batchBuffer.push(...validRequests);

      // Process if buffer is large
      if (this.batchBuffer.length >= this.batchSize) {
        await this.processBatch();
      }

      this.logger.debug('Bulk metrics added to buffer', {
        requestCount: requests.length,
        validCount: validRequests.length,
        bufferSize: this.batchBuffer.length,
      });
    } catch (error) {
      this.logger.error('Failed to record bulk metrics', {
        error: error.message,
        requestCount: requests.length,
      });
      throw error;
    }
  }

  async getTimeSeries(query: MetricQueryRequest): Promise<MetricTimeSeries> {
    try {
      return await this.metricsRepository.getTimeSeries({
        name: query.name,
        aggregation: query.aggregation,
        groupBy: query.groupBy,
        tags: query.tags,
        startTime: query.startTime,
        endTime: query.endTime,
      });
    } catch (error) {
      this.logger.error('Failed to get time series', {
        error: error.message,
        query,
      });
      throw error;
    }
  }

  async getMultipleTimeSeries(
    queries: MetricQueryRequest[]
  ): Promise<MetricTimeSeries[]> {
    try {
      const repositoryQueries = queries.map(query => ({
        name: query.name,
        aggregation: query.aggregation,
        groupBy: query.groupBy,
        tags: query.tags,
        startTime: query.startTime,
        endTime: query.endTime,
      }));

      return await this.metricsRepository.getMultipleTimeSeries(
        repositoryQueries
      );
    } catch (error) {
      this.logger.error('Failed to get multiple time series', {
        error: error.message,
        queryCount: queries.length,
      });
      throw error;
    }
  }

  async getDashboardMetrics(
    workspaceId?: string,
    timeRange?: {
      startTime: Date;
      endTime: Date;
    }
  ): Promise<DashboardMetrics> {
    try {
      const repositoryMetrics =
        await this.metricsRepository.getDashboardMetrics(
          workspaceId,
          timeRange
        );

      // Enhance with additional calculated metrics
      const enhancedMetrics: DashboardMetrics = {
        userMetrics: {
          ...repositoryMetrics.userMetrics,
          userRetentionRate: await this.calculateUserRetentionRate(
            workspaceId,
            timeRange
          ),
        },
        taskMetrics: {
          ...repositoryMetrics.taskMetrics,
          taskVelocity: await this.calculateTaskVelocity(
            workspaceId,
            timeRange
          ),
        },
        projectMetrics: {
          ...repositoryMetrics.projectMetrics,
          projectsAtRisk: await this.calculateProjectsAtRisk(workspaceId),
        },
        performanceMetrics: {
          ...repositoryMetrics.performanceMetrics,
          systemUptime: await this.calculateSystemUptime(timeRange),
        },
        collaborationMetrics: {
          commentsPerDay: await this.calculateCommentsPerDay(
            workspaceId,
            timeRange
          ),
          collaborationScore: await this.calculateCollaborationScore(
            workspaceId,
            timeRange
          ),
          realTimeSessionsActive:
            await this.getRealTimeSessionsCount(workspaceId),
          fileSharesCount: await this.getFileSharesCount(
            workspaceId,
            timeRange
          ),
        },
      };

      return enhancedMetrics;
    } catch (error) {
      this.logger.error('Failed to get dashboard metrics', {
        error: error.message,
        workspaceId,
        timeRange,
      });
      throw error;
    }
  }

  async getWorkspaceMetrics(
    workspaceId: string,
    timeRange: {
      startTime: Date;
      endTime: Date;
    }
  ): Promise<{
    overview: {
      totalUsers: number;
      activeUsers: number;
      totalProjects: number;
      totalTasks: number;
      completionRate: number;
    };
    productivity: {
      tasksPerUser: number;
      averageTaskCompletionTime: number;
      productivityScore: number;
      collaborationIndex: number;
    };
    growth: {
      userGrowthRate: number;
      taskGrowthRate: number;
      projectGrowthRate: number;
    };
    performance: {
      systemResponseTime: number;
      userSatisfactionScore: number;
      errorRate: number;
    };
  }> {
    try {
      return await this.metricsRepository.getWorkspaceMetrics(
        workspaceId,
        timeRange
      );
    } catch (error) {
      this.logger.error('Failed to get workspace metrics', {
        error: error.message,
        workspaceId,
        timeRange,
      });
      throw error;
    }
  }

  async getUserMetrics(
    userId: string,
    timeRange: {
      startTime: Date;
      endTime: Date;
    }
  ): Promise<{
    productivity: {
      tasksCompleted: number;
      tasksCreated: number;
      averageCompletionTime: number;
      productivityScore: number;
      streakDays: number;
    };
    activity: {
      totalActivities: number;
      averageActivitiesPerDay: number;
      mostActiveHour: number;
      mostActiveDay: string;
    };
    collaboration: {
      commentsAdded: number;
      mentionsReceived: number;
      collaborationScore: number;
    };
    performance: {
      averageResponseTime: number;
      errorRate: number;
    };
  }> {
    try {
      return await this.metricsRepository.getUserMetrics(userId, timeRange);
    } catch (error) {
      this.logger.error('Failed to get user metrics', {
        error: error.message,
        userId,
        timeRange,
      });
      throw error;
    }
  }

  async getProjectMetrics(
    projectId: string,
    timeRange: {
      startTime: Date;
      endTime: Date;
    }
  ): Promise<{
    overview: {
      totalTasks: number;
      completedTasks: number;
      completionRate: number;
      teamSize: number;
    };
    progress: {
      tasksCompletedThisPeriod: number;
      averageTaskCompletionTime: number;
      burndownRate: number;
      estimatedCompletionDate: Date | null;
    };
    team: {
      mostProductiveMember: string;
      averageProductivityScore: number;
      collaborationIndex: number;
    };
    quality: {
      averageTaskComplexity: number;
      reworkRate: number;
      customerSatisfactionScore: number;
    };
  }> {
    try {
      return await this.metricsRepository.getProjectMetrics(
        projectId,
        timeRange
      );
    } catch (error) {
      this.logger.error('Failed to get project metrics', {
        error: error.message,
        projectId,
        timeRange,
      });
      throw error;
    }
  }

  async getTrendAnalysis(
    metricName: string,
    options: {
      workspaceId?: string;
      projectId?: string;
      userId?: string;
      timeRange: {
        startTime: Date;
        endTime: Date;
      };
      granularity: 'hour' | 'day' | 'week' | 'month';
    }
  ): Promise<{
    trend: 'increasing' | 'decreasing' | 'stable';
    trendPercentage: number;
    dataPoints: Array<{
      timestamp: Date;
      value: number;
      change: number;
    }>;
    forecast: Array<{
      timestamp: Date;
      predictedValue: number;
      confidence: number;
    }>;
  }> {
    try {
      return await this.metricsRepository.getTrendAnalysis(metricName, options);
    } catch (error) {
      this.logger.error('Failed to get trend analysis', {
        error: error.message,
        metricName,
        options,
      });
      throw error;
    }
  }

  async detectAnomalies(
    metricName: string,
    options: {
      workspaceId?: string;
      projectId?: string;
      userId?: string;
      timeRange: {
        startTime: Date;
        endTime: Date;
      };
      sensitivity: 'low' | 'medium' | 'high';
    }
  ): Promise<
    Array<{
      timestamp: Date;
      value: number;
      expectedValue: number;
      anomalyScore: number;
      type: 'spike' | 'drop' | 'trend_change';
    }>
  > {
    try {
      return await this.metricsRepository.detectAnomalies(metricName, options);
    } catch (error) {
      this.logger.error('Failed to detect anomalies', {
        error: error.message,
        metricName,
        options,
      });
      throw error;
    }
  }

  async cleanupOldMetrics(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const deletedCount = await this.metricsRepository.cleanup(cutoffDate);

      this.logger.info('Old metrics cleaned up', {
        deletedCount,
        cutoffDate,
        olderThanDays,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old metrics', {
        error: error.message,
        olderThanDays,
      });
      throw error;
    }
  }

  private initializeAggregationProcessors(): void {
    if (!this.aggregationOptions.enableRealTimeAggregation) return;

    // Set up aggregation timers for different intervals
    this.aggregationOptions.aggregationIntervals?.forEach(interval => {
      const intervalMs = this.getIntervalMilliseconds(interval);

      const timer = setInterval(async () => {
        await this.performAggregation(interval);
      }, intervalMs);

      this.aggregationTimers.set(interval, timer);
    });
  }

  private getIntervalMilliseconds(interval: string): number {
    switch (interval) {
      case 'minute':
        return 60 * 1000;
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000; // Default to hourly
    }
  }

  private async performAggregation(
    interval: 'minute' | 'hour' | 'day' | 'week' | 'month'
  ): Promise<void> {
    try {
      const now = new Date();
      const startTime = this.getAggregationStartTime(now, interval);
      const endTime = this.getAggregationEndTime(startTime, interval);

      // Get raw metrics for the period
      const rawMetrics = await this.metricsRepository.getRawMetrics({
        startTime,
        endTime,
      });

      // Perform aggregation calculations
      const aggregatedData = await this.calculateAggregations(
        rawMetrics,
        interval
      );

      // Store aggregated data
      await this.storeAggregatedMetrics(aggregatedData, interval);

      // Clean up old raw data if needed
      if (interval === 'hour') {
        await this.cleanupRawMetrics();
      }

      this.logger.debug('Aggregation completed', {
        interval,
        startTime,
        endTime,
        rawMetricsCount: rawMetrics.length,
        aggregatedMetricsCount: aggregatedData.length,
      });
    } catch (error) {
      this.logger.error('Failed to perform aggregation', {
        error: error.message,
        interval,
      });
    }
  }

  private getAggregationStartTime(now: Date, interval: string): Date {
    const date = new Date(now);

    switch (interval) {
      case 'minute':
        date.setSeconds(0, 0);
        date.setMinutes(date.getMinutes() - 1);
        break;
      case 'hour':
        date.setMinutes(0, 0, 0);
        date.setHours(date.getHours() - 1);
        break;
      case 'day':
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - 1);
        break;
      case 'week':
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - date.getDay() - 7);
        break;
      case 'month':
        date.setHours(0, 0, 0, 0);
        date.setDate(1);
        date.setMonth(date.getMonth() - 1);
        break;
    }

    return date;
  }

  private getAggregationEndTime(startTime: Date, interval: string): Date {
    const date = new Date(startTime);

    switch (interval) {
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

  private async calculateAggregations(
    rawMetrics: any[],
    interval: string
  ): Promise<any[]> {
    const aggregations: any[] = [];

    // Group metrics by name and tags
    const groupedMetrics = this.groupMetricsByNameAndTags(rawMetrics);

    for (const [key, metrics] of groupedMetrics.entries()) {
      const [name, tagsStr] = key.split('|');
      const tags = tagsStr ? JSON.parse(tagsStr) : {};

      // Calculate various aggregations
      const aggregation = {
        name,
        tags,
        interval,
        timestamp: new Date(),
        aggregations: {
          sum: metrics.reduce((sum, m) => sum + m.value, 0),
          avg: metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length,
          min: Math.min(...metrics.map(m => m.value)),
          max: Math.max(...metrics.map(m => m.value)),
          count: metrics.length,
          p50: this.calculatePercentile(
            metrics.map(m => m.value),
            0.5
          ),
          p90: this.calculatePercentile(
            metrics.map(m => m.value),
            0.9
          ),
          p95: this.calculatePercentile(
            metrics.map(m => m.value),
            0.95
          ),
          p99: this.calculatePercentile(
            metrics.map(m => m.value),
            0.99
          ),
        },
      };

      aggregations.push(aggregation);
    }

    return aggregations;
  }

  private groupMetricsByNameAndTags(metrics: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    metrics.forEach(metric => {
      const tagsStr = JSON.stringify(metric.tags || {});
      const key = `${metric.name}|${tagsStr}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key)!.push(metric);
    });

    return grouped;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  private async storeAggregatedMetrics(
    aggregations: any[],
    interval: string
  ): Promise<void> {
    try {
      await this.metricsRepository.storeAggregatedMetrics(
        aggregations,
        interval
      );
    } catch (error) {
      this.logger.error('Failed to store aggregated metrics', {
        error: error.message,
        interval,
        aggregationsCount: aggregations.length,
      });
      throw error;
    }
  }

  private async cleanupRawMetrics(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - this.aggregationOptions.retentionPolicies!.raw
      );

      const deletedCount =
        await this.metricsRepository.cleanupRawMetrics(cutoffDate);

      this.logger.info('Raw metrics cleaned up', {
        deletedCount,
        cutoffDate,
      });
    } catch (error) {
      this.logger.error('Failed to cleanup raw metrics', {
        error: error.message,
      });
    }
  }

  async setupDataWarehouse(): Promise<MetricsDataWarehouse> {
    try {
      const schema: MetricsDataWarehouse = {
        rawMetrics: 'metrics_raw',
        aggregatedMetrics: {
          minute: 'metrics_agg_minute',
          hour: 'metrics_agg_hour',
          day: 'metrics_agg_day',
          week: 'metrics_agg_week',
          month: 'metrics_agg_month',
        },
        dimensionTables: {
          users: 'dim_users',
          workspaces: 'dim_workspaces',
          projects: 'dim_projects',
          time: 'dim_time',
        },
      };

      // Create warehouse tables
      await this.createWarehouseTables(schema);

      // Set up indexes for performance
      await this.createWarehouseIndexes(schema);

      this.logger.info('Metrics data warehouse setup completed', { schema });

      return schema;
    } catch (error) {
      this.logger.error('Failed to setup metrics data warehouse', {
        error: error.message,
      });
      throw error;
    }
  }

  private async createWarehouseTables(
    schema: MetricsDataWarehouse
  ): Promise<void> {
    // Implementation would create the actual database tables
    // This is a placeholder for the table creation logic
  }

  private async createWarehouseIndexes(
    schema: MetricsDataWarehouse
  ): Promise<void> {
    // Implementation would create indexes for optimal query performance
    // This is a placeholder for the index creation logic
  }

  async precomputeMetrics(): Promise<void> {
    try {
      for (const metricName of this.aggregationOptions.precomputedMetrics ||
        []) {
        await this.precomputeMetric(metricName);
      }
    } catch (error) {
      this.logger.error('Failed to precompute metrics', {
        error: error.message,
      });
      throw error;
    }
  }

  private async precomputeMetric(metricName: string): Promise<void> {
    try {
      switch (metricName) {
        case 'task.completion_rate':
          await this.precomputeTaskCompletionRate();
          break;
        case 'user.productivity_score':
          await this.precomputeUserProductivityScore();
          break;
        case 'project.health_score':
          await this.precomputeProjectHealthScore();
          break;
        case 'system.performance_metrics':
          await this.precomputeSystemPerformanceMetrics();
          break;
        default:
          this.logger.warn('Unknown precomputed metric', { metricName });
      }
    } catch (error) {
      this.logger.error('Failed to precompute metric', {
        error: error.message,
        metricName,
      });
    }
  }

  private async precomputeTaskCompletionRate(): Promise<void> {
    // Implementation for precomputing task completion rates
    // This would calculate and store completion rates for different time periods
  }

  private async precomputeUserProductivityScore(): Promise<void> {
    // Implementation for precomputing user productivity scores
    // This would calculate and store productivity scores for all users
  }

  private async precomputeProjectHealthScore(): Promise<void> {
    // Implementation for precomputing project health scores
    // This would calculate and store health scores for all projects
  }

  private async precomputeSystemPerformanceMetrics(): Promise<void> {
    // Implementation for precomputing system performance metrics
    // This would calculate and store system-wide performance indicators
  }

  private startBatchProcessor(): void {
    this.batchTimer = setInterval(async () => {
      if (this.batchBuffer.length > 0) {
        await this.processBatch();
      }
    }, this.batchInterval);
  }

  private async processBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    try {
      const batch = this.batchBuffer.splice(0, this.batchSize);

      const metricsToRecord = batch.map(request => ({
        name: request.name,
        value: request.value,
        tags: request.tags || {},
        timestamp: request.timestamp || new Date(),
      }));

      await this.metricsRepository.recordMetrics(metricsToRecord);

      this.logger.debug('Batch processed successfully', {
        batchSize: batch.length,
        remainingInBuffer: this.batchBuffer.length,
      });
    } catch (error) {
      this.logger.error('Failed to process metrics batch', {
        error: error.message,
        batchSize: this.batchBuffer.length,
      });
      // Don't throw here to avoid stopping the batch processor
    }
  }

  // Helper methods for enhanced metrics calculation
  private async calculateUserRetentionRate(
    workspaceId?: string,
    timeRange?: { startTime: Date; endTime: Date }
  ): Promise<number> {
    // Implementation would query user login patterns
    // This is a simplified version
    return 85.5; // Placeholder
  }

  private async calculateTaskVelocity(
    workspaceId?: string,
    timeRange?: { startTime: Date; endTime: Date }
  ): Promise<number> {
    // Implementation would calculate tasks completed per time period
    return 12.3; // Placeholder
  }

  private async calculateProjectsAtRisk(workspaceId?: string): Promise<number> {
    // Implementation would analyze project health indicators
    return 3; // Placeholder
  }

  private async calculateSystemUptime(timeRange?: {
    startTime: Date;
    endTime: Date;
  }): Promise<number> {
    // Implementation would calculate system availability
    return 99.9; // Placeholder
  }

  private async calculateCommentsPerDay(
    workspaceId?: string,
    timeRange?: { startTime: Date; endTime: Date }
  ): Promise<number> {
    // Implementation would query comment metrics
    return 45.2; // Placeholder
  }

  private async calculateCollaborationScore(
    workspaceId?: string,
    timeRange?: { startTime: Date; endTime: Date }
  ): Promise<number> {
    // Implementation would calculate collaboration index
    return 78.5; // Placeholder
  }

  private async getRealTimeSessionsCount(
    workspaceId?: string
  ): Promise<number> {
    // Implementation would query active WebSocket connections
    return 12; // Placeholder
  }

  private async getFileSharesCount(
    workspaceId?: string,
    timeRange?: { startTime: Date; endTime: Date }
  ): Promise<number> {
    // Implementation would query file sharing metrics
    return 89; // Placeholder
  }

  // Cleanup on service shutdown
  destroy(): void {
    // Clear batch processor timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Clear aggregation timers
    this.aggregationTimers.forEach((timer, interval) => {
      clearInterval(timer);
      this.logger.debug('Aggregation timer cleared', { interval });
    });
    this.aggregationTimers.clear();

    // Process any remaining metrics in buffer
    if (this.batchBuffer.length > 0) {
      this.processBatch().catch(error => {
        this.logger.error('Failed to process final batch on shutdown', {
          error: error.message,
        });
      });
    }
  }
}
