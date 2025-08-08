import { ProjectAggregate } from '../aggregates/project.aggregate';
import { ProjectId } from '../value-objects/project-id';
import { WorkspaceId } from '../value-objects/workspace-id';
import { UserId } from '../../authentication/value-objects/user-id';

export interface IProjectRepository {
  /**
   * Finds a project by its unique identifier
   */
  findById(id: ProjectId): Promise<ProjectAggregate | null>;

  /**
   * Finds multiple projects by their identifiers
   */
  findByIds(ids: ProjectId[]): Promise<ProjectAggregate[]>;

  /**
   * Finds projects by workspace ID
   */
  findByWorkspaceId(workspaceId: WorkspaceId): Promise<ProjectAggregate[]>;

  /**
   * Finds projects owned by a specific user
   */
  findByOwnerId(ownerId: UserId): Promise<ProjectAggregate[]>;

  /**
   * Finds active projects in a workspace
   */
  findActiveProjects(workspaceId: WorkspaceId): Promise<ProjectAggregate[]>;

  /**
   * Finds archived projects in a workspace
   */
  findArchivedProjects(workspaceId: WorkspaceId): Promise<ProjectAggregate[]>;

  /**
   * Saves a project aggregate
   */
  save(project: ProjectAggregate): Promise<void>;

  /**
   * Deletes a project (soft delete)
   */
  delete(id: ProjectId): Promise<void>;

  /**
   * Checks if a project exists by name in workspace
   */
  existsByNameInWorkspace(
    name: string,
    workspaceId: WorkspaceId,
    excludeId?: ProjectId
  ): Promise<boolean>;

  /**
   * Counts projects in a workspace
   */
  countByWorkspaceId(workspaceId: WorkspaceId): Promise<number>;

  /**
   * Finds projects with pagination
   */
  findWithPagination(
    workspaceId: WorkspaceId,
    offset: number,
    limit: number,
    filters?: {
      isArchived?: boolean;
      ownerId?: UserId;
      status?: string[];
    }
  ): Promise<{
    projects: ProjectAggregate[];
    total: number;
  }>;
}
