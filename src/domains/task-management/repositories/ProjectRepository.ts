import { Project } from '../entities/Project';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import { ProjectStatus } from '../value-objects/ProjectStatus';

export interface ProjectRepository {
  /**
   * Save a project entity
   */
  save(project: Project): Promise<void>;

  /**
   * Find project by ID
   */
  findById(id: ProjectId): Promise<Project | null>;

  /**
   * Find projects by workspace
   */
  findByWorkspace(workspaceId: WorkspaceId): Promise<Project[]>;

  /**
   * Find projects by owner
   */
  findByOwner(ownerId: UserId): Promise<Project[]>;

  /**
   * Find projects where user is a member
   */
  findByMember(userId: UserId): Promise<Project[]>;

  /**
   * Find projects by status
   */
  findByStatus(
    workspaceId: WorkspaceId,
    status: ProjectStatus
  ): Promise<Project[]>;

  /**
   * Find archived projects
   */
  findArchived(workspaceId: WorkspaceId): Promise<Project[]>;

  /**
   * Find projects by template
   */
  findByTemplate(templateId: string): Promise<Project[]>;

  /**
   * Search projects by name or description
   */
  search(workspaceId: WorkspaceId, query: string): Promise<Project[]>;

  /**
   * Get project count for workspace
   */
  getProjectCount(workspaceId: WorkspaceId): Promise<number>;

  /**
   * Get active project count for workspace
   */
  getActiveProjectCount(workspaceId: WorkspaceId): Promise<number>;

  /**
   * Delete project (soft delete)
   */
  delete(id: ProjectId): Promise<void>;

  /**
   * Find projects with upcoming deadlines
   */
  findWithUpcomingDeadlines(
    workspaceId: WorkspaceId,
    days: number
  ): Promise<Project[]>;

  /**
   * Find overdue projects
   */
  findOverdue(workspaceId: WorkspaceId): Promise<Project[]>;

  /**
   * Get project statistics
   */
  getProjectStats(projectId: ProjectId): Promise<{
    taskCount: number;
    completedTaskCount: number;
    memberCount: number;
    totalEstimatedHours: number;
    totalActualHours: number;
  }>;
}
