import { Workspace } from '../entities/Workspace';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';

export interface WorkspaceRepository {
  /**
   * Save a workspace entity
   */
  save(workspace: Workspace): Promise<void>;

  /**
   * Find workspace by ID
   */
  findById(id: WorkspaceId): Promise<Workspace | null>;

  /**
   * Find workspace by slug
   */
  findBySlug(slug: string): Promise<Workspace | null>;

  /**
   * Find all workspaces owned by a user
   */
  findByOwnerId(ownerId: UserId): Promise<Workspace[]>;

  /**
   * Find all workspaces where user is a member
   */
  findByMemberId(memberId: UserId): Promise<Workspace[]>;

  /**
   * Find all active workspaces
   */
  findAllActive(): Promise<Workspace[]>;

  /**
   * Check if workspace slug is available
   */
  isSlugAvailable(slug: string, excludeId?: WorkspaceId): Promise<boolean>;

  /**
   * Delete workspace (soft delete)
   */
  delete(id: WorkspaceId): Promise<void>;

  /**
   * Get workspace member count
   */
  getMemberCount(workspaceId: WorkspaceId): Promise<number>;

  /**
   * Get workspace project count
   */
  getProjectCount(workspaceId: WorkspaceId): Promise<number>;

  /**
   * Get workspace storage usage in GB
   */
  getStorageUsage(workspaceId: WorkspaceId): Promise<number>;

  /**
   * Find workspaces by subscription tier
   */
  findBySubscriptionTier(tier: string): Promise<Workspace[]>;
}
