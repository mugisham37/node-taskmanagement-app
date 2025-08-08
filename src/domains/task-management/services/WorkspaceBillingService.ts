import { Workspace, SubscriptionTier } from '../entities/Workspace';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface BillingInfo {
  subscriptionTier: SubscriptionTier;
  billingEmail?: string;
  nextBillingDate?: Date;
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  usage: WorkspaceUsage;
  limits: WorkspaceLimits;
}

export interface WorkspaceUsage {
  memberCount: number;
  projectCount: number;
  storageUsageGb: number;
  apiCallsThisMonth: number;
  activeUsers: number;
}

export interface WorkspaceLimits {
  memberLimit: number;
  projectLimit: number;
  storageLimitGb: number;
  apiCallLimit: number;
  features: string[];
}

export interface SubscriptionChangeRequest {
  newTier: SubscriptionTier;
  billingEmail?: string;
  prorationBehavior?: 'create_prorations' | 'none';
}

export interface UsageAlert {
  type: 'approaching_limit' | 'limit_exceeded' | 'overage';
  resource: 'members' | 'projects' | 'storage' | 'api_calls';
  currentUsage: number;
  limit: number;
  percentage: number;
  message: string;
}

// Domain Events
export class SubscriptionUpgradedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly oldTier: SubscriptionTier,
    public readonly newTier: SubscriptionTier,
    public readonly upgradedBy: UserId
  ) {
    super('SubscriptionUpgraded', {
      workspaceId: workspaceId.value,
      oldTier,
      newTier,
      upgradedBy: upgradedBy.value,
    });
  }
}

export class SubscriptionDowngradedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly oldTier: SubscriptionTier,
    public readonly newTier: SubscriptionTier,
    public readonly downgradedBy: UserId
  ) {
    super('SubscriptionDowngraded', {
      workspaceId: workspaceId.value,
      oldTier,
      newTier,
      downgradedBy: downgradedBy.value,
    });
  }
}

export class UsageLimitExceededEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly resource: string,
    public readonly currentUsage: number,
    public readonly limit: number
  ) {
    super('UsageLimitExceeded', {
      workspaceId: workspaceId.value,
      resource,
      currentUsage,
      limit,
    });
  }
}

export class WorkspaceBillingService {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  /**
   * Get billing information for workspace
   */
  async getBillingInfo(workspaceId: WorkspaceId): Promise<BillingInfo> {
    const workspace = await this.getWorkspace(workspaceId);
    const usage = await this.getWorkspaceUsage(workspaceId);
    const limits = this.getWorkspaceLimits(workspace.subscriptionTier);

    return {
      subscriptionTier: workspace.subscriptionTier,
      billingEmail: workspace.billingEmail,
      nextBillingDate: this.calculateNextBillingDate(workspace),
      subscriptionStatus: 'active', // In real implementation, this would come from payment provider
      currentPeriodStart: this.getCurrentPeriodStart(workspace),
      currentPeriodEnd: this.getCurrentPeriodEnd(workspace),
      usage,
      limits,
    };
  }

  /**
   * Change workspace subscription tier
   */
  async changeSubscription(
    workspaceId: WorkspaceId,
    userId: UserId,
    request: SubscriptionChangeRequest
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);

    // Verify user can change subscription (must be owner)
    if (!workspace.isOwner(userId)) {
      throw new Error('Only workspace owner can change subscription');
    }

    const oldTier = workspace.subscriptionTier;
    const newTier = request.newTier;

    // Validate subscription change
    await this.validateSubscriptionChange(workspace, newTier);

    // Update workspace subscription
    workspace.changeSubscriptionTier(newTier);

    if (request.billingEmail) {
      // Update billing email through workspace entity if needed
      // This would typically be handled by the workspace entity
    }

    await this.workspaceRepository.save(workspace);

    // Emit appropriate event
    if (this.isUpgrade(oldTier, newTier)) {
      console.log(
        new SubscriptionUpgradedEvent(workspaceId, oldTier, newTier, userId)
      );
    } else {
      console.log(
        new SubscriptionDowngradedEvent(workspaceId, oldTier, newTier, userId)
      );
    }

    // Handle subscription change side effects
    await this.handleSubscriptionChange(workspace, oldTier, newTier);
  }

  /**
   * Check if workspace is within usage limits
   */
  async checkUsageLimits(workspaceId: WorkspaceId): Promise<UsageAlert[]> {
    const billingInfo = await this.getBillingInfo(workspaceId);
    const alerts: UsageAlert[] = [];

    // Check member limit
    if (billingInfo.limits.memberLimit > 0) {
      const memberPercentage =
        (billingInfo.usage.memberCount / billingInfo.limits.memberLimit) * 100;

      if (memberPercentage >= 100) {
        alerts.push({
          type: 'limit_exceeded',
          resource: 'members',
          currentUsage: billingInfo.usage.memberCount,
          limit: billingInfo.limits.memberLimit,
          percentage: memberPercentage,
          message: `Member limit exceeded (${billingInfo.usage.memberCount}/${billingInfo.limits.memberLimit})`,
        });
      } else if (memberPercentage >= 80) {
        alerts.push({
          type: 'approaching_limit',
          resource: 'members',
          currentUsage: billingInfo.usage.memberCount,
          limit: billingInfo.limits.memberLimit,
          percentage: memberPercentage,
          message: `Approaching member limit (${billingInfo.usage.memberCount}/${billingInfo.limits.memberLimit})`,
        });
      }
    }

    // Check project limit
    if (billingInfo.limits.projectLimit > 0) {
      const projectPercentage =
        (billingInfo.usage.projectCount / billingInfo.limits.projectLimit) *
        100;

      if (projectPercentage >= 100) {
        alerts.push({
          type: 'limit_exceeded',
          resource: 'projects',
          currentUsage: billingInfo.usage.projectCount,
          limit: billingInfo.limits.projectLimit,
          percentage: projectPercentage,
          message: `Project limit exceeded (${billingInfo.usage.projectCount}/${billingInfo.limits.projectLimit})`,
        });
      } else if (projectPercentage >= 80) {
        alerts.push({
          type: 'approaching_limit',
          resource: 'projects',
          currentUsage: billingInfo.usage.projectCount,
          limit: billingInfo.limits.projectLimit,
          percentage: projectPercentage,
          message: `Approaching project limit (${billingInfo.usage.projectCount}/${billingInfo.limits.projectLimit})`,
        });
      }
    }

    // Check storage limit
    const storagePercentage =
      (billingInfo.usage.storageUsageGb / billingInfo.limits.storageLimitGb) *
      100;

    if (storagePercentage >= 100) {
      alerts.push({
        type: 'limit_exceeded',
        resource: 'storage',
        currentUsage: billingInfo.usage.storageUsageGb,
        limit: billingInfo.limits.storageLimitGb,
        percentage: storagePercentage,
        message: `Storage limit exceeded (${billingInfo.usage.storageUsageGb}GB/${billingInfo.limits.storageLimitGb}GB)`,
      });
    } else if (storagePercentage >= 80) {
      alerts.push({
        type: 'approaching_limit',
        resource: 'storage',
        currentUsage: billingInfo.usage.storageUsageGb,
        limit: billingInfo.limits.storageLimitGb,
        percentage: storagePercentage,
        message: `Approaching storage limit (${billingInfo.usage.storageUsageGb}GB/${billingInfo.limits.storageLimitGb}GB)`,
      });
    }

    return alerts;
  }

  /**
   * Get subscription tier recommendations based on usage
   */
  async getSubscriptionRecommendations(workspaceId: WorkspaceId): Promise<{
    currentTier: SubscriptionTier;
    recommendedTier?: SubscriptionTier;
    reason: string;
    potentialSavings?: number;
    additionalFeatures?: string[];
  }> {
    const billingInfo = await this.getBillingInfo(workspaceId);
    const alerts = await this.checkUsageLimits(workspaceId);

    // Check if upgrade is needed
    const hasLimitExceeded = alerts.some(
      alert => alert.type === 'limit_exceeded'
    );
    const hasApproachingLimit = alerts.some(
      alert => alert.type === 'approaching_limit'
    );

    if (hasLimitExceeded) {
      const nextTier = this.getNextTier(billingInfo.subscriptionTier);
      if (nextTier) {
        return {
          currentTier: billingInfo.subscriptionTier,
          recommendedTier: nextTier,
          reason:
            'Usage limits exceeded. Upgrade recommended to continue using all features.',
          additionalFeatures: this.getAdditionalFeatures(
            billingInfo.subscriptionTier,
            nextTier
          ),
        };
      }
    }

    if (hasApproachingLimit) {
      const nextTier = this.getNextTier(billingInfo.subscriptionTier);
      if (nextTier) {
        return {
          currentTier: billingInfo.subscriptionTier,
          recommendedTier: nextTier,
          reason:
            'Approaching usage limits. Consider upgrading to avoid service interruption.',
          additionalFeatures: this.getAdditionalFeatures(
            billingInfo.subscriptionTier,
            nextTier
          ),
        };
      }
    }

    // Check if downgrade is possible
    const canDowngrade = this.canDowngradeToTier(
      billingInfo.usage,
      SubscriptionTier.BASIC
    );
    if (
      billingInfo.subscriptionTier === SubscriptionTier.PROFESSIONAL &&
      canDowngrade
    ) {
      return {
        currentTier: billingInfo.subscriptionTier,
        recommendedTier: SubscriptionTier.BASIC,
        reason:
          'Current usage fits within a lower tier. Consider downgrading to save costs.',
        potentialSavings: this.calculatePotentialSavings(
          billingInfo.subscriptionTier,
          SubscriptionTier.BASIC
        ),
      };
    }

    return {
      currentTier: billingInfo.subscriptionTier,
      reason: 'Current subscription tier is appropriate for your usage.',
    };
  }

  /**
   * Calculate workspace usage
   */
  private async getWorkspaceUsage(
    workspaceId: WorkspaceId
  ): Promise<WorkspaceUsage> {
    // In a real implementation, these would be actual database queries
    const [memberCount, projectCount, storageUsageGb] = await Promise.all([
      this.workspaceRepository.getMemberCount(workspaceId),
      this.workspaceRepository.getProjectCount(workspaceId),
      this.workspaceRepository.getStorageUsage(workspaceId),
    ]);

    return {
      memberCount,
      projectCount,
      storageUsageGb,
      apiCallsThisMonth: 0, // Would be tracked separately
      activeUsers: memberCount, // Simplified for now
    };
  }

  /**
   * Get workspace limits based on subscription tier
   */
  private getWorkspaceLimits(tier: SubscriptionTier): WorkspaceLimits {
    const limits = {
      [SubscriptionTier.FREE]: {
        memberLimit: 5,
        projectLimit: 3,
        storageLimitGb: 1,
        apiCallLimit: 1000,
        features: ['basic_tasks', 'basic_projects'],
      },
      [SubscriptionTier.BASIC]: {
        memberLimit: 25,
        projectLimit: 10,
        storageLimitGb: 10,
        apiCallLimit: 10000,
        features: [
          'basic_tasks',
          'basic_projects',
          'time_tracking',
          'file_attachments',
        ],
      },
      [SubscriptionTier.PROFESSIONAL]: {
        memberLimit: 100,
        projectLimit: 50,
        storageLimitGb: 100,
        apiCallLimit: 50000,
        features: [
          'basic_tasks',
          'basic_projects',
          'time_tracking',
          'file_attachments',
          'advanced_analytics',
          'custom_fields',
        ],
      },
      [SubscriptionTier.ENTERPRISE]: {
        memberLimit: -1, // Unlimited
        projectLimit: -1, // Unlimited
        storageLimitGb: 1000,
        apiCallLimit: -1, // Unlimited
        features: [
          'basic_tasks',
          'basic_projects',
          'time_tracking',
          'file_attachments',
          'advanced_analytics',
          'custom_fields',
          'sso',
          'audit_logs',
          'api_access',
        ],
      },
    };

    return limits[tier];
  }

  /**
   * Validate subscription change
   */
  private async validateSubscriptionChange(
    workspace: Workspace,
    newTier: SubscriptionTier
  ): Promise<void> {
    const usage = await this.getWorkspaceUsage(workspace.id);
    const newLimits = this.getWorkspaceLimits(newTier);

    // Check if current usage exceeds new tier limits
    if (
      newLimits.memberLimit > 0 &&
      usage.memberCount > newLimits.memberLimit
    ) {
      throw new Error(
        `Cannot downgrade: Current member count (${usage.memberCount}) exceeds new tier limit (${newLimits.memberLimit})`
      );
    }

    if (
      newLimits.projectLimit > 0 &&
      usage.projectCount > newLimits.projectLimit
    ) {
      throw new Error(
        `Cannot downgrade: Current project count (${usage.projectCount}) exceeds new tier limit (${newLimits.projectLimit})`
      );
    }

    if (usage.storageUsageGb > newLimits.storageLimitGb) {
      throw new Error(
        `Cannot downgrade: Current storage usage (${usage.storageUsageGb}GB) exceeds new tier limit (${newLimits.storageLimitGb}GB)`
      );
    }
  }

  /**
   * Handle subscription change side effects
   */
  private async handleSubscriptionChange(
    workspace: Workspace,
    oldTier: SubscriptionTier,
    newTier: SubscriptionTier
  ): Promise<void> {
    // Handle feature enablement/disablement
    const oldFeatures = this.getWorkspaceLimits(oldTier).features;
    const newFeatures = this.getWorkspaceLimits(newTier).features;

    const removedFeatures = oldFeatures.filter(f => !newFeatures.includes(f));
    const addedFeatures = newFeatures.filter(f => !oldFeatures.includes(f));

    if (removedFeatures.length > 0) {
      // Handle feature removal (e.g., disable custom fields, remove advanced analytics)
      console.log(
        `Features removed for workspace ${workspace.id.value}:`,
        removedFeatures
      );
    }

    if (addedFeatures.length > 0) {
      // Handle feature addition (e.g., enable new features)
      console.log(
        `Features added for workspace ${workspace.id.value}:`,
        addedFeatures
      );
    }
  }

  /**
   * Helper methods
   */
  private async getWorkspace(workspaceId: WorkspaceId): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    return workspace;
  }

  private calculateNextBillingDate(workspace: Workspace): Date {
    // Simplified calculation - in reality this would come from payment provider
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  }

  private getCurrentPeriodStart(workspace: Workspace): Date {
    // Simplified - would come from payment provider
    const start = new Date();
    start.setDate(1); // First day of current month
    return start;
  }

  private getCurrentPeriodEnd(workspace: Workspace): Date {
    // Simplified - would come from payment provider
    const end = new Date();
    end.setMonth(end.getMonth() + 1, 0); // Last day of current month
    return end;
  }

  private isUpgrade(
    oldTier: SubscriptionTier,
    newTier: SubscriptionTier
  ): boolean {
    const tierOrder = [
      SubscriptionTier.FREE,
      SubscriptionTier.BASIC,
      SubscriptionTier.PROFESSIONAL,
      SubscriptionTier.ENTERPRISE,
    ];
    return tierOrder.indexOf(newTier) > tierOrder.indexOf(oldTier);
  }

  private getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
    const tierOrder = [
      SubscriptionTier.FREE,
      SubscriptionTier.BASIC,
      SubscriptionTier.PROFESSIONAL,
      SubscriptionTier.ENTERPRISE,
    ];
    const currentIndex = tierOrder.indexOf(currentTier);
    return currentIndex < tierOrder.length - 1
      ? tierOrder[currentIndex + 1]
      : null;
  }

  private getAdditionalFeatures(
    currentTier: SubscriptionTier,
    newTier: SubscriptionTier
  ): string[] {
    const currentFeatures = this.getWorkspaceLimits(currentTier).features;
    const newFeatures = this.getWorkspaceLimits(newTier).features;
    return newFeatures.filter(f => !currentFeatures.includes(f));
  }

  private canDowngradeToTier(
    usage: WorkspaceUsage,
    tier: SubscriptionTier
  ): boolean {
    const limits = this.getWorkspaceLimits(tier);

    return (
      (limits.memberLimit === -1 || usage.memberCount <= limits.memberLimit) &&
      (limits.projectLimit === -1 ||
        usage.projectCount <= limits.projectLimit) &&
      usage.storageUsageGb <= limits.storageLimitGb
    );
  }

  private calculatePotentialSavings(
    currentTier: SubscriptionTier,
    newTier: SubscriptionTier
  ): number {
    // Simplified pricing calculation
    const pricing = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.BASIC]: 10,
      [SubscriptionTier.PROFESSIONAL]: 25,
      [SubscriptionTier.ENTERPRISE]: 50,
    };

    return pricing[currentTier] - pricing[newTier];
  }
}
