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

    this.logger.info('Real-time dashboard service started with periodic updates');
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
  async updateWorkspaceDashboard(workspaceId: string, stats: Partial<DashboardStats>): Promise<void> {
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
        300 // 5 minutes TTL
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
      this.logger.error('Failed to update workspace dashboard', error as Error, {
        workspaceId,
      });
    }
  }

  /**
   * Update project dashboard statistics
   */
  async updateProjectDashboard(projectId: string