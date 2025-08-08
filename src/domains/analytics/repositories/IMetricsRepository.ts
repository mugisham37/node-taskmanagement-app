import { MetricsEntity } from '../entities/MetricsEntity';
import {
  MetricType,
  MetricTimeSeries,
  MetricAggregation,
} from '../value-objects/MetricTypes';

export interface MetricFilter {
  name?: string;
  type?: MetricType;
  workspaceId?: string;
  projectId?: string;
  userId?: string;
  tags?: Record<string, string>;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface MetricQuery {
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
  startTime: Date;
  endTime: Date;
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  tags: Record<string, string>;
}

export interface IMetricsRepository {
  // Basic CRUD operations
  create(metric: MetricsEntity): Promise<MetricsEntity>;
  findById(id: string): Promise<MetricsEntity | null>;
  update(id: string, updates: Partial<MetricsEntity>): Promise<MetricsEntity>;
  delete(id: string): Promise<void>;

  // Query operations
  findMany(filter: MetricFilter): Promise<{
    data: MetricsEntity[];
    total: number;
    hasMore: boolean;
  }>;

  findByName(
    name: string,
    options?: {
      startTime?: Date;
      endTime?: Date;
      tags?: Record<string, string>;
      limit?: number;
    }
  ): Promise<MetricsEntity[]>;

  findByTags(
    tags: Record<string, string>,
    options?: {
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    }
  ): Promise<MetricsEntity[]>;

  // Time series operations
  getTimeSeries(query: MetricQuery): Promise<MetricTimeSeries>;

  getMultipleTimeSeries(queries: MetricQuery[]): Promise<MetricTimeSeries[]>;

  // Aggregation operations
  aggregate(
    name: string,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    options?: {
      startTime?: Date;
      endTime?: Date;
      tags?: Record<string, string>;
      groupBy?: 'hour' | 'day' | 'week' | 'month';
    }
  ): Promise<MetricAggregation>;

  // Real-time operations
  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    timestamp?: Date
  ): Promise<void>;

  recordCounter(
    name: string,
    increment?: number,
    tags?: Record<string, string>
  ): Promise<void>;

  recordGauge(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): Promise<void>;

  recordHistogram(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): Promise<void>;

  // Batch operations
  recordMetrics(
    metrics: Array<{
      name: string;
      value: number;
      tags?: Record<string, string>;
      timestamp?: Date;
    }>
  ): Promise<void>;

  // Dashboard queries
  getDashboardMetrics(
    workspaceId?: string,
    timeRange?: {
      startTime: Date;
      endTime: Date;
    }
  ): Promise<{
    userMetrics: {
      activeUsers: number;
      newUsers: number;
      userGrowthRate: number;
      averageSessionDuration: number;
    };
    taskMetrics: {
      tasksCreated: number;
      tasksCompleted: number;
      completionRate: number;
      averageCompletionTime: number;
      overdueTasksCount: number;
    };
    projectMetrics: {
      activeProjects: number;
      projectCompletionRate: number;
      averageProjectDuration: number;
    };
    performanceMetrics: {
      averageResponseTime: number;
      errorRate: number;
      throughput: number;
    };
  }>;

  // Workspace-specific metrics
  getWorkspaceMetrics(
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
  }>;

  // User-specific metrics
  getUserMetrics(
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
  }>;

  // Project-specific metrics
  getProjectMetrics(
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
  }>;

  // Trend analysis
  getTrendAnalysis(
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
  }>;

  // Comparative analysis
  compareMetrics(
    metricName: string,
    comparisons: Array<{
      label: string;
      workspaceId?: string;
      projectId?: string;
      userId?: string;
    }>,
    timeRange: {
      startTime: Date;
      endTime: Date;
    }
  ): Promise<
    Array<{
      label: string;
      value: number;
      change: number;
      rank: number;
    }>
  >;

  // Anomaly detection
  detectAnomalies(
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
  >;

  // Data retention and cleanup
  cleanup(olderThan: Date): Promise<number>;

  // Export operations
  exportMetrics(
    filter: MetricFilter,
    format: 'json' | 'csv' | 'xlsx'
  ): Promise<Buffer>;

  // Health and monitoring
  getRepositoryHealth(): Promise<{
    totalMetrics: number;
    oldestMetric: Date;
    newestMetric: Date;
    storageSize: number;
    indexHealth: 'good' | 'degraded' | 'poor';
  }>;
}
