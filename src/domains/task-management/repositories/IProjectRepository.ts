import { IRepository } from '../../shared/repositories/IRepository';
import { Project } from '../entities/Project';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import { ProjectStatus } from '../value-objects/ProjectStatus';
import { Priority } from '../value-objects/Priority';

export interface IProjectRepository extends IRepository<Project, ProjectId> {
  // Workspace-specific queries
  findByWorkspace(workspaceId: WorkspaceId): Promise<Project[]>;
  findByWorkspaceAndStatus(
    workspaceId: WorkspaceId,
    status: ProjectStatus
  ): Promise<Project[]>;
  findActiveProjects(workspaceId: WorkspaceId): Promise<Project[]>;
  findArchivedProjects(workspaceId: WorkspaceId): Promise<Project[]>;

  // Owner-specific queries
  findByOwner(ownerId: UserId): Promise<Project[]>;
  findByOwnerAndStatus(
    ownerId: UserId,
    status: ProjectStatus
  ): Promise<Project[]>;

  // Status and priority queries
  findByStatus(status: ProjectStatus): Promise<Project[]>;
  findByPriority(priority: Priority): Promise<Project[]>;
  findOverdueProjects(): Promise<Project[]>;
  findProjectsEndingThisWeek(): Promise<Project[]>;

  // Template queries
  findByTemplate(templateId: string): Promise<Project[]>;
  findProjectsWithoutTemplate(workspaceId: WorkspaceId): Promise<Project[]>;

  // Search and filtering
  searchProjects(workspaceId: WorkspaceId, query: string): Promise<Project[]>;
  findByDateRange(
    workspaceId: WorkspaceId,
    startDate: Date,
    endDate: Date
  ): Promise<Project[]>;
  findByBudgetRange(
    workspaceId: WorkspaceId,
    minBudget: number,
    maxBudget: number
  ): Promise<Project[]>;

  // Analytics queries
  getProjectCountByStatus(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>>;
  getProjectCountByPriority(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>>;
  getTotalBudgetByStatus(
    workspaceId: WorkspaceId
  ): Promise<Record<string, number>>;
  getAverageProjectDuration(workspaceId: WorkspaceId): Promise<number>;
  getProjectCompletionRate(workspaceId: WorkspaceId): Promise<number>;

  // Member-related queries
  findProjectsWithMember(userId: UserId): Promise<Project[]>;
  findProjectsNeedingMembers(workspaceId: WorkspaceId): Promise<Project[]>;

  // Bulk operations
  bulkUpdateStatus(
    projectIds: ProjectId[],
    status: ProjectStatus
  ): Promise<void>;
  bulkUpdatePriority(
    projectIds: ProjectId[],
    priority: Priority
  ): Promise<void>;
  bulkArchive(projectIds: ProjectId[], archivedBy: UserId): Promise<void>;
  bulkUnarchive(projectIds: ProjectId[]): Promise<void>;

  // Archive operations
  archive(
    projectId: ProjectId,
    archivedBy: UserId,
    reason?: string
  ): Promise<void>;
  unarchive(projectId: ProjectId): Promise<void>;
  findArchivedByUser(archivedBy: UserId): Promise<Project[]>;

  // Soft delete operations
  softDelete(projectId: ProjectId): Promise<void>;
  restore(projectId: ProjectId): Promise<void>;
  findDeleted(workspaceId: WorkspaceId): Promise<Project[]>;
  permanentlyDelete(projectId: ProjectId): Promise<void>;

  // Health and metrics
  getProjectHealth(projectId: ProjectId): Promise<{
    taskCompletionRate: number;
    overdueTaskCount: number;
    memberCount: number;
    budgetUtilization: number;
  }>;

  // Timeline queries
  findProjectsStartingThisMonth(workspaceId: WorkspaceId): Promise<Project[]>;
  findProjectsEndingThisMonth(workspaceId: WorkspaceId): Promise<Project[]>;
  findProjectsInTimeframe(
    workspaceId: WorkspaceId,
    startDate: Date,
    endDate: Date
  ): Promise<Project[]>;
}
