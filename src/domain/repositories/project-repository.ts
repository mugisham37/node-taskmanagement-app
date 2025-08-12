import { Project, ProjectMember } from '../entities/project';
import { ProjectAggregate } from '../aggregates/project-aggregate';
import { ProjectId, UserId, WorkspaceId } from '../value-objects';
import { ProjectStatus } from '../../shared/constants/project-constants';

/**
 * Project filter options
 */
export interface ProjectFilters {
  status?: ProjectStatus[];
  managerId?: UserId;
  memberId?: UserId;
  startDateFrom?: Date;
  startDateTo?: Date;
  endDateFrom?: Date;
  endDateTo?: Date;
  search?: string;
}

/**
 * Project sorting options
 */
export interface ProjectSortOptions {
  field: 'createdAt' | 'updatedAt' | 'name' | 'startDate' | 'endDate';
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
 * Project Repository Interface
 * Defines all necessary project operations for persistence
 */
export interface IProjectRepository {
  /**
   * Find a project by its ID
   */
  findById(id: ProjectId): Promise<Project | null>;

  /**
   * Find multiple projects by their IDs
   */
  findByIds(ids: ProjectId[]): Promise<Project[]>;

  /**
   * Find projects by workspace ID with optional filters, sorting, and pagination
   */
  findByWorkspaceId(
    workspaceId: WorkspaceId,
    filters?: ProjectFilters,
    sort?: ProjectSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Project>>;

  /**
   * Find projects where user is a member
   */
  findByMemberId(
    userId: UserId,
    filters?: ProjectFilters,
    sort?: ProjectSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Project>>;

  /**
   * Find projects managed by a user
   */
  findByManagerId(
    managerId: UserId,
    filters?: ProjectFilters,
    sort?: ProjectSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Project>>;

  /**
   * Search projects by name or description
   */
  searchProjects(
    searchTerm: string,
    workspaceId?: WorkspaceId,
    filters?: ProjectFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Project>>;

  /**
   * Get active projects for a workspace
   */
  getActiveProjects(workspaceId: WorkspaceId): Promise<Project[]>;

  /**
   * Get projects requiring attention (overdue, at risk, etc.)
   */
  getProjectsRequiringAttention(
    workspaceId?: WorkspaceId,
    managerId?: UserId
  ): Promise<Project[]>;

  /**
   * Get project statistics for a workspace
   */
  getProjectStatistics(workspaceId: WorkspaceId): Promise<{
    total: number;
    byStatus: Record<ProjectStatus, number>;
    averageCompletionTime?: number; // in days
    totalMembers: number;
    averageMembersPerProject: number;
  }>;

  /**
   * Get project members
   */
  getProjectMembers(projectId: ProjectId): Promise<ProjectMember[]>;

  /**
   * Get project member by user ID
   */
  getProjectMember(
    projectId: ProjectId,
    userId: UserId
  ): Promise<ProjectMember | null>;

  /**
   * Find a member in a project (alias for getProjectMember)
   */
  findMember(
    projectId: ProjectId,
    userId: UserId
  ): Promise<ProjectMember | null>;

  /**
   * Add project member
   */
  addProjectMember(projectId: ProjectId, member: ProjectMember): Promise<void>;

  /**
   * Remove project member
   */
  removeProjectMember(projectId: ProjectId, userId: UserId): Promise<void>;

  /**
   * Update project member role
   */
  updateProjectMemberRole(
    projectId: ProjectId,
    userId: UserId,
    newRole: string
  ): Promise<void>;

  /**
   * Get member count for a project
   */
  getMemberCount(projectId: ProjectId): Promise<number>;

  /**
   * Get task statistics for a project
   */
  getTaskStatistics(projectId: ProjectId): Promise<{
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    todoTasks: number;
  }>;

  /**
   * Find projects by user ID (projects where user is a member)
   */
  findByUserId(
    userId: UserId,
    filters?: ProjectFilters,
    sort?: ProjectSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Project>>;

  /**
   * Save a single project
   */
  save(project: Project): Promise<void>;

  /**
   * Save multiple projects
   */
  saveMany(projects: Project[]): Promise<void>;

  /**
   * Delete a project
   */
  delete(id: ProjectId): Promise<void>;

  /**
   * Delete multiple projects
   */
  deleteMany(ids: ProjectId[]): Promise<void>;

  /**
   * Check if a project exists
   */
  exists(id: ProjectId): Promise<boolean>;

  /**
   * Count projects matching filters
   */
  count(workspaceId?: WorkspaceId, filters?: ProjectFilters): Promise<number>;

  /**
   * Get project aggregate
   */
  getProjectAggregate(projectId: ProjectId): Promise<ProjectAggregate | null>;

  /**
   * Save project aggregate
   */
  saveProjectAggregate(aggregate: ProjectAggregate): Promise<void>;

  /**
   * Get projects by status
   */
  getProjectsByStatus(
    status: ProjectStatus,
    workspaceId?: WorkspaceId
  ): Promise<Project[]>;

  /**
   * Get projects ending soon (within specified days)
   */
  getProjectsEndingSoon(
    days: number,
    workspaceId?: WorkspaceId
  ): Promise<Project[]>;

  /**
   * Get overdue projects (past end date but not completed)
   */
  getOverdueProjects(workspaceId?: WorkspaceId): Promise<Project[]>;

  /**
   * Get project completion history for analytics
   */
  getProjectCompletionHistory(
    workspaceId: WorkspaceId,
    fromDate: Date,
    toDate: Date
  ): Promise<
    Array<{
      date: Date;
      completedCount: number;
      totalCount: number;
    }>
  >;

  /**
   * Get user's project roles across all projects
   */
  getUserProjectRoles(userId: UserId): Promise<
    Array<{
      projectId: ProjectId;
      projectName: string;
      role: string;
      joinedAt: Date;
    }>
  >;

  /**
   * Get project health scores
   */
  getProjectHealthScores(
    workspaceId: WorkspaceId
  ): Promise<Map<string, number>>;

  /**
   * Bulk update project status
   */
  bulkUpdateStatus(
    projectIds: ProjectId[],
    status: ProjectStatus
  ): Promise<void>;

  /**
   * Get projects ready for archival
   */
  getProjectsReadyForArchival(workspaceId?: WorkspaceId): Promise<Project[]>;

  /**
   * Get project activity summary
   */
  getProjectActivitySummary(
    projectId: ProjectId,
    fromDate: Date,
    toDate: Date
  ): Promise<{
    tasksCreated: number;
    tasksCompleted: number;
    membersActive: number;
    lastActivity: Date;
  }>;

  /**
   * Check if user has access to project
   */
  userHasAccessToProject(
    projectId: ProjectId,
    userId: UserId
  ): Promise<boolean>;

  /**
   * Get user's permission level in project
   */
  getUserPermissionLevel(
    projectId: ProjectId,
    userId: UserId
  ): Promise<string | null>;

  /**
   * Get projects with low activity (no updates in specified days)
   */
  getProjectsWithLowActivity(
    days: number,
    workspaceId?: WorkspaceId
  ): Promise<Project[]>;
}
