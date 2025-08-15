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

export interface DashboardService {
  /**
   * Update workspace dashboard statistics
   */
  updateWorkspaceDashboard(
    workspaceId: string,
    stats: Partial<DashboardStats>
  ): Promise<void>;

  /**
   * Update project dashboard statistics
   */
  updateProjectDashboard(
    projectId: string,
    stats: Partial<ProjectDashboardStats>
  ): Promise<void>;

  /**
   * Update user activity statistics
   */
  updateUserActivity(
    userId: string,
    stats: Partial<UserActivityStats>
  ): Promise<void>;

  /**
   * Get workspace dashboard statistics
   */
  getWorkspaceDashboard(workspaceId: string): Promise<DashboardStats | null>;

  /**
   * Get project dashboard statistics
   */
  getProjectDashboard(projectId: string): Promise<ProjectDashboardStats | null>;
}