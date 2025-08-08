import {
  eq,
  and,
  or,
  desc,
  asc,
  count,
  sum,
  avg,
  gte,
  lte,
  between,
  sql,
} from 'drizzle-orm';
import {
  BaseService,
  ServiceContext,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from './base.service';
import {
  taskRepository,
  projectRepository,
  userRepository,
  activityRepository,
  teamRepository,
  workspaceRepository,
  feedbackRepository,
} from '../db/repositories';
import { tasks } from '../../task-management/schemas/tasks';
import { projects } from '../../task-management/schemas/projects';
import { users } from '../../authentication/schemas/users';
import { activities } from '../schemas/activities';
import { feedback } from '../../../infrastructure/database/drizzle/schema/feedback';
import { db } from '../../../infrastructure/database/connection';

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

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'heatmap' | 'gauge' | 'progress';
  title: string;
  description?: string;
  position: { x: number; y: number; width: number; height: number };
  config: {
    dataSource: string;
    refreshInterval?: number; // seconds
    filters?: Record<string, any>;
    visualization?: {
      chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
      colors?: string[];
      showLegend?: boolean;
      showGrid?: boolean;
    };
  };
  permissions: {
    view: string[];
    edit: string[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomDashboard {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  workspaceId?: string;
  widgets: DashboardWidget[];
  layout: 'grid' | 'freeform';
  isPublic: boolean;
  sharedWith: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RealTimeMetrics {
  activeUsers: number;
  concurrentSessions: number;
  tasksCompletedToday: number;
  systemLoad: {
    cpu: number;
    memory: number;
    database: number;
  };
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  throughput: number; // requests per minute
  lastUpdated: Date;
}

export interface ExecutiveDashboard {
  kpis: {
    userGrowth: { value: number; trend: number; target: number };
    taskCompletionRate: { value: number; trend: number; target: number };
    userEngagement: { value: number; trend: number; target: number };
    systemUptime: { value: number; trend: number; target: number };
    customerSatisfaction: { value: number; trend: number; target: number };
  };
  charts: {
    userGrowthChart: Array<{
      date: string;
      users: number;
      activeUsers: number;
    }>;
    taskCompletionChart: Array<{
      date: string;
      completed: number;
      created: number;
    }>;
    revenueChart: Array<{ date: string; revenue: number; forecast: number }>;
    performanceChart: Array<{
      date: string;
      responseTime: number;
      errorRate: number;
    }>;
  };
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
    acknowledged: boolean;
  }>;
  lastUpdated: Date;
}

export class DashboardService extends BaseService {
  private readonly CACHE_TTL = 5 * 60; // 5 minutes
  private realTimeMetricsCache: Map<string, any> = new Map();
  private dashboardSubscriptions: Map<string, Set<string>> = new Map(); // dashboardId -> userIds
  private metricsUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super('DashboardService', {
      enableCache: true,
      cacheTimeout: 300, // 5 minutes
      enableAudit: true,
      enableMetrics: true,
    });

    this.initializeRealTimeMetrics();
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
        feedbackCount,
      ] = await Promise.all([
        this.getUserCount(),
        this.getTaskCount(),
        this.getProjectCount(),
        this.getTeamCount(),
        this.getWorkspaceCount(),
        this.getFeedbackCount(),
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
  async getUserActivity(
    days: number = 30,
    context?: ServiceContext
  ): Promise<UserActivity> {
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
          count: count(),
        })
        .from(users)
        .where(gte(users.createdAt, startDate))
        .groupBy(sql`DATE(${users.createdAt})`)
        .orderBy(sql`DATE(${users.createdAt})`);

      // Get user logins by day
      const loginsByDay = await db
        .select({
          date: sql`DATE(${users.lastLoginAt})`.as('date'),
          count: count(),
        })
        .from(users)
        .where(
          and(
            sql`${users.lastLoginAt} IS NOT NULL`,
            gte(users.lastLoginAt, startDate)
          )
        )
        .groupBy(sql`DATE(${users.lastLoginAt})`)
        .orderBy(sql`DATE(${users.lastLoginAt})`);

      const result: UserActivity = {
        newUsers: this.formatDailyData(newUsersByDay, days),
        logins: this.formatDailyData(loginsByDay, days),
        lastUpdated: new Date(),
      };

      await this.recordMetric('dashboard.user_activity.generated', 1, {
        days: days.toString(),
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getUserActivity', ctx);
    }
  }

  /**
   * Get task statistics
   */
  async getTaskStatistics(
    days: number = 30,
    context?: ServiceContext
  ): Promise<TaskStatistics> {
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
          count: count(),
        })
        .from(tasks)
        .where(gte(tasks.createdAt, startDate))
        .groupBy(sql`DATE(${tasks.createdAt})`)
        .orderBy(sql`DATE(${tasks.createdAt})`);

      // Get completed tasks by day
      const completedTasksByDay = await db
        .select({
          date: sql`DATE(${tasks.completedAt})`.as('date'),
          count: count(),
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.status, 'completed'),
            sql`${tasks.completedAt} IS NOT NULL`,
            gte(tasks.completedAt, startDate)
          )
        )
        .groupBy(sql`DATE(${tasks.completedAt})`)
        .orderBy(sql`DATE(${tasks.completedAt})`);

      // Get average task completion time
      const avgCompletionTimeResult = await db
        .select({
          avgTime: avg(
            sql`EXTRACT(EPOCH FROM (${tasks.completedAt} - ${tasks.createdAt}))`
          ),
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.status, 'completed'),
            sql`${tasks.completedAt} IS NOT NULL`,
            gte(tasks.completedAt, startDate),
            gte(tasks.createdAt, startDate)
          )
        );

      const avgCompletionTime = avgCompletionTimeResult[0]?.avgTime
        ? Number(avgCompletionTimeResult[0].avgTime) / 3600 // Convert seconds to hours
        : 0;

      // Get tasks by assignee
      const tasksByAssigneeResult = await db
        .select({
          userId: tasks.assigneeId,
          count: count(),
        })
        .from(tasks)
        .innerJoin(users, eq(tasks.assigneeId, users.id))
        .where(
          and(
            sql`${tasks.assigneeId} IS NOT NULL`,
            gte(tasks.createdAt, startDate)
          )
        )
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
              count: item.count,
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

      await this.recordMetric('dashboard.task_statistics.generated', 1, {
        days: days.toString(),
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getTaskStatistics', ctx);
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStatistics(
    days: number = 30,
    context?: ServiceContext
  ): Promise<ProjectStatistics> {
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
          count: count(),
        })
        .from(projects)
        .where(gte(projects.createdAt, startDate))
        .groupBy(sql`DATE(${projects.createdAt})`)
        .orderBy(sql`DATE(${projects.createdAt})`);

      // Get projects by archived status (since there's no status field)
      const projectsByStatusResult = await db
        .select({
          isArchived: projects.isArchived,
          count: count(),
        })
        .from(projects)
        .groupBy(projects.isArchived);

      const projectsByStatus = projectsByStatusResult.reduce(
        (acc, item) => {
          const status = item.isArchived ? 'archived' : 'active';
          acc[status] = item.count;
          return acc;
        },
        {} as Record<string, number>
      );

      // Get projects with most tasks
      const projectsWithMostTasksResult = await db
        .select({
          projectId: projects.id,
          name: projects.name,
          isArchived: projects.isArchived,
          count: count(tasks.id),
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
        count: item.count,
      }));

      const result: ProjectStatistics = {
        newProjects: this.formatDailyData(newProjectsByDay, days),
        projectsByStatus,
        projectsWithMostTasks,
        lastUpdated: new Date(),
      };

      await this.recordMetric('dashboard.project_statistics.generated', 1, {
        days: days.toString(),
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getProjectStatistics', ctx);
    }
  }

  /**
   * Get team and workspace statistics
   */
  async getTeamWorkspaceStatistics(
    context?: ServiceContext
  ): Promise<TeamWorkspaceStatistics> {
    const ctx = this.createContext(context);
    this.logOperation('getTeamWorkspaceStatistics', ctx);

    try {
      // Get teams with most members (placeholder - would need proper team member counting)
      const teamsWithMostMembers = await teamRepository.findMany({ limit: 10 });
      const formattedTeams = teamsWithMostMembers.data.map(team => ({
        teamId: team.id,
        name: team.name,
        memberCount: 0, // Would need to implement member counting
      }));

      // Get workspaces with most projects (placeholder - would need proper workspace-project relationship)
      const workspacesWithMostProjects = await workspaceRepository.findMany({
        limit: 10,
      });
      const formattedWorkspaces = workspacesWithMostProjects.data.map(
        workspace => ({
          workspaceId: workspace.id,
          name: workspace.name,
          count: 0, // Would need to implement project counting
        })
      );

      const result: TeamWorkspaceStatistics = {
        teamsWithMostMembers: formattedTeams,
        workspacesWithMostProjects: formattedWorkspaces,
        lastUpdated: new Date(),
      };

      await this.recordMetric(
        'dashboard.team_workspace_statistics.generated',
        1
      );

      return result;
    } catch (error) {
      this.handleError(error, 'getTeamWorkspaceStatistics', ctx);
    }
  }

  /**
   * Invalidate dashboard cache
   */
  async invalidateDashboardCache(
    key?: string,
    context?: ServiceContext
  ): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('invalidateDashboardCache', ctx, { key });

    try {
      // In a real implementation, this would clear specific cache keys
      // For now, we'll just log the operation
      console.log(`Dashboard cache invalidated: ${key || 'all'}`);

      await this.recordMetric('dashboard.cache.invalidated', 1, {
        key: key || 'all',
      });
    } catch (error) {
      this.handleError(error, 'invalidateDashboardCache', ctx);
    }
  }

  /**
   * Initialize real-time metrics collection
   */
  private initializeRealTimeMetrics(): void {
    // Update real-time metrics every 30 seconds
    this.metricsUpdateInterval = setInterval(async () => {
      try {
        await this.updateRealTimeMetrics();
      } catch (error) {
        this.logger.error('Failed to update real-time metrics', {
          error: error.message,
        });
      }
    }, 30000);
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(context?: ServiceContext): Promise<RealTimeMetrics> {
    const ctx = this.createContext(context);
    this.logOperation('getRealTimeMetrics', ctx);

    try {
      const cached = this.realTimeMetricsCache.get('realtime');
      if (cached && Date.now() - cached.timestamp < 30000) {
        return cached.data;
      }

      const metrics = await this.calculateRealTimeMetrics();

      this.realTimeMetricsCache.set('realtime', {
        data: metrics,
        timestamp: Date.now(),
      });

      await this.recordMetric('dashboard.realtime_metrics.generated', 1);

      return metrics;
    } catch (error) {
      this.handleError(error, 'getRealTimeMetrics', ctx);
    }
  }

  /**
   * Get executive dashboard
   */
  async getExecutiveDashboard(
    workspaceId?: string,
    timeRange?: { startDate: Date; endDate: Date },
    context?: ServiceContext
  ): Promise<ExecutiveDashboard> {
    const ctx = this.createContext(context);
    this.logOperation('getExecutiveDashboard', ctx, { workspaceId, timeRange });

    try {
      const range = timeRange || {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      };

      // Calculate KPIs
      const kpis = await this.calculateExecutiveKPIs(workspaceId, range);

      // Generate charts data
      const charts = await this.generateExecutiveCharts(workspaceId, range);

      // Get active alerts
      const alerts = await this.getActiveAlerts(workspaceId);

      const dashboard: ExecutiveDashboard = {
        kpis,
        charts,
        alerts,
        lastUpdated: new Date(),
      };

      await this.recordMetric('dashboard.executive.generated', 1, {
        workspaceId: workspaceId || 'global',
      });

      return dashboard;
    } catch (error) {
      this.handleError(error, 'getExecutiveDashboard', ctx);
    }
  }

  /**
   * Create custom dashboard
   */
  async createCustomDashboard(
    dashboardData: Omit<CustomDashboard, 'id' | 'createdAt' | 'updatedAt'>,
    context?: ServiceContext
  ): Promise<CustomDashboard> {
    const ctx = this.createContext(context);
    this.logOperation('createCustomDashboard', ctx, {
      name: dashboardData.name,
    });

    try {
      const dashboard: CustomDashboard = {
        ...dashboardData,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store dashboard (implementation would save to database)
      await this.storeDashboard(dashboard);

      await this.recordMetric('dashboard.custom.created', 1, {
        ownerId: dashboard.ownerId,
        widgetCount: dashboard.widgets.length.toString(),
      });

      return dashboard;
    } catch (error) {
      this.handleError(error, 'createCustomDashboard', ctx);
    }
  }

  /**
   * Get widget data
   */
  async getWidgetData(
    widgetId: string,
    config: DashboardWidget['config'],
    context?: ServiceContext
  ): Promise<any> {
    const ctx = this.createContext(context);
    this.logOperation('getWidgetData', ctx, {
      widgetId,
      dataSource: config.dataSource,
    });

    try {
      let data;

      switch (config.dataSource) {
        case 'system_overview':
          data = await this.getSystemOverview(ctx);
          break;
        case 'user_activity':
          data = await this.getUserActivity(30, ctx);
          break;
        case 'task_statistics':
          data = await this.getTaskStatistics(30, ctx);
          break;
        case 'project_statistics':
          data = await this.getProjectStatistics(30, ctx);
          break;
        case 'realtime_metrics':
          data = await this.getRealTimeMetrics(ctx);
          break;
        default:
          throw new ValidationError(
            `Unknown data source: ${config.dataSource}`
          );
      }

      // Apply filters if specified
      if (config.filters) {
        data = this.applyFilters(data, config.filters);
      }

      await this.recordMetric('dashboard.widget_data.retrieved', 1, {
        widgetId,
        dataSource: config.dataSource,
      });

      return data;
    } catch (error) {
      this.handleError(error, 'getWidgetData', ctx);
    }
  }

  private async updateRealTimeMetrics(): Promise<void> {
    try {
      const metrics = await this.calculateRealTimeMetrics();

      this.realTimeMetricsCache.set('realtime', {
        data: metrics,
        timestamp: Date.now(),
      });

      // Notify subscribers
      await this.notifyDashboardSubscribers('realtime_metrics', metrics);
    } catch (error) {
      this.logger.error('Failed to update real-time metrics', {
        error: error.message,
      });
    }
  }

  private async calculateRealTimeMetrics(): Promise<RealTimeMetrics> {
    // Implementation would calculate actual real-time metrics
    return {
      activeUsers: 0,
      concurrentSessions: 0,
      tasksCompletedToday: 0,
      systemLoad: {
        cpu: 0,
        memory: 0,
        database: 0,
      },
      responseTime: {
        average: 0,
        p95: 0,
        p99: 0,
      },
      errorRate: 0,
      throughput: 0,
      lastUpdated: new Date(),
    };
  }

  private async calculateExecutiveKPIs(
    workspaceId?: string,
    timeRange?: { startDate: Date; endDate: Date }
  ): Promise<ExecutiveDashboard['kpis']> {
    // Implementation would calculate actual KPIs
    return {
      userGrowth: { value: 15.2, trend: 5.3, target: 20 },
      taskCompletionRate: { value: 87.5, trend: 2.1, target: 90 },
      userEngagement: { value: 73.8, trend: -1.2, target: 80 },
      systemUptime: { value: 99.9, trend: 0.1, target: 99.5 },
      customerSatisfaction: { value: 4.2, trend: 0.3, target: 4.5 },
    };
  }

  private async generateExecutiveCharts(
    workspaceId?: string,
    timeRange?: { startDate: Date; endDate: Date }
  ): Promise<ExecutiveDashboard['charts']> {
    // Implementation would generate actual chart data
    return {
      userGrowthChart: [],
      taskCompletionChart: [],
      revenueChart: [],
      performanceChart: [],
    };
  }

  private async getActiveAlerts(
    workspaceId?: string
  ): Promise<ExecutiveDashboard['alerts']> {
    // Implementation would get actual alerts
    return [];
  }

  private async storeDashboard(dashboard: CustomDashboard): Promise<void> {
    // Implementation would store dashboard in database
  }

  private applyFilters(data: any, filters: Record<string, any>): any {
    // Implementation would apply filters to data
    return data;
  }

  private async notifyDashboardSubscribers(
    type: string,
    data: any
  ): Promise<void> {
    // Implementation would notify WebSocket subscribers
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
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
      .where(
        and(
          sql`${users.lastLoginAt} IS NOT NULL`,
          gte(users.lastLoginAt, since)
        )
      );
    return result[0]?.count || 0;
  }

  private async getTasksByStatus(): Promise<Record<string, number>> {
    const result = await db
      .select({
        status: tasks.status,
        count: count(),
      })
      .from(tasks)
      .groupBy(tasks.status);

    return result.reduce(
      (acc, item) => {
        acc[item.status] = item.count;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private async getTasksByPriority(): Promise<Record<string, number>> {
    const result = await db
      .select({
        priority: tasks.priority,
        count: count(),
      })
      .from(tasks)
      .groupBy(tasks.priority);

    return result.reduce(
      (acc, item) => {
        acc[item.priority] = item.count;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private formatDailyData(
    data: any[],
    days: number
  ): Array<{ date: string; count: number }> {
    const result = [];
    const today = new Date();
    const dateMap = new Map();

    // Create map of existing data
    data.forEach(item => {
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
