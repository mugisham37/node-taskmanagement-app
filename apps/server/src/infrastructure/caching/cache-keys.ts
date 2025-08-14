/**
 * Cache key management utilities for consistent key generation
 */

export class CacheKeys {
  // User-related cache keys
  static user(userId: string): string {
    return `user:${userId}`;
  }

  static userByEmail(email: string): string {
    return `user:email:${email}`;
  }

  static userProjects(userId: string): string {
    return `user:${userId}:projects`;
  }

  static userTasks(userId: string): string {
    return `user:${userId}:tasks`;
  }

  static userWorkspaces(userId: string): string {
    return `user:${userId}:workspaces`;
  }

  // Task-related cache keys
  static task(taskId: string): string {
    return `task:${taskId}`;
  }

  static tasksByProject(projectId: string): string {
    return `project:${projectId}:tasks`;
  }

  static tasksByAssignee(assigneeId: string): string {
    return `user:${assigneeId}:assigned-tasks`;
  }

  static tasksByStatus(status: string): string {
    return `tasks:status:${status}`;
  }

  static tasksByPriority(priority: string): string {
    return `tasks:priority:${priority}`;
  }

  static taskDependencies(taskId: string): string {
    return `task:${taskId}:dependencies`;
  }

  static taskComments(taskId: string): string {
    return `task:${taskId}:comments`;
  }

  // Project-related cache keys
  static project(projectId: string): string {
    return `project:${projectId}`;
  }

  static projectMembers(projectId: string): string {
    return `project:${projectId}:members`;
  }

  static projectsByWorkspace(workspaceId: string): string {
    return `workspace:${workspaceId}:projects`;
  }

  static projectStats(projectId: string): string {
    return `project:${projectId}:stats`;
  }

  static projectTaskStats(projectId: string): string {
    return `project:${projectId}:task-stats`;
  }

  // Workspace-related cache keys
  static workspace(workspaceId: string): string {
    return `workspace:${workspaceId}`;
  }

  static workspaceMembers(workspaceId: string): string {
    return `workspace:${workspaceId}:members`;
  }

  static workspaceProjects(workspaceId: string): string {
    return `workspace:${workspaceId}:projects`;
  }

  static workspaceStats(workspaceId: string): string {
    return `workspace:${workspaceId}:stats`;
  }

  // Session and authentication cache keys
  static userSession(sessionId: string): string {
    return `session:${sessionId}`;
  }

  static userTokens(userId: string): string {
    return `user:${userId}:tokens`;
  }

  static refreshToken(tokenId: string): string {
    return `refresh-token:${tokenId}`;
  }

  static passwordResetToken(token: string): string {
    return `password-reset:${token}`;
  }

  // Rate limiting cache keys
  static rateLimitUser(userId: string, action: string): string {
    return `rate-limit:user:${userId}:${action}`;
  }

  static rateLimitIP(ip: string, action: string): string {
    return `rate-limit:ip:${ip}:${action}`;
  }

  static rateLimitGlobal(action: string): string {
    return `rate-limit:global:${action}`;
  }

  // Search and query cache keys
  static searchResults(query: string, filters: string): string {
    const filtersHash = Buffer.from(filters).toString('base64');
    return `search:${query}:${filtersHash}`;
  }

  static queryResults(queryHash: string): string {
    return `query:${queryHash}`;
  }

  // Notification cache keys
  static userNotifications(userId: string): string {
    return `user:${userId}:notifications`;
  }

  static unreadNotifications(userId: string): string {
    return `user:${userId}:unread-notifications`;
  }

  // Real-time presence cache keys
  static userPresence(userId: string): string {
    return `presence:${userId}`;
  }

  static projectPresence(projectId: string): string {
    return `project:${projectId}:presence`;
  }

  static workspacePresence(workspaceId: string): string {
    return `workspace:${workspaceId}:presence`;
  }

  // Analytics and metrics cache keys
  static dailyStats(date: string): string {
    return `stats:daily:${date}`;
  }

  static weeklyStats(week: string): string {
    return `stats:weekly:${week}`;
  }

  static monthlyStats(month: string): string {
    return `stats:monthly:${month}`;
  }

  static userActivityStats(userId: string, period: string): string {
    return `stats:user:${userId}:${period}`;
  }

  static projectActivityStats(projectId: string, period: string): string {
    return `stats:project:${projectId}:${period}`;
  }

  // Configuration cache keys
  static appConfig(): string {
    return 'config:app';
  }

  static featureFlags(): string {
    return 'config:feature-flags';
  }

  static userPreferences(userId: string): string {
    return `user:${userId}:preferences`;
  }

  // Health check cache keys
  static healthCheck(service: string): string {
    return `health:${service}`;
  }

  static systemStatus(): string {
    return 'system:status';
  }
}

/**
 * Cache tag constants for bulk invalidation
 */
export class CacheTags {
  static readonly USER = 'user';
  static readonly TASK = 'task';
  static readonly PROJECT = 'project';
  static readonly WORKSPACE = 'workspace';
  static readonly NOTIFICATION = 'notification';
  static readonly STATS = 'stats';
  static readonly CONFIG = 'config';
  static readonly SESSION = 'session';
  static readonly SEARCH = 'search';

  // Composite tags
  static userRelated(userId: string): string {
    return `user:${userId}`;
  }

  static projectRelated(projectId: string): string {
    return `project:${projectId}`;
  }

  static workspaceRelated(workspaceId: string): string {
    return `workspace:${workspaceId}`;
  }

  static taskRelated(taskId: string): string {
    return `task:${taskId}`;
  }
}

/**
 * Cache TTL constants (in seconds)
 */
export class CacheTTL {
  static readonly VERY_SHORT = 60; // 1 minute
  static readonly SHORT = 300; // 5 minutes
  static readonly MEDIUM = 1800; // 30 minutes
  static readonly LONG = 3600; // 1 hour
  static readonly VERY_LONG = 86400; // 24 hours
  static readonly WEEK = 604800; // 7 days

  // Specific TTLs for different data types
  static readonly USER_SESSION = this.LONG;
  static readonly USER_DATA = this.MEDIUM;
  static readonly TASK_DATA = this.MEDIUM;
  static readonly PROJECT_DATA = this.MEDIUM;
  static readonly WORKSPACE_DATA = this.MEDIUM;
  static readonly SEARCH_RESULTS = this.SHORT;
  static readonly STATS = this.LONG;
  static readonly CONFIG = this.VERY_LONG;
  static readonly PRESENCE = this.VERY_SHORT;
  static readonly NOTIFICATIONS = this.SHORT;
  static readonly RATE_LIMIT = this.SHORT;
}
