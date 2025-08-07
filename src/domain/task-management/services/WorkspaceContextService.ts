import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import { WorkspaceService, WorkspaceContext } from './WorkspaceService';
import { WorkspacePermissionService } from './WorkspacePermissionService';

export interface UserWorkspaceContext {
  currentWorkspace?: WorkspaceContext;
  availableWorkspaces: WorkspaceContext[];
  lastSwitchedAt?: Date;
}

export interface WorkspaceSwitch {
  fromWorkspaceId?: WorkspaceId;
  toWorkspaceId: WorkspaceId;
  userId: UserId;
  switchedAt: Date;
  reason?: string;
}

export class WorkspaceContextService {
  private readonly contextCache = new Map<string, UserWorkspaceContext>();
  private readonly switchHistory = new Map<string, WorkspaceSwitch[]>();

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly permissionService: WorkspacePermissionService
  ) {}

  /**
   * Get user's current workspace context
   */
  async getUserContext(userId: UserId): Promise<UserWorkspaceContext> {
    const cacheKey = userId.value;

    // Check cache first
    if (this.contextCache.has(cacheKey)) {
      const cached = this.contextCache.get(cacheKey)!;
      // Return cached context if it's recent (within 5 minutes)
      if (
        cached.lastSwitchedAt &&
        Date.now() - cached.lastSwitchedAt.getTime() < 5 * 60 * 1000
      ) {
        return cached;
      }
    }

    // Load fresh context
    const context = await this.loadUserContext(userId);
    this.contextCache.set(cacheKey, context);

    return context;
  }

  /**
   * Switch user to a different workspace
   */
  async switchWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId,
    reason?: string
  ): Promise<WorkspaceContext> {
    // Get current context to track the switch
    const currentContext = await this.getUserContext(userId);
    const fromWorkspaceId = currentContext.currentWorkspace?.workspace.id;

    // Switch to new workspace
    const newContext = await this.workspaceService.switchWorkspaceContext(
      userId,
      workspaceId
    );

    // Record the switch
    const workspaceSwitch: WorkspaceSwitch = {
      fromWorkspaceId,
      toWorkspaceId: workspaceId,
      userId,
      switchedAt: new Date(),
      reason,
    };

    this.recordWorkspaceSwitch(userId, workspaceSwitch);

    // Update cached context
    const updatedContext: UserWorkspaceContext = {
      currentWorkspace: newContext,
      availableWorkspaces: currentContext.availableWorkspaces,
      lastSwitchedAt: new Date(),
    };

    this.contextCache.set(userId.value, updatedContext);

    return newContext;
  }

  /**
   * Get all workspaces available to user with their contexts
   */
  async getAvailableWorkspaces(userId: UserId): Promise<WorkspaceContext[]> {
    const workspaces = await this.workspaceService.getUserWorkspaces(userId);
    const contexts: WorkspaceContext[] = [];

    for (const workspace of workspaces) {
      try {
        const context = await this.workspaceService.switchWorkspaceContext(
          userId,
          workspace.id
        );
        contexts.push(context);
      } catch (error) {
        // Skip workspaces where user doesn't have access
        console.warn(
          `User ${userId.value} cannot access workspace ${workspace.id.value}:`,
          error
        );
      }
    }

    return contexts;
  }

  /**
   * Check if user can switch to workspace
   */
  async canSwitchToWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    try {
      return await this.permissionService.canAccessWorkspace(
        userId,
        workspaceId
      );
    } catch {
      return false;
    }
  }

  /**
   * Get workspace switch history for user
   */
  getWorkspaceSwitchHistory(
    userId: UserId,
    limit: number = 10
  ): WorkspaceSwitch[] {
    const history = this.switchHistory.get(userId.value) || [];
    return history
      .sort((a, b) => b.switchedAt.getTime() - a.switchedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get user's most frequently used workspaces
   */
  getMostUsedWorkspaces(
    userId: UserId,
    limit: number = 5
  ): { workspaceId: WorkspaceId; switchCount: number }[] {
    const history = this.switchHistory.get(userId.value) || [];
    const workspaceCounts = new Map<string, number>();

    // Count switches to each workspace
    for (const switchRecord of history) {
      const workspaceId = switchRecord.toWorkspaceId.value;
      workspaceCounts.set(
        workspaceId,
        (workspaceCounts.get(workspaceId) || 0) + 1
      );
    }

    // Sort by usage count and return top workspaces
    return Array.from(workspaceCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([workspaceId, count]) => ({
        workspaceId: WorkspaceId.fromString(workspaceId),
        switchCount: count,
      }));
  }

  /**
   * Clear user's workspace context cache
   */
  clearUserContextCache(userId: UserId): void {
    this.contextCache.delete(userId.value);
  }

  /**
   * Clear all context caches (useful for testing or memory management)
   */
  clearAllContextCaches(): void {
    this.contextCache.clear();
  }

  /**
   * Get workspace context without switching (read-only)
   */
  async getWorkspaceContext(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<WorkspaceContext> {
    return await this.workspaceService.switchWorkspaceContext(
      userId,
      workspaceId
    );
  }

  /**
   * Validate workspace context for user
   */
  async validateWorkspaceContext(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<{
    valid: boolean;
    reason?: string;
    context?: WorkspaceContext;
  }> {
    try {
      const context = await this.workspaceService.switchWorkspaceContext(
        userId,
        workspaceId
      );

      // Additional validation checks
      if (!context.workspace.isActive) {
        return {
          valid: false,
          reason: 'Workspace is not active',
        };
      }

      if (context.workspace.isDeleted()) {
        return {
          valid: false,
          reason: 'Workspace has been deleted',
        };
      }

      return {
        valid: true,
        context,
      };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get workspace context summary for user
   */
  async getContextSummary(userId: UserId): Promise<{
    currentWorkspace?: {
      id: string;
      name: string;
      role: string;
      permissions: string[];
    };
    totalWorkspaces: number;
    recentSwitches: number;
    mostUsedWorkspace?: {
      id: string;
      name: string;
      switchCount: number;
    };
  }> {
    const context = await this.getUserContext(userId);
    const switchHistory = this.getWorkspaceSwitchHistory(userId, 10);
    const mostUsed = this.getMostUsedWorkspaces(userId, 1);

    let mostUsedWorkspace;
    if (mostUsed.length > 0) {
      try {
        const workspace = await this.workspaceService.getWorkspaceById(
          mostUsed[0].workspaceId
        );
        mostUsedWorkspace = {
          id: workspace.id.value,
          name: workspace.name,
          switchCount: mostUsed[0].switchCount,
        };
      } catch {
        // Ignore if workspace is not accessible
      }
    }

    return {
      currentWorkspace: context.currentWorkspace
        ? {
            id: context.currentWorkspace.workspace.id.value,
            name: context.currentWorkspace.workspace.name,
            role: context.currentWorkspace.role.name,
            permissions: context.currentWorkspace.permissions,
          }
        : undefined,
      totalWorkspaces: context.availableWorkspaces.length,
      recentSwitches: switchHistory.length,
      mostUsedWorkspace,
    };
  }

  /**
   * Load user context from repositories
   */
  private async loadUserContext(userId: UserId): Promise<UserWorkspaceContext> {
    const availableWorkspaces = await this.getAvailableWorkspaces(userId);

    // Try to determine current workspace (could be from user preferences, last used, etc.)
    let currentWorkspace: WorkspaceContext | undefined;

    if (availableWorkspaces.length > 0) {
      // For now, use the first available workspace as current
      // In a real implementation, this would come from user preferences or session
      currentWorkspace = availableWorkspaces[0];
    }

    return {
      currentWorkspace,
      availableWorkspaces,
      lastSwitchedAt: new Date(),
    };
  }

  /**
   * Record workspace switch in history
   */
  private recordWorkspaceSwitch(
    userId: UserId,
    workspaceSwitch: WorkspaceSwitch
  ): void {
    const userKey = userId.value;
    const history = this.switchHistory.get(userKey) || [];

    history.push(workspaceSwitch);

    // Keep only last 100 switches per user
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    this.switchHistory.set(userKey, history);
  }
}
