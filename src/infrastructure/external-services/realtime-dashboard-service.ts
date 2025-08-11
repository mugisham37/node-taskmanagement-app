import { WebSocketService } from './websocket-service';
import { CacheService } from '../caching/cache-service';
import { LoggingService } from '../monitoring/logging-service';

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  totalProjects: number;
  activeProjects: number;
  totalUsers: number;
  activeUsers: number;
  lastUpdated: Date;
}

export interface ProjectDashboardStats {
  projectId: string;
  projectName: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  teamMembers: number;
  activeMembers: number;
  completionRate: number;
  lastActivity: Date;
}

export interface UserActivityStats {
  userId: string;
  userEmail: string;
  tasksCompleted: number;
  tasksInProgress: number;
  projectsActive: number;
  lastActivity: Date;
  isOnline: boolean;
}

export interface ProjectMetrics {
  projectId: string;
  taskMetrics: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  };
  teamMetrics: {
    totalMembers: number;
    activeMembers: number;
  };
  performance: {
    completionRate: number;
    averageTaskDuration: number;
    velocityTrend: number;
  };
  lastUpdated: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  dbStatus: 'connected' | 'disconnected' | 'slow';
  cacheStatus: 'connected' | 'disconnected' | 'slow';
  lastCheck: Date;
}

export interface DashboardData {
  overview: DashboardStats;
  projects: ProjectDashboardStats[];
  userActivity: UserActivityStats;
  systemHealth: SystemHealth;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: Date;
    userId?: string;
    projectId?: string;
  }>;
}

/**
 * Service for managing real-time dashboard statistics and updates
 */
export class RealtimeDashboardService {
  private dashboardStats: Map<string, DashboardStats> = new Map();
  private projectStats: Map<string, ProjectDashboardStats> = new Map();
  private userActivityStats: Map<string, UserActivityStats> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly webSocketService: WebSocketService,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {
    this.startPeriodicUpdates();
  }

  /**
   * Start periodic dashboard updates
   */
  private startPeriodicUpdates(): void {
    // Update dashboard stats every 30 seconds
    this.updateInterval = setInterval(async () => {
      await this.updateAllDashboardStats();
    }, 30000);

    this.logger.info(
      'Real-time dashboard service started with periodic updates'
    );
  }

  /**
   * Stop periodic updates
   */
  stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update workspace dashboard statistics
   */
  async updateWorkspaceDashboard(
    workspaceId: string,
    stats: Partial<DashboardStats>
  ): Promise<void> {
    try {
      const currentStats = this.dashboardStats.get(workspaceId) || {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        totalProjects: 0,
        activeProjects: 0,
        totalUsers: 0,
        activeUsers: 0,
        lastUpdated: new Date(),
      };

      const updatedStats: DashboardStats = {
        ...currentStats,
        ...stats,
        lastUpdated: new Date(),
      };

      this.dashboardStats.set(workspaceId, updatedStats);

      // Cache the stats
      await this.cacheService.set(
        `dashboard:workspace:${workspaceId}`,
        JSON.stringify(updatedStats),
        { ttl: 300 } // 5 minutes TTL
      );

      // Broadcast to workspace subscribers
      this.webSocketService.broadcastToChannel(`workspace:${workspaceId}`, {
        type: 'dashboard_update',
        payload: {
          workspaceId,
          stats: updatedStats,
        },
        timestamp: new Date().toISOString(),
        messageId: this.generateMessageId(),
      });

      this.logger.debug('Workspace dashboard updated', {
        workspaceId,
        stats: updatedStats,
      });
    } catch (error) {
      this.logger.error(
        'Failed to update workspace dashboard',
        error as Error,
        {
          workspaceId,
        }
      );
    }
  }

  /**
   * Update project dashboard statistics
   */
  async updateProjectDashboard(
    projectId: string,
    stats: Partial<ProjectDashboardStats>
  ): Promise<void> {
    try {
      const currentStats = this.projectStats.get(projectId) || {
        projectId,
        projectName: '',
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        teamMembers: 0,
        activeMembers: 0,
        completionRate: 0,
        lastActivity: new Date(),
      };

      const updatedStats: ProjectDashboardStats = {
        ...currentStats,
        ...stats,
        lastActivity: new Date(),
        completionRate:
          currentStats.totalTasks > 0
            ? (currentStats.completedTasks / currentStats.totalTasks) * 100
            : 0,
      };

      this.projectStats.set(projectId, updatedStats);

      // Cache the stats
      await this.cacheService.set(
        `dashboard:project:${projectId}`,
        JSON.stringify(updatedStats),
        { ttl: 300 } // 5 minutes TTL
      );

      // Broadcast to project subscribers
      this.webSocketService.broadcastToChannel(`project:${projectId}`, {
        type: 'project_dashboard_update',
        payload: {
          projectId,
          stats: updatedStats,
        },
        timestamp: new Date().toISOString(),
        messageId: this.generateMessageId(),
      });

      this.logger.debug('Project dashboard updated', {
        projectId,
        stats: updatedStats,
      });
    } catch (error) {
      this.logger.error('Failed to update project dashboard', error as Error, {
        projectId,
      });
    }
  }

  /**
   * Update user activity statistics
   */
  async updateUserActivity(
    userId: string,
    stats: Partial<UserActivityStats>
  ): Promise<void> {
    try {
      const currentStats = this.userActivityStats.get(userId) || {
        userId,
        userEmail: '',
        tasksCompleted: 0,
        tasksInProgress: 0,
        projectsActive: 0,
        lastActivity: new Date(),
        isOnline: false,
      };

      const updatedStats: UserActivityStats = {
        ...currentStats,
        ...stats,
        lastActivity: new Date(),
      };

      this.userActivityStats.set(userId, updatedStats);

      // Cache the stats
      await this.cacheService.set(
        `dashboard:user:${userId}`,
        JSON.stringify(updatedStats),
        { ttl: 300 } // 5 minutes TTL
      );

      this.logger.debug('User activity updated', {
        userId,
        stats: updatedStats,
      });
    } catch (error) {
      this.logger.error('Failed to update user activity', error as Error, {
        userId,
      });
    }
  }

  /**
   * Get workspace dashboard statistics
   */
  async getWorkspaceDashboard(
    workspaceId: string
  ): Promise<DashboardStats | null> {
    try {
      // Try cache first
      const cached = await this.cacheService.get<string>(
        `dashboard:workspace:${workspaceId}`
      );
      if (cached) {
        return JSON.parse(cached);
      }

      // Return from memory
      return this.dashboardStats.get(workspaceId) || null;
    } catch (error) {
      this.logger.error('Failed to get workspace dashboard', error as Error, {
        workspaceId,
      });
      return null;
    }
  }

  /**
   * Get project dashboard statistics
   */
  async getProjectDashboard(
    projectId: string
  ): Promise<ProjectDashboardStats | null> {
    try {
      // Try cache first
      const cached = await this.cacheService.get<string>(
        `dashboard:project:${projectId}`
      );
      if (cached) {
        return JSON.parse(cached);
      }

      // Return from memory
      return this.projectStats.get(projectId) || null;
    } catch (error) {
      this.logger.error('Failed to get project dashboard', error as Error, {
        projectId,
      });
      return null;
    }
  }

  /**
   * Update all dashboard statistics
   */
  private async updateAllDashboardStats(): Promise<void> {
    try {
      // This would typically fetch fresh data from the database
      // For now, we'll just broadcast current stats to keep connections alive
      for (const [workspaceId, stats] of this.dashboardStats) {
        this.webSocketService.broadcastToChannel(`workspace:${workspaceId}`, {
          type: 'dashboard_heartbeat',
          payload: { workspaceId, stats },
          timestamp: new Date().toISOString(),
          messageId: this.generateMessageId(),
        });
      }
    } catch (error) {
      this.logger.error('Failed to update all dashboard stats', error as Error);
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
