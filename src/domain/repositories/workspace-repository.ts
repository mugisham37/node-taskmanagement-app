import { Workspace, WorkspaceMember } from '../entities/workspace';
import {
  WorkspaceAggregate,
  ProjectSummary,
} from '../aggregates/workspace-aggregate';
import { WorkspaceId, UserId, ProjectId } from '../value-objects';

/**
 * Workspace filter options
 */
export interface WorkspaceFilters {
  ownerId?: UserId;
  memberId?: UserId;
  isActive?: boolean;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Workspace sorting options
 */
export interface WorkspaceSortOptions {
  field: 'createdAt' | 'updatedAt' | 'name' | 'memberCount' | 'projectCount';
  direction: 'ASC' | 'DESC';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Workspace Repository Interface
 * Defines all necessary workspace operations for persistence
 */
export interface IWorkspaceRepository {
  /**
   * Find a workspace by its ID
   */
  findById(id: WorkspaceId): Promise<Workspace | null>;

  /**
   * Find a workspace by its slug
   */
  findBySlug(slug: string): Promise<Workspace | null>;

  /**
   * Find workspaces by user ID (where user is a member)
   */
  findByUserId(userId: UserId): Promise<Workspace[]>;

  /**
   * Get member count for a workspace
   */
  getMemberCount(workspaceId: WorkspaceId): Promise<number>;

  /**
   * Get project count for a workspace
   */
  getProjectCount(workspaceId: WorkspaceId): Promise<number>;

  /**
   * Get storage used by a workspace (in GB)
   */
  getStorageUsed(workspaceId: WorkspaceId): Promise<number>;

  /**
   * Get workspace statistics with date range
   */
  getWorkspaceStatistics(
    workspaceId: WorkspaceId,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    totalMembers: number;
    activeMembers: number;
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    storageUsed: number;
    storageLimit: number;
    membersByRole: Record<string, number>;
    projectsByStatus: Record<string, number>;
    activityTrend: { date: string; count: number }[];
    topContributors: {
      userId: string;
      firstName: string;
      lastName: string;
      contributionScore: number;
    }[];
  }>;

  /**
   * Get workspace usage statistics
   */
  getUsageStatistics(workspaceId: WorkspaceId): Promise<{
    projects: {
      current: number;
      limit: number;
      percentage: number;
    };
    members: {
      current: number;
      limit: number;
      percentage: number;
    };
    storage: {
      currentGB: number;
      limitGB: number;
      percentage: number;
    };
    apiCalls: {
      currentMonth: number;
      limit: number;
      percentage: number;
    };
  }>;

  /**
   * Find multiple workspaces by their IDs
   */
  findByIds(ids: WorkspaceId[]): Promise<Workspace[]>;

  /**
   * Find workspaces owned by a user
   */
  findByOwnerId(
    ownerId: UserId,
    filters?: WorkspaceFilters,
    sort?: WorkspaceSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>>;

  /**
   * Find workspaces where user is a member
   */
  findByMemberId(
    userId: UserId,
    filters?: WorkspaceFilters,
    sort?: WorkspaceSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>>;

  /**
   * Find workspaces with optional filters, sorting, and pagination
   */
  findWorkspaces(
    filters?: WorkspaceFilters,
    sort?: WorkspaceSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>>;

  /**
   * Search workspaces by name or description
   */
  searchWorkspaces(
    searchTerm: string,
    filters?: WorkspaceFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>>;

  /**
   * Get active workspaces
   */
  getActiveWorkspaces(
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>>;

  /**
   * Get inactive workspaces
   */
  getInactiveWorkspaces(
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>>;

  /**
   * Get workspaces requiring attention
   */
  getWorkspacesRequiringAttention(ownerId?: UserId): Promise<Workspace[]>;

  /**
   * Get workspace statistics
   */
  getWorkspaceStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalMembers: number;
    totalProjects: number;
    averageMembersPerWorkspace: number;
    averageProjectsPerWorkspace: number;
  }>;

  /**
   * Get workspace members
   */
  getWorkspaceMembers(workspaceId: WorkspaceId): Promise<WorkspaceMember[]>;

  /**
   * Get workspace member by user ID
   */
  getWorkspaceMember(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<WorkspaceMember | null>;

  /**
   * Add workspace member
   */
  addWorkspaceMember(
    workspaceId: WorkspaceId,
    member: WorkspaceMember
  ): Promise<void>;

  /**
   * Remove workspace member
   */
  removeWorkspaceMember(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<void>;

  /**
   * Update workspace member role
   */
  updateWorkspaceMemberRole(
    workspaceId: WorkspaceId,
    userId: UserId,
    newRole: 'ADMIN' | 'MEMBER'
  ): Promise<void>;

  /**
   * Get workspace projects
   */
  getWorkspaceProjects(workspaceId: WorkspaceId): Promise<ProjectId[]>;

  /**
   * Add project to workspace
   */
  addWorkspaceProject(
    workspaceId: WorkspaceId,
    projectId: ProjectId
  ): Promise<void>;

  /**
   * Remove project from workspace
   */
  removeWorkspaceProject(
    workspaceId: WorkspaceId,
    projectId: ProjectId
  ): Promise<void>;

  /**
   * Save a single workspace
   */
  save(workspace: Workspace): Promise<void>;

  /**
   * Save multiple workspaces
   */
  saveMany(workspaces: Workspace[]): Promise<void>;

  /**
   * Delete a workspace
   */
  delete(id: WorkspaceId): Promise<void>;

  /**
   * Delete multiple workspaces
   */
  deleteMany(ids: WorkspaceId[]): Promise<void>;

  /**
   * Check if a workspace exists
   */
  exists(id: WorkspaceId): Promise<boolean>;

  /**
   * Count workspaces matching filters
   */
  count(filters?: WorkspaceFilters): Promise<number>;

  /**
   * Get workspace aggregate
   */
  getWorkspaceAggregate(
    workspaceId: WorkspaceId
  ): Promise<WorkspaceAggregate | null>;

  /**
   * Save workspace aggregate
   */
  saveWorkspaceAggregate(aggregate: WorkspaceAggregate): Promise<void>;

  /**
   * Get workspace activity summary
   */
  getWorkspaceActivitySummary(
    workspaceId: WorkspaceId,
    fromDate: Date,
    toDate: Date
  ): Promise<{
    projectsCreated: number;
    projectsCompleted: number;
    tasksCreated: number;
    tasksCompleted: number;
    membersJoined: number;
    membersLeft: number;
    lastActivity: Date;
  }>;

  /**
   * Get workspace health scores
   */
  getWorkspaceHealthScores(): Promise<Map<string, number>>;

  /**
   * Get workspace capacity analysis
   */
  getWorkspaceCapacityAnalysis(workspaceId: WorkspaceId): Promise<{
    memberCapacity: number; // percentage
    projectCapacity: number; // percentage
    taskCapacity: number; // percentage
    recommendedActions: string[];
  }>;

  /**
   * Get user's workspace roles
   */
  getUserWorkspaceRoles(userId: UserId): Promise<
    Array<{
      workspaceId: WorkspaceId;
      workspaceName: string;
      role: 'OWNER' | 'ADMIN' | 'MEMBER';
      joinedAt: Date;
    }>
  >;

  /**
   * Check if user has access to workspace
   */
  userHasAccessToWorkspace(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<boolean>;

  /**
   * Get user's permission level in workspace
   */
  getUserPermissionLevel(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<'OWNER' | 'ADMIN' | 'MEMBER' | null>;

  /**
   * Get workspaces with low activity
   */
  getWorkspacesWithLowActivity(
    days: number,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>>;

  /**
   * Get workspaces over capacity
   */
  getWorkspacesOverCapacity(
    capacityThreshold: number,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Workspace>>;

  /**
   * Get workspace member activity
   */
  getWorkspaceMemberActivity(
    workspaceId: WorkspaceId,
    fromDate: Date,
    toDate: Date
  ): Promise<Map<string, Date>>; // userId -> last activity date

  /**
   * Get workspace project summaries
   */
  getWorkspaceProjectSummaries(
    workspaceId: WorkspaceId
  ): Promise<ProjectSummary[]>;

  /**
   * Update workspace project summary
   */
  updateWorkspaceProjectSummary(
    workspaceId: WorkspaceId,
    projectSummary: ProjectSummary
  ): Promise<void>;

  /**
   * Get workspace growth metrics
   */
  getWorkspaceGrowthMetrics(
    workspaceId: WorkspaceId,
    fromDate: Date,
    toDate: Date
  ): Promise<{
    memberGrowth: number;
    projectGrowth: number;
    taskGrowth: number;
    completionRate: number;
  }>;

  /**
   * Get workspaces ready for archival
   */
  getWorkspacesReadyForArchival(inactiveDays: number): Promise<Workspace[]>;

  /**
   * Bulk update workspace status
   */
  bulkUpdateStatus(
    workspaceIds: WorkspaceId[],
    isActive: boolean
  ): Promise<void>;

  /**
   * Transfer workspace ownership
   */
  transferOwnership(
    workspaceId: WorkspaceId,
    currentOwnerId: UserId,
    newOwnerId: UserId
  ): Promise<void>;

  /**
   * Get workspace collaboration metrics
   */
  getWorkspaceCollaborationMetrics(workspaceId: WorkspaceId): Promise<{
    averageTasksPerMember: number;
    averageProjectsPerMember: number;
    memberInteractionScore: number; // 0-100
    crossProjectCollaboration: number; // percentage
  }>;

  /**
   * Find a workspace member
   */
  findMember(workspaceId: WorkspaceId, userId: UserId): Promise<WorkspaceMember | null>;
}
