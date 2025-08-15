import { ActivityTracking } from '../entities/activity-tracking';

export interface IActivityTrackingRepository {
  save(activity: ActivityTracking): Promise<void>;
  findById(id: string): Promise<ActivityTracking | null>;
  findByUserId(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<ActivityTracking[]>;
  findByWorkspaceId(
    workspaceId: string,
    limit?: number,
    offset?: number
  ): Promise<ActivityTracking[]>;
  findByProjectId(
    projectId: string,
    limit?: number,
    offset?: number
  ): Promise<ActivityTracking[]>;
  findByTaskId(
    taskId: string,
    limit?: number,
    offset?: number
  ): Promise<ActivityTracking[]>;
  findByAction(
    action: string,
    limit?: number,
    offset?: number
  ): Promise<ActivityTracking[]>;
  findByDateRange(
    startDate: Date,
    endDate: Date,
    limit?: number,
    offset?: number
  ): Promise<ActivityTracking[]>;
  findByUserAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ActivityTracking[]>;
  getActivityStats(
    userId?: string,
    workspaceId?: string
  ): Promise<{
    totalActivities: number;
    uniqueActions: number;
    averageDuration: number;
    topActions: Array<{ action: string; count: number }>;
  }>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  deleteOlderThan(date: Date): Promise<number>;
}
