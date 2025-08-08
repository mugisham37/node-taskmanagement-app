import { eq, and, or, desc, asc, count, ilike, isNull, isNotNull, gte, lte, inArray } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError } from './base.service';
import { activityRepository, userRepository, taskRepository, projectRepository } from '../db/repositories';
import { Activity, NewActivity, ActivityType } from '../db/schema/activities';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';

export interface ActivityFilters {
  userId?: string;
  taskId?: string;
  projectId?: string;
  workspaceId?: string;
  teamId?: string;
  type?: ActivityType | ActivityType[];
  createdFrom?: Date;
  createdTo?: Date;
}

export interface ActivityCreateData {
  userId: string;
  type: ActivityType;
  taskId?: string;
  projectId?: string;
  workspaceId?: string;
  teamId?: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivityStats {
  totalActivities: number;
  byType: Record<string, number>;
  recentActivities: Activity[];
  mostActiveUsers: Array<{ userId: string; userName: string; count: number }>;
}

export class ActivityService extends BaseService {
  constructor() {
    super('ActivityService', {
      enableCache: true,
      cacheTimeout: 300, // 5 minutes cache for activity logs
      enableAudit: false, // Don't audit activity logs to avoid recursion
      enableMetrics: true
    });
  }

  // Core CRUD Operations
  async createActivity(data: ActivityCreateData, context?: ServiceContext): Promise<Activity> {
    const ctx = this.createContext(context);
    this.logOperation('createActivity', ctx, { 
      userId: data.userId, 
      type: data.type, 
      taskId: data.taskId,
      projectId: data.projectId 
    });

    try {
      // Validate input
      this.validateActivityData(data);

      // Verify user exists
      const user = await userRepository.findById(data.userId);
      if (!user) {
        throw new NotFoundError('User', data.userId);
      }

      // Create activity
      const newActivity: NewActivity = {
        ...data,
        data: data.data || {},
        metadata: data.metadata || {}
      };

      const activity = await activityRepository.create(newActivity);

      await this.recordMetric('activity.created', 1, { 
        type: activity.type,
        hasTaskId: activity.taskId ? 'true' : 'false',
        hasProjectId: activity.projectId ? 'true' : 'false',
        hasMetadata: Object.keys(activity.metadata as object || {}).length > 0 ? 'true' : 'false'
      });

      return activity;
    } catch (error) {
      this.handleError(error, 'createActivity', ctx);
    }
  }

  async getActivityById(id: string, context?: ServiceContext): Promise<Activity> {
    const ctx = this.createContext(context);
    this.logOperation('getActivityById', ctx, { activityId: id });

    try {
      const activity = await activityRepository.findById(id);
      if (!activity) {
        throw new NotFoundError('Activity', id);
      }

      // Check access permissions
      await this.verifyActivityAccess(activity, ctx.userId!);

      return activity;
    } catch (error) {
      this.handleError(error, 'getActivityById', ctx);
    }
  }

  async getActivities(
    filters: ActivityFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Activity>> {
    const ctx = this.createContext(context);
    this.logOperation('getActivities', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);
      
      // Build where conditions
      const whereConditions = this.buildActivityWhereConditions(filters, ctx.userId!, ctx.userRole);
      
      const result = await activityRepository.findMany({
        ...paginationOptions,
        where: whereConditions,
        sortBy: 'createdAt',
        sortOrder: 'desc' // Most recent first
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getActivities', ctx);
    }
  }

  // Specialized Activity Creators
  async logTaskActivity(
    userId: string,
    taskId: string,
    type: ActivityType,
    data?: Record<string, any>,
    metadata?: Record<string, any>,
    context?: ServiceContext
  ): Promise<Activity> {
    return this.createActivity({
      userId,
      type,
      taskId,
      data,
      metadata,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    }, context);
  }

  async logProjectActivity(
    userId: string,
    projectId: string,
    type: ActivityType,
    data?: Record<string, any>,
    metadata?: Record<string, any>,
    context?: ServiceContext
  ): Promise<Activity> {
    return this.createActivity({
      userId,
      type,
      projectId,
      data,
      metadata,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    }, context);
  }

  async logWorkspaceActivity(
    userId: string,
    workspaceId: string,
    type: ActivityType,
    data?: Record<string, any>,
    metadata?: Record<string, any>,
    context?: ServiceContext
  ): Promise<Activity> {
    return this.createActivity({
      userId,
      type,
      workspaceId,
      data,
      metadata,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    }, context);
  }

  async logTeamActivity(
    userId: string,
    teamId: string,
    type: ActivityType,
    data?: Record<string, any>,
    metadata?: Record<string, any>,
    context?: ServiceContext
  ): Promise<Activity> {
    return this.createActivity({
      userId,
      type,
      teamId,
      data,
      metadata,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    }, context);
  }

  // Entity-specific activity retrieval
  async getTaskActivities(
    taskId: string,
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Activity>> {
    const ctx = this.createContext(context);
    this.logOperation('getTaskActivities', ctx, { taskId, options });

    try {
      // Verify task exists and user has access
      const task = await taskRepository.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task', taskId);
      }

      // Check if user has access to this task
      if (task.assigneeId !== ctx.userId && ctx.userRole !== 'admin') {
        throw new ForbiddenError('You do not have access to this task');
      }

      const paginationOptions = this.validatePagination(options);
      
      const result = await activityRepository.findMany({
        ...paginationOptions,
        where: eq(activityRepository['table']?.taskId, taskId),
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getTaskActivities', ctx);
    }
  }

  async getProjectActivities(
    projectId: string,
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Activity>> {
    const ctx = this.createContext(context);
    this.logOperation('getProjectActivities', ctx, { projectId, options });

    try {
      // Verify project exists and user has access
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new NotFoundError('Project', projectId);
      }

      // Check if user has access to this project
      if (project.ownerId !== ctx.userId && ctx.userRole !== 'admin') {
        throw new ForbiddenError('You do not have access to this project');
      }

      const paginationOptions = this.validatePagination(options);
      
      const result = await activityRepository.findMany({
        ...paginationOptions,
        where: eq(activityRepository['table']?.projectId, projectId),
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getProjectActivities', ctx);
    }
  }

  async getUserActivities(
    userId: string,
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Activity>> {
    const ctx = this.createContext(context);
    this.logOperation('getUserActivities', ctx, { userId, options });

    try {
      // Check if user can view these activities
      if (userId !== ctx.userId && ctx.userRole !== 'admin') {
        throw new ForbiddenError('You can only view your own activities');
      }

      const paginationOptions = this.validatePagination(options);
      
      const result = await activityRepository.findMany({
        ...paginationOptions,
        where: eq(activityRepository['table']?.userId, userId),
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getUserActivities', ctx);
    }
  }

  // Statistics and Analytics
  async getActivityStats(
    filters: ActivityFilters = {},
    context?: ServiceContext
  ): Promise<ActivityStats> {
    const ctx = this.createContext(context);
    this.logOperation('getActivityStats', ctx, { filters });

    try {
      // Only admins can view global stats, users can only view their own
      if (!filters.userId && ctx.userRole !== 'admin') {
        filters.userId = ctx.userId!;
      }

      // Get all activities matching filters
      const allActivities = await activityRepository.findMany({
        where: this.buildActivityWhereConditions(filters, ctx.userId!, ctx.userRole),
        limit: 10000 // Large limit to get comprehensive stats
      });

      const activities = allActivities.data;

      // Calculate stats
      const byType: Record<string, number> = {};
      const userCounts: Record<string, number> = {};

      activities.forEach(activity => {
        byType[activity.type] = (byType[activity.type] || 0) + 1;
        userCounts[activity.userId] = (userCounts[activity.userId] || 0) + 1;
      });

      // Get recent activities (last 10)
      const recentActivities = activities.slice(0, 10);

      // Get most active users
      const mostActiveUserIds = Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([userId]) => userId);

      const mostActiveUsers = [];
      for (const userId of mostActiveUserIds) {
        const user = await userRepository.findById(userId);
        if (user) {
          mostActiveUsers.push({
            userId,
            userName: `${user.firstName} ${user.lastName}`.trim(),
            count: userCounts[userId]
          });
        }
      }

      const stats: ActivityStats = {
        totalActivities: activities.length,
        byType,
        recentActivities,
        mostActiveUsers
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getActivityStats', ctx);
    }
  }

  // Cleanup old activities
  async cleanupOldActivities(daysToKeep: number = 90, context?: ServiceContext): Promise<{ deleted: number }> {
    const ctx = this.createContext(context);
    this.logOperation('cleanupOldActivities', ctx, { daysToKeep });

    try {
      // Only admins can cleanup activities
      if (ctx.userRole !== 'admin') {
        throw new ForbiddenError('Only administrators can cleanup old activities');
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Get old activities
      const oldActivities = await activityRepository.findMany({
        where: lte(activityRepository['table']?.createdAt, cutoffDate),
        limit: 10000 // Process in batches
      });

      let deleted = 0;

      // Delete each activity
      for (const activity of oldActivities.data) {
        const success = await activityRepository.delete(activity.id);
        if (success) deleted++;
      }

      await this.recordMetric('activity.cleanup', 1, { 
        deleted: deleted.toString(),
        daysToKeep: daysToKeep.toString()
      });

      return { deleted };
    } catch (error) {
      this.handleError(error, 'cleanupOldActivities', ctx);
    }
  }

  // Private Helper Methods
  private async verifyActivityAccess(activity: Activity, userId: string): Promise<void> {
    // User can access activity if they are:
    // 1. The user who performed the activity
    // 2. Admin
    // 3. Have access to the related entity
    
    if (activity.userId === userId) {
      return;
    }

    // Check if user is admin
    const user = await userRepository.findById(userId);
    if (user?.role === 'admin') {
      return;
    }

    // Check entity-specific access
    if (activity.taskId) {
      const task = await taskRepository.findById(activity.taskId);
      if (task && task.assigneeId === userId) {
        return;
      }
    } else if (activity.projectId) {
      const project = await projectRepository.findById(activity.projectId);
      if (project && project.ownerId === userId) {
        return;
      }
    }

    throw new ForbiddenError('You do not have access to this activity');
  }

  private buildActivityWhereConditions(filters: ActivityFilters, userId: string, userRole?: string): any {
    const conditions = [];

    // Non-admin users can only see their own activities or activities on entities they own
    if (userRole !== 'admin') {
      conditions.push(eq(activityRepository['table']?.userId, userId));
    }

    if (filters.userId) {
      conditions.push(eq(activityRepository['table']?.userId, filters.userId));
    }

    if (filters.taskId) {
      conditions.push(eq(activityRepository['table']?.taskId, filters.taskId));
    }

    if (filters.projectId) {
      conditions.push(eq(activityRepository['table']?.projectId, filters.projectId));
    }

    if (filters.workspaceId) {
      conditions.push(eq(activityRepository['table']?.workspaceId, filters.workspaceId));
    }

    if (filters.teamId) {
      conditions.push(eq(activityRepository['table']?.teamId, filters.teamId));
    }

    if (filters.type) {
      if (Array.isArray(filters.type)) {
        conditions.push(inArray(activityRepository['table']?.type, filters.type));
      } else {
        conditions.push(eq(activityRepository['table']?.type, filters.type));
      }
    }

    if (filters.createdFrom) {
      conditions.push(gte(activityRepository['table']?.createdAt, filters.createdFrom));
    }

    if (filters.createdTo) {
      conditions.push(lte(activityRepository['table']?.createdAt, filters.createdTo));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private validateActivityData(data: ActivityCreateData): void {
    if (!data.userId || data.userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    if (!data.type) {
      throw new ValidationError('Activity type is required');
    }

    // At least one entity reference should be provided
    if (!data.taskId && !data.projectId && !data.workspaceId && !data.teamId) {
      throw new ValidationError('At least one entity reference (taskId, projectId, workspaceId, or teamId) is required');
    }
  }
}

// Export singleton instance
export const activityService = new ActivityService();
