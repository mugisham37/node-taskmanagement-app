import { Team } from '../entities/Team';
import { TeamId } from '../value-objects/TeamId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { ProjectId } from '../value-objects/ProjectId';
import { UserId } from '../../authentication/value-objects/UserId';

export interface TeamRepository {
  /**
   * Save a team entity
   */
  save(team: Team): Promise<void>;

  /**
   * Find team by ID
   */
  findById(id: TeamId): Promise<Team | null>;

  /**
   * Find teams by workspace
   */
  findByWorkspace(workspaceId: WorkspaceId): Promise<Team[]>;

  /**
   * Find teams by project
   */
  findByProject(projectId: ProjectId): Promise<Team[]>;

  /**
   * Find teams where user is a member
   */
  findByMember(userId: UserId): Promise<Team[]>;

  /**
   * Find teams where user is a lead
   */
  findByLead(userId: UserId): Promise<Team[]>;

  /**
   * Search teams by name or description
   */
  search(workspaceId: WorkspaceId, query: string): Promise<Team[]>;

  /**
   * Get team count for workspace
   */
  getTeamCount(workspaceId: WorkspaceId): Promise<number>;

  /**
   * Delete team
   */
  delete(id: TeamId): Promise<void>;

  /**
   * Check if team name is available in workspace
   */
  isNameAvailable(
    workspaceId: WorkspaceId,
    name: string,
    excludeId?: TeamId
  ): Promise<boolean>;

  /**
   * Get team statistics
   */
  getTeamStats(teamId: TeamId): Promise<{
    memberCount: number;
    taskCount: number;
    completedTaskCount: number;
    averageTaskCompletionTime: number; // in hours
    workloadDistribution: Record<string, number>; // userId -> task count
  }>;

  /**
   * Find teams with capacity for new tasks
   */
  findTeamsWithCapacity(
    workspaceId: WorkspaceId,
    maxTasksPerMember?: number
  ): Promise<Team[]>;
}
