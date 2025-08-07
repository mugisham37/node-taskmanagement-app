import { eq, and, or, desc, asc, count, sum, avg, gte, lte, between, sql } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError } from './base.service';
import { 
  taskRepository, 
  projectRepository, 
  userRepository, 
  activityRepository,
  teamRepository,
  workspaceRepository,
  feedbackRepository
} from '../db/repositories';
import { tasks } from '../db/schema/tasks';
import { projects } from '../db/schema/projects';
import { users } from '../db/schema/users';
import { activities } from '../db/schema/activities';
import { feedback } from '../db/schema/feedback';
import { db } from '../db/connection';

export interface SystemOverview {
  counts: {
    users: number;
    activeUsers: number;
    tasks: number;
    projects: number;
    teams: number;
    workspaces: number;
    feedback: number;
  };
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  lastUpdated: Date;
}

export interface UserActivity {
  newUsers: Array<{ date: string; count: number }>;
  logins: Array<{ date: string; count: number }>;
  lastUpdated: Date;
}

export interface TaskStatistics {
  newTasks: Array<{ date: string; count: number }>;
  completedTasks: Array<{ date: string; count: number }>;
  avgCompletionTime: number; // in hours
  tasksByAssignee: Array<{
    userId: string;
    name: string;
    email: string;
    count: number;
  }>;
  lastUpdated: Date;
}

export interface ProjectStatistics {
  newProjects: Array<{ date: string; count: number }>;
  projectsByStatus: Record<string, number>;
  projectsWithMostTasks: Array<{
    projectId: string;
    name: string;
    status: string;
    count: number;
  }>;
  lastUpdated: Date;
}

export interface TeamWorkspaceStatistics {
  teamsWithMostMembers: Array<{
    teamId: string;
    name: string;
    memberCount: number;
  }>;
  workspacesWithMostProjects: Array<{
    workspaceId: string;
    name: string;
    count: number;
  }>;
  lastUpdated: Date;
}

export class DashboardService extends BaseService {
  private readonly CACHE_TTL = 5 * 60; // 5 minutes

  constructor() {
    super('DashboardService', {
      enableCache: true,
      cacheTimeout: 300, // 5 minutes
      enableAudit: true,
      enableMetrics: true
    });
  }

  /**
   * Get system overview statistics
   */
  async getSystemOverview(context?: ServiceContext): Promise<SystemOverview> {
    const ctx = this.createContext(context);
    this.logOperation('getSystemOverview', ctx);

    try {
      // Get counts
      const [
        userCount,
        taskCount,
        projectCount,
        teamCount,
        workspaceCount,
        feedbackCount
      ] = await Promise.all([
        this.getUserCount(),
        this.getTaskCount(),
        this.getProjectCount(),
        this.getTeamCount(),
        this.getWorkspaceCount(),
        this.getFeedbackCount()
      ]);

      // Get active users (users who have logged in within the last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeUserCount = await this.getActiveUserCount(thirtyDaysAgo);

      // Get tasks by status
      const tasksByStatus = await this.getTasksByStatus();

      // Get tasks by priority
      const tasksByPriority = await this.getTasksByPriority();

      const result: SystemOverview = {
        counts: {
          users: userCount,
          activeUsers: activeUserCount,
          tasks: taskCount,
          projects: projectCount,
          teams: teamCount,
          workspaces: workspaceCount,
          feedback: feedbackCount,
        },
        tasksByStatus,
        tasksByPriority,
        lastUpdated: new Date(),
      };

      await this.recordMetric('dashboard.system_overview.generated', 1);

      return result;
    } catch (error) {
      this.handleError(error, 'getSystemOverview', ctx);
    }
  }

  /**
   * Get user activity statistics
   */
  async getUserActivity(days: number = 30, context?: ServiceContext): Promise<UserActivity> {
    const ctx = this.createContext(context);
    this.logOperation('getUserActivity', ctx, { days });

    try {
      // Calculate date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Get new user registrations by day
      const newUsersByDay = await db
        .select({
          date: sql`DATE(${users.createdAt})`.as('date'),
          count: count()
        })
        .from(users)
        .where(gte(users.createdAt, startDate))
        .groupBy(sql`DATE(${users.createdAt})`)
        .orderBy(sql`DATE(${users.createdAt})`);

      // Get user logins by day
      const loginsByDay = await db
        .select({
          date: sql`DATE(${users.lastLoginAt})`.as('date'),
          count: count()
        })
        .from(users)
        .where(and(
          sql`${users.lastLoginAt} IS NOT NULL`,
          gte(users.lastLoginAt, startDate)
        ))
        .groupBy(sql`DATE(${users.lastLoginAt})`)
        .orderBy(sql`DATE(${users.lastLoginAt})`);

      const result: UserActivity = {
        newUsers: this.formatDailyData(newUsersByDay, days),
        logins: this.formatDailyData(loginsByDay, days),
        lastUpdated: new Date(),
      };

      await this.recordMetric('dashboard.user_activity.generated', 1, { days: days.toString() });

      return result;
    } catch (error) {
      this.handleError(error, 'getUserActivity', ctx);
    }
  }

  /**
   * Get task statistics
   */
  async getTaskStatistics(days: number = 30, context?: ServiceContext): Promise<TaskStatistics> {
    const ctx = this.createContext(context);
    this.logOperation('getTaskStatistics', ctx, { days });

    try {
      // Calculate date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Get new tasks by day
      const newTasksByDay = await db
        .select({
          date: sql`DATE(${tasks.createdAt})`.as('date'),
          count: count()
        })
        .from(tasks)
        .where(gte(tasks.createdAt, startDate))
        .groupBy(sql`DATE(${tasks.createdAt})`)
        .orderBy(sql`DATE(${tasks.createdAt})`);

      // Get completed tasks by day
      const completedTasksByDay = await db
        .select({
          date: sql`DATE(${tasks.completedAt})`.as('date'),
          count: count()
        })
        .from(tasks)
        .where(and(
          eq(tasks.status, 'completed'),
          sql`${tasks.completedAt} IS NOT NULL`,
          gte(tasks.completedAt, startDate)
        ))
        .groupBy(sql`DATE(${tasks.completedAt})`)
        .orderBy(sql`DATE(${tasks.completedAt})`);

      // Get average task completion time
      const avgCompletionTimeResult = await db
        .select({
          avgTime: avg(sql`EXTRACT(EPOCH FROM (${tasks.completedAt} - ${tasks.createdAt}))`)
        })
        .from(tasks)
        .where(and(
          eq(tasks.status, 'completed'),
          sql`${tasks.completedAt} IS NOT NULL`,
          gte(tasks.completedAt, startDate),
          gte(tasks.createdAt, startDate)
        ));

      const avgCompletionTime = avgCompletionTimeResult[0]?.avgTime 
        ? Number(avgCompletionTimeResult[0].avgTime) / 3600 // Convert seconds to hours
        : 0;

      // Get tasks by assignee
      const tasksByAssigneeResult = await db
        .select({
          userId: tasks.assigneeId,
          count: count()
        })
        .from(tasks)
        .innerJoin(users, eq(tasks.assigneeId, users.id))
        .where(and(
          sql`${tasks.assigneeId} IS NOT NULL`,
          gte(tasks.createdAt, startDate)
        ))
        .groupBy(tasks.assigneeId)
        .orderBy(desc(count()))
        .limit(10);

      const tasksByAssignee = [];
      for (const item of tasksByAssigneeResult) {
        if (item.userId) {
          const user = await userRepository.findById(item.userId);
          if (user) {
            tasksByAssignee.push({
              userId: item.userId,
              name: `${user.firstName} ${user.lastName}`.trim(),
              email: user.email,
              count: item.count
            });
          }
        }
      }

      const result: TaskStatistics = {
        newTasks: this.formatDailyData(newTasksByDay, days),
        completedTasks: this.formatDailyData(completedTasksByDay, days),
        avgCompletionTime,
        tasksByAssignee,
        lastUpdated: new Date(),
      };

      await this.recordMetric('dashboard.task_statistics.generated', 1, { days: days.toString() });

      return result;
    } catch (error) {
      this.handleError(error, 'getTaskStatistics', ctx);
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStatistics(days: number = 30, context?: ServiceContext): Promise<ProjectStatistics> {
    const ctx = this.createContext(context);
    this.logOperation('getProjectStatistics', ctx, { days });

    try {
      // Calculate date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Get new projects by day
      const newProjectsByDay = await db
        .select({
          date: sql`DATE(${projects.createdAt})`.as('date'),
          count: count()
        })
        .from(projects)
        .where(gte(projects.createdAt, startDate))
        .groupBy(sql`DATE(${projects.createdAt})`)
        .orderBy(sql`DATE(${projects.createdAt})`);

      // Get projects by archived status (since there's no status field)
      const projectsByStatusResult = await db
        .select({
          isArchived: projects.isArchived,
          count: count()
        })
        .from(projects)
        .groupBy(projects.isArchived);

      const projectsByStatus = projectsByStatusResult.reduce((acc, item) => {
        const status = item.isArchived ? 'archived' : 'active';
        acc[status] = item.count;
        return acc;
      }, {} as Record<string, number>);

      // Get projects with most tasks
      const projectsWithMostTasksResult = await db
        .select({
          projectId: projects.id,
          name: projects.name,
          isArchived: projects.isArchived,
          count: count(tasks.id)
        })
        .from(projects)
        .leftJoin(tasks, eq(projects.id, tasks.projectId))
        .groupBy(projects.id, projects.name, projects.isArchived)
        .orderBy(desc(count(tasks.id)))
        .limit(10);

      const projectsWithMostTasks = projectsWithMostTasksResult.map(item => ({
        projectId: item.projectId,
        name: item.name,
        status: item.isArchived ? 'archived' : 'active',
        count: item.count
      }));

      const result: ProjectStatistics = {
        newProjects: this.formatDailyData(newProjectsByDay, days),
        projectsByStatus,
        projectsWithMostTasks,
        lastUpdated: new Date(),
      };

      await this.recordMetric('dashboard.project_statistics.generated', 1, { days: days.toString() });

      return result;
    } catch (error) {
      this.handleError(error, 'getProjectStatistics', ctx);
    }
  }

  /**
   * Get team and workspace statistics
   */
  async getTeamWorkspaceStatistics(context?: ServiceContext): Promise<TeamWorkspaceStatistics> {
    const ctx = this.createContext(context);
    this.logOperation('getTeamWorkspaceStatistics', ctx);

    try {
      // Get teams with most members (placeholder - would need proper team member counting)
      const teamsWithMostMembers = await teamRepository.findMany({ limit: 10 });
      const formattedTeams = teamsWithMostMembers.data.map(team => ({
        teamId: team.id,
        name: team.name,
        memberCount: 0 // Would need to implement member counting
      }));

      // Get workspaces with most projects (placeholder - would need proper workspace-project relationship)
      const workspacesWithMostProjects = await workspaceRepository.findMany({ limit: 10 });
      const formattedWorkspaces = workspacesWithMostProjects.data.map(workspace => ({
        workspaceId: workspace.id,
        name: workspace.name,
        count: 0 // Would need to implement project counting
      }));

      const result: TeamWorkspaceStatistics = {
        teamsWithMostMembers: formattedTeams,
        workspacesWithMostProjects: formattedWorkspaces,
        lastUpdated: new Date(),
      };

      await this.recordMetric('dashboard.team_workspace_statistics.generated', 1);

      return result;
    } catch (error) {
      this.handleError(error, 'getTeamWorkspaceStatistics', ctx);
    }
  }

  /**
   * Invalidate dashboard cache
   */
  async invalidateDashboardCache(key?: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('invalidateDashboardCache', ctx, { key });

    try {
      // In a real implementation, this would clear specific cache keys
      // For now, we'll just log the operation
      console.log(`Dashboard cache invalidated: ${key || 'all'}`);

      await this.recordMetric('dashboard.cache.invalidated', 1, { 
        key: key || 'all' 
      });
    } catch (error) {
      this.handleError(error, 'invalidateDashboardCache', ctx);
    }
  }

  // Private Helper Methods
  private async getUserCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(users);
    return result[0]?.count || 0;
  }

  private async getTaskCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(tasks);
    return result[0]?.count || 0;
  }

  private async getProjectCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(projects);
    return result[0]?.count || 0;
  }

  private async getTeamCount(): Promise<number> {
    // Placeholder - would use actual teams table
    return 0;
  }

  private async getWorkspaceCount(): Promise<number> {
    // Placeholder - would use actual workspaces table
    return 0;
  }

  private async getFeedbackCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(feedback);
    return result[0]?.count || 0;
  }

  private async getActiveUserCount(since: Date): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(users)
      .where(and(
        sql`${users.lastLoginAt} IS NOT NULL`,
        gte(users.lastLoginAt, since)
      ));
    return result[0]?.count || 0;
  }

  private async getTasksByStatus(): Promise<Record<string, number>> {
    const result = await db
      .select({
        status: tasks.status,
        count: count()
      })
      .from(tasks)
      .groupBy(tasks.status);

    return result.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {} as Record<string, number>);
  }

  private async getTasksByPriority(): Promise<Record<string, number>> {
    const result = await db
      .select({
        priority: tasks.priority,
        count: count()
      })
      .from(tasks)
      .groupBy(tasks.priority);

    return result.reduce((acc, item) => {
      acc[item.priority] = item.count;
      return acc;
    }, {} as Record<string, number>);
  }

  private formatDailyData(data: any[], days: number): Array<{ date: string; count: number }> {
    const result = [];
    const today = new Date();
    const dateMap = new Map();

    // Create map of existing data
    data.forEach((item) => {
      const date = new Date(item.date);
      dateMap.set(date.toISOString().split('T')[0], item.count);
    });

    // Fill in missing days with zeros
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        count: dateMap.get(dateStr) || 0,
      });
    }

    return result;
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();
