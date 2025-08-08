import { IRepository } from '../../shared/repositories/IRepository';
import { Workspace, SubscriptionTier } from '../entities/Workspace';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';

export interface IWorkspaceRepository
  extends IRepository<Workspace, WorkspaceId> {
  // Owner-specific queries
  findByOwner(ownerId: UserId): Promise<Workspace[]>;
  findActiveByOwner(ownerId: UserId): Promise<Workspace[]>;

  // Slug-based queries
  findBySlug(slug: string): Promise<Workspace | null>;
  isSlugAvailable(slug: string): Promise<boolean>;
  findSimilarSlugs(baseSlug: string): Promise<string[]>;

  // Subscription-based queries
  findBySubscriptionTier(tier: SubscriptionTier): Promise<Workspace[]>;
  findExpiredSubscriptions(): Promise<Workspace[]>;
  findTrialWorkspaces(): Promise<Workspace[]>;

  // Member-related queries
  findWorkspacesWithMember(userId: UserId): Promise<Workspace[]>;
  findWorkspacesNeedingMembers(): Promise<Workspace[]>;
  getMemberCount(workspaceId: WorkspaceId): Promise<number>;

  // Activity-based queries
  findActiveWorkspaces(daysThreshold: number): Promise<Workspace[]>;
  findInactiveWorkspaces(daysThreshold: number): Promise<Workspace[]>;
  findRecentlyCreated(days: number): Promise<Workspace[]>;

  // Status queries
  findActiveWorkspaces(): Promise<Workspace[]>;
  findDeactivatedWorkspaces(): Promise<Workspace[]>;
  findDeletedWorkspaces(): Promise<Workspace[]>;

  // Search and filtering
  searchWorkspaces(query: string): Promise<Workspace[]>;
  findByNamePattern(pattern: string): Promise<Workspace[]>;

  // Analytics queries
  getWorkspaceCountByTier(): Promise<Record<string, number>>;
  getTotalActiveMembers(): Promise<number>;
  getAverageWorkspaceSize(): Promise<number>;
  getWorkspaceGrowthRate(days: number): Promise<number>;

  // Storage and limits
  findWorkspacesNearStorageLimit(): Promise<Workspace[]>;
  findWorkspacesNearMemberLimit(): Promise<Workspace[]>;
  findWorkspacesNearProjectLimit(): Promise<Workspace[]>;
  getStorageUsage(workspaceId: WorkspaceId): Promise<number>;

  // Billing-related queries
  findWorkspacesForBilling(billingDate: Date): Promise<Workspace[]>;
  findWorkspacesWithOverduePayments(): Promise<Workspace[]>;
  findWorkspacesForUpgrade(): Promise<Workspace[]>;

  // Security queries
  findWorkspacesWithSecurityIssues(): Promise<Workspace[]>;
  findWorkspacesRequiringMFA(): Promise<Workspace[]>;
  findWorkspacesWithSuspiciousActivity(): Promise<Workspace[]>;

  // Bulk operations
  bulkUpdateSubscriptionTier(
    workspaceIds: WorkspaceId[],
    tier: SubscriptionTier
  ): Promise<void>;
  bulkDeactivate(workspaceIds: WorkspaceId[], reason: string): Promise<void>;
  bulkActivate(workspaceIds: WorkspaceId[]): Promise<void>;
  bulkUpdateSettings(workspaceIds: WorkspaceId[], settings: any): Promise<void>;

  // Soft delete operations
  softDelete(workspaceId: WorkspaceId): Promise<void>;
  restore(workspaceId: WorkspaceId): Promise<void>;
  permanentlyDelete(workspaceId: WorkspaceId): Promise<void>;

  // Health and metrics
  getWorkspaceHealth(workspaceId: WorkspaceId): Promise<{
    memberCount: number;
    projectCount: number;
    taskCount: number;
    storageUsage: number;
    lastActivity: Date;
    subscriptionStatus: string;
  }>;

  // Feature usage
  getFeatureUsage(workspaceId: WorkspaceId): Promise<Record<string, number>>;
  findWorkspacesUsingFeature(feature: string): Promise<Workspace[]>;

  // Compliance and audit
  findWorkspacesRequiringAudit(): Promise<Workspace[]>;
  getComplianceStatus(workspaceId: WorkspaceId): Promise<{
    dataRetentionCompliant: boolean;
    securityCompliant: boolean;
    privacyCompliant: boolean;
  }>;
}
