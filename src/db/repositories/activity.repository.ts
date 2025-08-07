import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray, count } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { activities, Activity, NewActivity } from '../schema/activities';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class ActivityRepository extends BaseRepository<Activity, NewActivity> {
  protected table = activities;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 180, keyPrefix: 'activity' }, // Enable caching for activities
      { enabled: true, trackChanges: false } // Don't audit activities themselves
    );
  }

  // Activity-specific methods
  async findByUser(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Activity>> {
    try {
      return await this.findMany({
        where: eq(activities.userId, userId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByUser');
    }
  }

  async findByType(type: string, options: PaginationOptions = {}): Promise<PaginatedResult<Activity>> {
    try {
      return await this.findMany({
        where: eq(activities.type, type),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByType');
    }
  }

  async findByTask(taskId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Activity>> {
    try {
      return await this.findMany({
        where: eq(activities.taskId, taskId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByTask');
    }
  }

  async findByProject(projectId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Activity>> {
    try {
      return await this.findMany({
        where: eq(activities.projectId, projectId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByProject');
    }
  }

  async findByWorkspace(workspaceId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Activity>> {
    try {
      return await this.findMany({
        where: eq(activities.workspaceId, workspaceId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByWorkspace');
    }
  }

  async findByTeam(teamId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Activity>> {
    try {
      return await this.findMany({
        where: eq(activities.teamId, teamId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByTeam');
    }
  }

  async findRecentActivities(hours: number = 24, options: PaginationOptions = {}): Promise<PaginatedResult<Activity>> {
    try {
      const hoursAgo = new Date();
      hoursAgo.setHours(hoursAgo.getHours() - hours);

      // Note: You'd need to implement proper date comparison here with Drizzle
      return await this.findMany({
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findRecentActivities');
    }
  }

  async getActivityStats(userId?: string): Promise<{
    total: number;
    today: number;
    thisWeek: number;
    byType: Record<string, number>;
  }> {
    try {
      const baseWhere = userId ? eq(activities.userId, userId) : undefined;

      const [total] = await Promise.all([
        this.count({ where: baseWhere })
      ]);

      // For date-based stats, we'd need proper date comparison
      const today = 0; // Placeholder
      const thisWeek = 0; // Placeholder
      const byType: Record<string, number> = {}; // Placeholder

      return {
        total,
        today,
        thisWeek,
        byType
      };
    } catch (error) {
      throw this.handleError(error, 'getActivityStats');
    }
  }

  async logTaskActivity(
    userId: string,
    taskId: string,
    type: string,
    data: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<Activity> {
    try {
      const activityData: NewActivity = {
        userId,
        taskId,
        type,
        data,
        metadata: metadata || {}
      };

      return await this.create(activityData);
    } catch (error) {
      throw this.handleError(error, 'logTaskActivity');
    }
  }

  async logProjectActivity(
    userId: string,
    projectId: string,
    type: string,
    data: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<Activity> {
    try {
      const activityData: NewActivity = {
        userId,
        projectId,
        type,
        data,
        metadata: metadata || {}
      };

      return await this.create(activityData);
    } catch (error) {
      throw this.handleError(error, 'logProjectActivity');
    }
  }

  async logWorkspaceActivity(
    userId: string,
    workspaceId: string,
    type: string,
    data: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<Activity> {
    try {
      const activityData: NewActivity = {
        userId,
        workspaceId,
        type,
        data,
        metadata: metadata || {}
      };

      return await this.create(activityData);
    } catch (error) {
      throw this.handleError(error, 'logWorkspaceActivity');
    }
  }

  async logTeamActivity(
    userId: string,
    teamId: string,
    type: string,
    data: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<Activity> {
    try {
      const activityData: NewActivity = {
        userId,
        teamId,
        type,
        data,
        metadata: metadata || {}
      };

      return await this.create(activityData);
    } catch (error) {
      throw this.handleError(error, 'logTeamActivity');
    }
  }

  async logGenericActivity(
    userId: string,
    type: string,
    data: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<Activity> {
    try {
      const activityData: NewActivity = {
        userId,
        type,
        data,
        metadata: metadata || {}
      };

      return await this.create(activityData);
    } catch (error) {
      throw this.handleError(error, 'logGenericActivity');
    }
  }

  async deleteOldActivities(days: number = 90): Promise<{ success: boolean; count: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Note: You'd need to implement proper date comparison here with Drizzle
      // For now, we'll just return a placeholder
      return { success: true, count: 0 };
    } catch (error) {
      throw this.handleError(error, 'deleteOldActivities');
    }
  }

  async bulkDeleteByUser(userId: string): Promise<{ success: boolean; count: number }> {
    try {
      const userActivities = await this.findByUser(userId, { limit: 1000 });
      const activityIds = userActivities.data.map(activity => activity.id);
      
      if (activityIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(activityIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByUser');
    }
  }

  async bulkDeleteByTask(taskId: string): Promise<{ success: boolean; count: number }> {
    try {
      const taskActivities = await this.findByTask(taskId, { limit: 1000 });
      const activityIds = taskActivities.data.map(activity => activity.id);
      
      if (activityIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(activityIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByTask');
    }
  }

  async bulkDeleteByProject(projectId: string): Promise<{ success: boolean; count: number }> {
    try {
      const projectActivities = await this.findByProject(projectId, { limit: 1000 });
      const activityIds = projectActivities.data.map(activity => activity.id);
      
      if (activityIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(activityIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByProject');
    }
  }

  async getActivityFeed(
    userId: string,
    filters?: {
      types?: string[];
      taskId?: string;
      projectId?: string;
      workspaceId?: string;
      teamId?: string;
    },
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Activity>> {
    try {
      const conditions = [eq(activities.userId, userId)];

      if (filters) {
        if (filters.types && filters.types.length > 0) {
          conditions.push(inArray(activities.type, filters.types));
        }

        if (filters.taskId) {
          conditions.push(eq(activities.taskId, filters.taskId));
        }

        if (filters.projectId) {
          conditions.push(eq(activities.projectId, filters.projectId));
        }

        if (filters.workspaceId) {
          conditions.push(eq(activities.workspaceId, filters.workspaceId));
        }

        if (filters.teamId) {
          conditions.push(eq(activities.teamId, filters.teamId));
        }
      }

      const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

      return await this.findMany({
        where: whereCondition,
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'getActivityFeed');
    }
  }

  // Override create to add validation
  async create(data: NewActivity): Promise<Activity> {
    try {
      // Add any activity-specific validation here
      if (!data.type || data.type.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Activity type cannot be empty');
      }

      if (!data.data || Object.keys(data.data).length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Activity data cannot be empty');
      }

      return await super.create(data);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'create');
    }
  }
}

// Export singleton instance
export const activityRepository = new ActivityRepository();
