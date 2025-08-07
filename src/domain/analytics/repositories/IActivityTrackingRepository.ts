import { ActivityTrackingEntity } from '../entities/ActivityTrackingEntity';
import { ActivityType } from '../value-objects/ActivityTypes';

export interface ActivityFilter {
  userId?: string;
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
  type?: ActivityType;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'duration';
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityAggregation {
  groupBy:
    | 'user'
    | 'workspace'
    | 'project'
    | 'task'
    | 'type'
    | 'action'
    | 'hour'
    | 'day'
    | 'week'
    | 'month';
  count: number;
  totalDuration?: number;
  averageDuration?: number;
  uniqueUsers?: number;
  uniqueSessions?: number;
}

export interface ActivityInsights {
  totalActivities: number;
  uniqueUsers: number;
  uniqueSessions: number;
  averageDuration: number;
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  activityByHour: Array<{ hour: number; count: number }>;
  activityByDay: Array<{ day: string; count: number }>;
  performanceMetrics: {
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
  };
}

export interface IActivityTrackingRepository {
  // Basic CRUD operations
  create(activity: ActivityTrackingEntity): Promise<ActivityTrackingEntity>;
  findById(id: string): Promise<ActivityTrackingEntity | null>;
  update(
    id: string,
    updates: Partial<ActivityTrackingEntity>
  ): Promise<ActivityTrackingEntity>;
  delete(id: string): Promise<void>;

  // Query operations
  findMany(filter: ActivityFilter): Promise<{
    data: ActivityTrackingEntity[];
    total: number;
    hasMore: boolean;
  }>;

  findByUser(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<ActivityTrackingEntity[]>;

  findByWorkspace(
    workspaceId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<ActivityTrackingEntity[]>;

  findByProject(
    projectId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<ActivityTrackingEntity[]>;

  findByTask(
    taskId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<ActivityTrackingEntity[]>;

  // Aggregation operations
  aggregate(
    filter: ActivityFilter,
    groupBy: ActivityAggregation['groupBy']
  ): Promise<ActivityAggregation[]>;

  getActivityInsights(filter: ActivityFilter): Promise<ActivityInsights>;

  getUserActivitySummary(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalActivities: number;
    uniqueDays: number;
    averageActivitiesPerDay: number;
    mostActiveHour: number;
    mostActiveDay: string;
    topActions: Array<{ action: string; count: number }>;
    productivityScore: number;
  }>;

  getWorkspaceActivitySummary(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalActivities: number;
    uniqueUsers: number;
    averageActivitiesPerUser: number;
    topUsers: Array<{ userId: string; count: number }>;
    topActions: Array<{ action: string; count: number }>;
    activityTrend: Array<{ date: string; count: number }>;
  }>;

  // Performance tracking
  getPerformanceMetrics(filter: ActivityFilter): Promise<{
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number;
  }>;

  // Real-time operations
  streamActivities(
    filter: ActivityFilter,
    callback: (activity: ActivityTrackingEntity) => void
  ): Promise<() => void>; // Returns unsubscribe function

  // Batch operations
  createMany(
    activities: ActivityTrackingEntity[]
  ): Promise<ActivityTrackingEntity[]>;

  // Data management
  cleanup(olderThan: Date): Promise<number>; // Returns number of deleted records

  // Analytics specific queries
  getActivityHeatmap(
    filter: ActivityFilter,
    granularity: 'hour' | 'day' | 'week'
  ): Promise<
    Array<{
      timestamp: Date;
      count: number;
      intensity: 'low' | 'medium' | 'high';
    }>
  >;

  getUserJourney(
    userId: string,
    sessionId: string
  ): Promise<ActivityTrackingEntity[]>;

  getCollaborationMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date
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
  }>;

  // Export operations
  exportActivities(
    filter: ActivityFilter,
    format: 'json' | 'csv' | 'xlsx'
  ): Promise<Buffer>;
}
