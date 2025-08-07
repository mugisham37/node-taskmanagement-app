import { eq, and, or, desc, asc, count, sum, avg, gte, lte, between, sql } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError } from './base.service';
import { 
  taskRepository, 
  projectRepository, 
  userRepository, 
  activityRepository,
  teamRepository,
  workspaceRepository 
} from '../db/repositories';
import { tasks } from '../db/schema/tasks';
import { projects } from '../db/schema/projects';
import { activities } from '../db/schema/activities';
import { users } from '../db/schema/users';
import { db } from '../db/connection';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface TaskAnalytics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  overdueTasks: number;
  completionRate: number;
  averageCompletionTime: number; // in hours
  tasksByPriority: Record<string, number>;
  tasksByStatus: Record<string, number>;
  tasksCreatedOverTime: Array<{ date: string; count: number }>;
  tasksCompletedOverTime: Array<{ date: string; count: number }>;
}

export interface ProjectAnalytics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  projectsWithTasks: number;
  averageTasksPerProject: number;
  projectCompletionRate: number;
  projectsByStatus: Record<string, number>;
  topProjectsByTaskCount: Array<{ projectId: string; projectName: string; taskCount: number }>;
}

export interface UserProductivityAnalytics {
  userId: string;
  userName: string;
  tasksCompleted: number;
  tasksCreated: number;
  averageCompletionTime: number;
  productivityScore: number;
  streakDays: number;
  mostProductiveHour: number;
  mostProductiveDay: string;
  activityCount: number;
}

export interface TeamAnalytics {
  teamId: string;
  teamName: string;
  memberCount: number;
  totalTasks: number;
  completedTasks: number;
  teamProductivityScore: number;
  memberProductivity: UserProductivityAnalytics[];
  collaborationScore: number;
  averageTaskCompletionTime: number;
}

export interface WorkspaceAnalytics {
  workspaceId: string;
  workspaceName: string;
  totalProjects: number;
  totalTasks: number;
  totalUsers: number;
  completionRate: number;
  activityLevel: 'low' | 'medium' | 'high';
  growthRate: number;
  topPerformers: UserProductivityAnalytics[];
}

export interface DashboardAnalytics {
  overview: {
    totalTasks: number;
    completedTasks: number;
    totalProjects: number;
    totalUsers: number;
    completionRate: number;
  };
  trends: {
    tasksThisWeek: number;
    tasksLastWeek: number;
    completionRateThisWeek: number;
    completionRateLastWeek: number;
    growthRate: number;
  };
  topMetrics: {
    mostProductiveUser: UserProductivityAnalytics;
    mostActiveProject: { projectId: string; projectName: string; activityCount: number };
    longestStreak: { userId: string; userName: string; streakDays: number };
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
    userId: string;
    userName: string;
  }>;
}

export class AnalyticsService extends BaseService {
  constructor() {
    super('AnalyticsService', {
      enableCache: true,
      cacheTimeout: 600, // 10 minutes cache for analytics
      enableAudit: true,
      enableMetrics: true
    });
  }

  // Task Analytics
  async getTaskAnalytics(
    userId?: string,
    projectId?: string,
    dateRange?: DateRange,
    context?: ServiceContext
  ): Promise<TaskAnalytics> {
    const ctx = this.createContext(context);
    this.logOperation('getTaskAnalytics', ctx, { userId, projectId, dateRange });

    try {
      // Set default date range (last 30 days)
      const range = dateRange || {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };

      // Build base query conditions
      const conditions = [];
      
      if (userId) {
        // Verify user access
        if (userId !== ctx.userId && ctx.userRole !== 'admin') {
          throw new ForbiddenError('You can only view your own analytics');
        }
        conditions.push(eq(tasks.assigneeId, userId));
      }

      if (projectId) {
        // Verify project access
        const project = await projectRepository.findById(projectId);
        if (!project) {
          throw new NotFoundError('Project', projectId);
        }
        if (project.ownerId !== ctx.userId && ctx.userRole !== 'admin') {
          throw new ForbiddenError('You do not have access to this project');
        }
        conditions.push(eq(tasks.projectId, projectId));
      }

      // Add date range condition
      conditions.push(gte(tasks.createdAt, range.startDate));
      conditions.push(lte(tasks.createdAt, range.endDate));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get basic task counts
      const [
        totalTasksResult,
        completedTasksResult,
        inProgressTasksResult,
        todoTasksResult,
        overdueTasksResult
      ] = await Promise.all([
        db.select({ count: count() }).from(tasks).where(whereClause),
        db.select({ count: count() }).from(tasks).where(and(whereClause, eq(tasks.status, 'completed'))),
        db.select({ count: count() }).from(tasks).where(and(whereClause, eq(tasks.status, 'in_progress'))),
        db.select({ count: count() }).from(tasks).where(and(whereClause, eq(tasks.status, 'todo'))),
        db.select({ count: count() }).from(tasks).where(and(
          whereClause,
          sql`${tasks.dueDate} < NOW()`,
          sql`${tasks.status} != 'completed'`
        ))
      ]);

      const totalTasks = totalTasksResult[0]?.count || 0;
      const completedTasks = completedTasksResult[0]?.count || 0;
      const inProgressTasks = inProgressTasksResult[0]?.count || 0;
      const todoTasks = todoTasksResult[0]?.count || 0;
      const overdueTasks = overdueTasksResult[0]?.count || 0;

      // Calculate completion rate
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Get tasks by priority
      const tasksByPriorityResult = await db
        .select({
          priority: tasks.priority,
          count: count()
        })
        .from(tasks)
        .where(whereClause)
        .groupBy(tasks.priority);

      const tasksByPriority = tasksByPriorityResult.reduce((acc, item) => {
        acc[item.priority] = item.count;
        return acc;
      }, {} as Record<string, number>);

      // Get tasks by status
      const tasksByStatusResult = await db
        .select({
          status: tasks.status,
          count: count()
        })
        .from(tasks)
        .where(whereClause)
        .groupBy(tasks.status);

      const tasksByStatus = tasksByStatusResult.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {} as Record<string, number>);

      // Calculate average completion time
      const completedTasksWithTime = await db
        .select({
          createdAt: tasks.createdAt,
          completedAt: tasks.completedAt
        })
        .from(tasks)
        .where(and(
          whereClause,
          eq(tasks.status, 'completed'),
          sql`${tasks.completedAt} IS NOT NULL`
        ));

      let averageCompletionTime = 0;
      if (completedTasksWithTime.length > 0) {
        const totalCompletionTime = completedTasksWithTime.reduce((sum, task) => {
          const completionTime = task.completedAt!.getTime() - task.createdAt.getTime();
          return sum + completionTime;
        }, 0);
        averageCompletionTime = totalCompletionTime / completedTasksWithTime.length / (1000 * 60 * 60); // Convert to hours
      }

      // Get tasks created over time (daily)
      const tasksCreatedOverTime = await this.getTasksOverTime(whereClause, 'createdAt', range);
      
      // Get tasks completed over time (daily)
      const completedWhereClause = and(whereClause, eq(tasks.status, 'completed'));
      const tasksCompletedOverTime = await this.getTasksOverTime(completedWhereClause, 'completedAt', range);

      const analytics: TaskAnalytics = {
        totalTasks,
        completedTasks,
        inProgressTasks,
        todoTasks,
        overdueTasks,
        completionRate,
        averageCompletionTime,
        tasksByPriority,
        tasksByStatus,
        tasksCreatedOverTime,
        tasksCompletedOverTime
      };

      await this.recordMetric('analytics.task_analytics_generated', 1, {
        userId: userId || 'all',
        projectId: projectId || 'all',
        totalTasks: totalTasks.toString()
      });

      return analytics;
    } catch (error) {
      this.handleError(error, 'getTaskAnalytics', ctx);
    }
  }

  // Project Analytics
  async getProjectAnalytics(
    userId?: string,
    dateRange?: DateRange,
    context?: ServiceContext
  ): Promise<ProjectAnalytics> {
    const ctx = this.createContext(context);
    this.logOperation('getProjectAnalytics', ctx, { userId, dateRange });

    try {
      // Set default date range (last 30 days)
      const range = dateRange || {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };

      // Build base query conditions
      const conditions = [];
      
      if (userId) {
        // Verify user access
        if (userId !== ctx.userId && ctx.userRole !== 'admin') {
          throw new ForbiddenError('You can only view your own analytics');
        }
        conditions.push(eq(projects.ownerId, userId));
      }

      conditions.push(gte(projects.createdAt, range.startDate));
      conditions.push(lte(projects.createdAt, range.endDate));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get basic project counts
      const [
        totalProjectsResult,
        activeProjectsResult,
        completedProjectsResult
      ] = await Promise.all([
        db.select({ count: count() }).from(projects).where(whereClause),
        db.select({ count: count() }).from(projects).where(and(whereClause, eq(projects.status, 'active'))),
        db.select({ count: count() }).from(projects).where(and(whereClause, eq(projects.status, 'completed')))
      ]);

      const totalProjects = totalProjectsResult[0]?.count || 0;
      const activeProjects = activeProjectsResult[0]?.count || 0;
      const completedProjects = completedProjectsResult[0]?.count || 0;

      // Get projects with tasks
      const projectsWithTasksResult = await db
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(whereClause)
        .groupBy(tasks.projectId);

      const projectsWithTasks = projectsWithTasksResult.length;

      // Calculate average tasks per project
      const totalTasksInProjectsResult = await db
        .select({ count: count() })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(whereClause);

      const totalTasksInProjects = totalTasksInProjectsResult[0]?.count || 0;
      const averageTasksPerProject = totalProjects > 0 ? totalTasksInProjects / totalProjects : 0;

      // Calculate project completion rate
      const projectCompletionRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

      // Get projects by status
      const projectsByStatusResult = await db
        .select({
          status: projects.status,
          count: count()
        })
        .from(projects)
        .where(whereClause)
        .groupBy(projects.status);

      const projectsByStatus = projectsByStatusResult.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {} as Record<string, number>);

      // Get top projects by task count
      const topProjectsByTaskCountResult = await db
        .select({
          projectId: projects.id,
          projectName: projects.name,
          taskCount: count(tasks.id)
        })
        .from(projects)
        .leftJoin(tasks, eq(projects.id, tasks.projectId))
        .where(whereClause)
        .groupBy(projects.id, projects.name)
        .orderBy(desc(count(tasks.id)))
        .limit(10);

      const topProjectsByTaskCount = topProjectsByTaskCountResult.map(item => ({
        projectId: item.projectId,
        projectName: item.projectName,
        taskCount: item.taskCount
      }));

      const analytics: ProjectAnalytics = {
        totalProjects,
        activeProjects,
        completedProjects,
        projectsWithTasks,
        averageTasksPerProject,
        projectCompletionRate,
        projectsByStatus,
        topProjectsByTaskCount
      };

      await this.recordMetric('analytics.project_analytics_generated', 1, {
        userId: userId || 'all',
        totalProjects: totalProjects.toString()
      });

      return analytics;
    } catch (error) {
      this.handleError(error, 'getProjectAnalytics', ctx);
    }
  }

  // User Productivity Analytics
  async getUserProductivityAnalytics(
    userId: string,
    dateRange?: DateRange,
    context?: ServiceContext
  ): Promise<UserProductivityAnalytics> {
    const ctx = this.createContext(context);
    this.logOperation('getUserProductivityAnalytics', ctx, { userId, dateRange });

    try {
      // Verify user access
      if (userId !== ctx.userId && ctx.userRole !== 'admin') {
        throw new ForbiddenError('You can only view your own productivity analytics');
      }

      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Set default date range (last 30 days)
      const range = dateRange || {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };

      // Get task statistics
      const [
        tasksCompletedResult,
        tasksCreatedResult,
        activityCountResult
      ] = await Promise.all([
        db.select({ count: count() }).from(tasks).where(and(
          eq(tasks.assigneeId, userId),
          eq(tasks.status, 'completed'),
          gte(tasks.completedAt, range.startDate),
          lte(tasks.completedAt, range.endDate)
        )),
        db.select({ count: count() }).from(tasks).where(and(
          eq(tasks.assigneeId, userId),
          gte(tasks.createdAt, range.startDate),
          lte(tasks.createdAt, range.endDate)
        )),
        db.select({ count: count() }).from(activities).where(and(
          eq(activities.userId, userId),
          gte(activities.createdAt, range.startDate),
          lte(activities.createdAt, range.endDate)
        ))
      ]);

      const tasksCompleted = tasksCompletedResult[0]?.count || 0;
      const tasksCreated = tasksCreatedResult[0]?.count || 0;
      const activityCount = activityCountResult[0]?.count || 0;

      // Calculate average completion time
      const completedTasksWithTime = await db
        .select({
          createdAt: tasks.createdAt,
          completedAt: tasks.completedAt
        })
        .from(tasks)
        .where(and(
          eq(tasks.assigneeId, userId),
          eq(tasks.status, 'completed'),
          sql`${tasks.completedAt} IS NOT NULL`,
          gte(tasks.completedAt, range.startDate),
          lte(tasks.completedAt, range.endDate)
        ));

      let averageCompletionTime = 0;
      if (completedTasksWithTime.length > 0) {
        const totalCompletionTime = completedTasksWithTime.reduce((sum, task) => {
          const completionTime = task.completedAt!.getTime() - task.createdAt.getTime();
          return sum + completionTime;
        }, 0);
        averageCompletionTime = totalCompletionTime / completedTasksWithTime.length / (1000 * 60 * 60); // Convert to hours
      }

      // Calculate productivity score (0-100)
      const productivityScore = this.calculateProductivityScore(tasksCompleted, tasksCreated, averageCompletionTime, activityCount);

      // Calculate streak days
      const streakDays = await this.calculateUserStreak(userId, range.endDate);

      // Get most productive hour and day
      const { mostProductiveHour, mostProductiveDay } = await this.getMostProductiveTimePatterns(userId, range);

      const analytics: UserProductivityAnalytics = {
        userId,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        tasksCompleted,
        tasksCreated,
        averageCompletionTime,
        productivityScore,
        streakDays,
        mostProductiveHour,
        mostProductiveDay,
        activityCount
      };

      await this.recordMetric('analytics.user_productivity_generated', 1, {
        userId,
        tasksCompleted: tasksCompleted.toString(),
        productivityScore: productivityScore.toString()
      });

      return analytics;
    } catch (error) {
      this.handleError(error, 'getUserProductivityAnalytics', ctx);
    }
  }

  // Dashboard Analytics
  async getDashboardAnalytics(context?: ServiceContext): Promise<DashboardAnalytics> {
    const ctx = this.createContext(context);
    this.logOperation('getDashboardAnalytics', ctx);

    try {
      const now = new Date();
      const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Get overview statistics
      const [
        totalTasksResult,
        completedTasksResult,
        totalProjectsResult,
        totalUsersResult
      ] = await Promise.all([
        db.select({ count: count() }).from(tasks),
        db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'completed')),
        db.select({ count: count() }).from(projects),
        db.select({ count: count() }).from(users)
      ]);

      const totalTasks = totalTasksResult[0]?.count || 0;
      const completedTasks = completedTasksResult[0]?.count || 0;
      const totalProjects = totalProjectsResult[0]?.count || 0;
      const totalUsers = totalUsersResult[0]?.count || 0;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Get trend data
      const [
        tasksThisWeekResult,
        tasksLastWeekResult,
        completedThisWeekResult,
        completedLastWeekResult
      ] = await Promise.all([
        db.select({ count: count() }).from(tasks).where(gte(tasks.createdAt, thisWeekStart)),
        db.select({ count: count() }).from(tasks).where(and(
          gte(tasks.createdAt, lastWeekStart),
          lte(tasks.createdAt, thisWeekStart)
        )),
        db.select({ count: count() }).from(tasks).where(and(
          eq(tasks.status, 'completed'),
          gte(tasks.completedAt, thisWeekStart)
        )),
        db.select({ count: count() }).from(tasks).where(and(
          eq(tasks.status, 'completed'),
          gte(tasks.completedAt, lastWeekStart),
          lte(tasks.completedAt, thisWeekStart)
        ))
      ]);

      const tasksThisWeek = tasksThisWeekResult[0]?.count || 0;
      const tasksLastWeek = tasksLastWeekResult[0]?.count || 0;
      const completedThisWeek = completedThisWeekResult[0]?.count || 0;
      const completedLastWeek = completedLastWeekResult[0]?.count || 0;

      const completionRateThisWeek = tasksThisWeek > 0 ? (completedThisWeek / tasksThisWeek) * 100 : 0;
      const completionRateLastWeek = tasksLastWeek > 0 ? (completedLastWeek / tasksLastWeek) * 100 : 0;
      const growthRate = tasksLastWeek > 0 ? ((tasksThisWeek - tasksLastWeek) / tasksLastWeek) * 100 : 0;

      // Get top metrics (simplified for dashboard)
      const mostProductiveUser = await this.getMostProductiveUser();
      const mostActiveProject = await this.getMostActiveProject();
      const longestStreak = await this.getLongestStreak();

      // Get recent activity
      const recentActivity = await this.getRecentActivity(10);

      const analytics: DashboardAnalytics = {
        overview: {
          totalTasks,
          completedTasks,
          totalProjects,
          totalUsers,
          completionRate
        },
        trends: {
          tasksThisWeek,
          tasksLastWeek,
          completionRateThisWeek,
          completionRateLastWeek,
          growthRate
        },
        topMetrics: {
          mostProductiveUser,
          mostActiveProject,
          longestStreak
        },
        recentActivity
      };

      await this.recordMetric('analytics.dashboard_generated', 1);

      return analytics;
    } catch (error) {
      this.handleError(error, 'getDashboardAnalytics', ctx);
    }
  }

  // Private Helper Methods
  private async getTasksOverTime(whereClause: any, dateField: string, range: DateRange): Promise<Array<{ date: string; count: number }>> {
    const result = await db
      .select({
        date: sql`DATE(${sql.identifier(dateField)})`.as('date'),
        count: count()
      })
      .from(tasks)
      .where(whereClause)
      .groupBy(sql`DATE(${sql.identifier(dateField)})`)
      .orderBy(sql`DATE(${sql.identifier(dateField)})`);

    // Fill in missing dates with 0 count
    const dateMap = new Map(result.map(item => [item.date, item.count]));
    const filledData = [];
    
    const currentDate = new Date(range.startDate);
    while (currentDate <= range.endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      filledData.push({
        date: dateString,
        count: dateMap.get(dateString) || 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return filledData;
  }

  private calculateProductivityScore(
    tasksCompleted: number,
    tasksCreated: number,
    averageCompletionTime: number,
    activityCount: number
  ): number {
    // Productivity score algorithm (0-100)
    let score = 0;

    // Completion rate (40% of score)
    const completionRate = tasksCreated > 0 ? tasksCompleted / tasksCreated : 0;
    score += completionRate * 40;

    // Speed factor (30% of score) - lower completion time is better
    if (averageCompletionTime > 0) {
      const speedScore = Math.max(0, 30 - (averageCompletionTime / 24) * 5); // Penalize if takes more than 6 days
      score += speedScore;
    }

    // Activity level (30% of score)
    const activityScore = Math.min(30, activityCount / 10); // Max 30 points for 100+ activities
    score += activityScore;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  private async calculateUserStreak(userId: string, endDate: Date): Promise<number> {
    // Get user's completed tasks ordered by completion date
    const completedTasks = await db
      .select({ completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(
        eq(tasks.assigneeId, userId),
        eq(tasks.status, 'completed'),
        sql`${tasks.completedAt} IS NOT NULL`
      ))
      .orderBy(desc(tasks.completedAt));

    if (completedTasks.length === 0) return 0;

    // Calculate streak
    let streak = 0;
    let currentDate = new Date(endDate);
    currentDate.setHours(0, 0, 0, 0);

    const completionDates = completedTasks.map(task => {
      const date = new Date(task.completedAt!);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    });

    const uniqueDates = [...new Set(completionDates)].sort((a, b) => b - a);

    for (const dateTime of uniqueDates) {
      if (dateTime === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (dateTime < currentDate.getTime()) {
        break;
      }
    }

    return streak;
  }

  private async getMostProductiveTimePatterns(userId: string, range: DateRange): Promise<{ mostProductiveHour: number; mostProductiveDay: string }> {
    const completedTasks = await db
      .select({ completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(
        eq(tasks.assigneeId, userId),
        eq(tasks.status, 'completed'),
        sql`${tasks.completedAt} IS NOT NULL`,
        gte(tasks.completedAt, range.startDate),
        lte(tasks.completedAt, range.endDate)
      ));

    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<string, number> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    completedTasks.forEach(task => {
      const date = new Date(task.completedAt!);
      const hour = date.getHours();
      const dayName = dayNames[date.getDay()];

      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
    });

    const mostProductiveHour = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 9; // Default to 9 AM

    const mostProductiveDay = Object.entries(dayCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Monday'; // Default to Monday

    return {
      mostProductiveHour: parseInt(mostProductiveHour.toString()),
      mostProductiveDay
    };
  }

  private async getMostProductiveUser(): Promise<UserProductivityAnalytics> {
    // Get user with most completed tasks in the last 30 days
    const result = await db
      .select({
        userId: tasks.assigneeId,
        count: count()
      })
      .from(tasks)
      .where(and(
        eq(tasks.status, 'completed'),
        gte(tasks.completedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ))
      .groupBy(tasks.assigneeId)
      .orderBy(desc(count()))
      .limit(1);

    if (result.length === 0 || !result[0].userId) {
      // Return default empty user
      return {
        userId: '',
        userName: 'No data',
        tasksCompleted: 0,
        tasksCreated: 0,
        averageCompletionTime: 0,
        productivityScore: 0,
        streakDays: 0,
        mostProductiveHour: 9,
        mostProductiveDay: 'Monday',
        activityCount: 0
      };
    }

    return this.getUserProductivityAnalytics(result[0].userId);
  }

  private async getMostActiveProject(): Promise<{ projectId: string; projectName: string; activityCount: number }> {
    const result = await db
      .select({
        projectId: activities.projectId,
        count: count()
      })
      .from(activities)
      .where(and(
        sql`${activities.projectId} IS NOT NULL`,
        gte(activities.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ))
      .groupBy(activities.projectId)
      .orderBy(desc(count()))
      .limit(1);

    if (result.length === 0 || !result[0].projectId) {
      return { projectId: '', projectName: 'No data', activityCount: 0 };
    }

    const project = await projectRepository.findById(result[0].projectId);
    return {
      projectId: result[0].projectId,
      projectName: project?.name || 'Unknown Project',
      activityCount: result[0].count
    };
  }

  private async getLongestStreak(): Promise<{ userId: string; userName: string; streakDays: number }> {
    // Get all users and calculate their streaks
    const allUsers = await userRepository.findMany({ limit: 1000 });
    
    let longestStreak = { userId: '', userName: 'No data', streakDays: 0 };
    
    for (const user of allUsers.data) {
      const streak = await this.calculateUserStreak(user.id, new Date());
      if (streak > longestStreak.streakDays) {
        longestStreak = {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`.trim(),
          streakDays: streak
        };
      }
    }
    
    return longestStreak;
  }

  private async getRecentActivity(limit: number = 10): Promise<Array<{
    type: string;
    description: string;
    timestamp: Date;
    userId: string;
    userName: string;
  }>> {
    const recentActivities = await db
      .select({
        type: activities.type,
        data: activities.data,
        createdAt: activities.createdAt,
        userId: activities.userId
      })
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(limit);

    const result = [];
    
    for (const activity of recentActivities) {
      const user = await userRepository.findById(activity.userId);
      const userName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown User';
      
      // Generate description based on activity type
      let description = '';
      const data = activity.data as any;
      
      switch (activity.type) {
        case 'task_created':
          description = `Created a new task: ${data?.taskTitle || 'Untitled'}`;
          break;
        case 'task_completed':
          description = `Completed task: ${data?.taskTitle || 'Untitled'}`;
          break;
        case 'project_created':
          description = `Created a new project: ${data?.projectName || 'Untitled'}`;
          break;
        case 'team_member_added':
          description = `Added a new team member`;
          break;
        default:
          description = `Performed action: ${activity.type.replace('_', ' ')}`;
      }
      
      result.push({
        type: activity.type,
        description,
        timestamp: activity.createdAt,
        userId: activity.userId,
        userName
      });
    }
    
    return result;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
