/**
 * Authentication Guards
 *
 * Provides guards for protecting routes and resources based on
 * authentication and authorization requirements
 */

import { InfrastructureError } from '@taskmanagement/core';

export interface GuardContext {
  userId?: string;
  email?: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  resource?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: string[];
  requiredRoles?: string[];
}

export abstract class AuthGuard {
  abstract readonly name: string;

  /**
   * Check if access should be granted
   */
  abstract canActivate(context: GuardContext): Promise<GuardResult> | GuardResult;

  /**
   * Get guard configuration
   */
  abstract getConfig(): Record<string, any>;
}

/**
 * Authentication Guard - Ensures user is authenticated
 */
export class AuthenticationGuard extends AuthGuard {
  readonly name = 'authentication';

  canActivate(context: GuardContext): GuardResult {
    if (!context.userId) {
      return {
        allowed: false,
        reason: 'Authentication required',
      };
    }

    return {
      allowed: true,
    };
  }

  getConfig(): Record<string, any> {
    return {
      name: this.name,
      type: 'authentication',
      description: 'Requires user to be authenticated',
    };
  }
}

/**
 * Role Guard - Ensures user has required roles
 */
export class RoleGuard extends AuthGuard {
  readonly name = 'role';

  constructor(private readonly requiredRoles: string[]) {
    super();
  }

  canActivate(context: GuardContext): GuardResult {
    if (!context.userId) {
      return {
        allowed: false,
        reason: 'Authentication required',
      };
    }

    const hasRequiredRole = this.requiredRoles.some(role =>
      context.roles.includes(role)
    );

    if (!hasRequiredRole) {
      return {
        allowed: false,
        reason: 'Insufficient role permissions',
        requiredRoles: this.requiredRoles,
      };
    }

    return {
      allowed: true,
    };
  }

  getConfig(): Record<string, any> {
    return {
      name: this.name,
      type: 'role',
      description: 'Requires user to have specific roles',
      requiredRoles: this.requiredRoles,
    };
  }
}

/**
 * Permission Guard - Ensures user has required permissions
 */
export class PermissionGuard extends AuthGuard {
  readonly name = 'permission';

  constructor(private readonly requiredPermissions: string[]) {
    super();
  }

  canActivate(context: GuardContext): GuardResult {
    if (!context.userId) {
      return {
        allowed: false,
        reason: 'Authentication required',
      };
    }

    const hasAllPermissions = this.requiredPermissions.every(permission =>
      context.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return {
        allowed: false,
        reason: 'Insufficient permissions',
        requiredPermissions: this.requiredPermissions,
      };
    }

    return {
      allowed: true,
    };
  }

  getConfig(): Record<string, any> {
    return {
      name: this.name,
      type: 'permission',
      description: 'Requires user to have specific permissions',
      requiredPermissions: this.requiredPermissions,
    };
  }
}

/**
 * Resource Guard - Ensures user can access specific resource
 */
export class ResourceGuard extends AuthGuard {
  readonly name = 'resource';

  constructor(
    private readonly rbacService: any, // RBACService
    private readonly resourceType: string,
    private readonly action: string
  ) {
    super();
  }

  async canActivate(context: GuardContext): Promise<GuardResult> {
    if (!context.userId) {
      return {
        allowed: false,
        reason: 'Authentication required',
      };
    }

    try {
      const hasAccess = await this.rbacService.hasPermission(
        context.userId,
        this.resourceType,
        this.action,
        {
          resourceId: context.resource,
          context: context.metadata,
        }
      );

      if (!hasAccess) {
        return {
          allowed: false,
          reason: `Access denied to ${this.action} ${this.resourceType}`,
        };
      }

      return {
        allowed: true,
      };
    } catch (error) {
      throw new InfrastructureError(
        `Resource guard check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  getConfig(): Record<string, any> {
    return {
      name: this.name,
      type: 'resource',
      description: 'Requires user to have access to specific resource',
      resourceType: this.resourceType,
      action: this.action,
    };
  }
}

/**
 * IP Whitelist Guard - Ensures request comes from allowed IP
 */
export class IpWhitelistGuard extends AuthGuard {
  readonly name = 'ip-whitelist';

  constructor(private readonly allowedIps: string[]) {
    super();
  }

  canActivate(context: GuardContext): GuardResult {
    if (!this.allowedIps.includes(context.ipAddress)) {
      return {
        allowed: false,
        reason: 'IP address not in whitelist',
      };
    }

    return {
      allowed: true,
    };
  }

  getConfig(): Record<string, any> {
    return {
      name: this.name,
      type: 'ip-whitelist',
      description: 'Requires request to come from whitelisted IP',
      allowedIps: this.allowedIps,
    };
  }
}

/**
 * Time-based Guard - Ensures access is within allowed time window
 */
export class TimeBasedGuard extends AuthGuard {
  readonly name = 'time-based';

  constructor(
    private readonly allowedHours: { start: number; end: number },
    private readonly timezone: string = 'UTC'
  ) {
    super();
  }

  canActivate(context: GuardContext): GuardResult {
    const now = new Date();
    const currentHour = now.getHours(); // Simplified - should use timezone

    if (
      currentHour < this.allowedHours.start ||
      currentHour > this.allowedHours.end
    ) {
      return {
        allowed: false,
        reason: `Access not allowed at this time (${currentHour}:00)`,
      };
    }

    return {
      allowed: true,
    };
  }

  getConfig(): Record<string, any> {
    return {
      name: this.name,
      type: 'time-based',
      description: 'Requires access within allowed time window',
      allowedHours: this.allowedHours,
      timezone: this.timezone,
    };
  }
}

/**
 * Rate Limit Guard - Ensures user hasn't exceeded rate limits
 */
export class RateLimitGuard extends AuthGuard {
  readonly name = 'rate-limit';

  constructor(
    private readonly rateLimitService: any, // RateLimitService
    private readonly limit: number,
    private readonly windowMs: number
  ) {
    super();
  }

  async canActivate(context: GuardContext): Promise<GuardResult> {
    try {
      const key = `guard-rate-limit:${context.userId || context.ipAddress}`;
      const result = await this.rateLimitService.checkLimit(key, this.limit, this.windowMs);

      if (!result.allowed) {
        return {
          allowed: false,
          reason: `Rate limit exceeded. Try again in ${Math.ceil(result.resetTime / 1000)} seconds`,
        };
      }

      return {
        allowed: true,
      };
    } catch (error) {
      throw new InfrastructureError(
        `Rate limit guard check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  getConfig(): Record<string, any> {
    return {
      name: this.name,
      type: 'rate-limit',
      description: 'Requires user to stay within rate limits',
      limit: this.limit,
      windowMs: this.windowMs,
    };
  }
}

/**
 * Composite Guard - Combines multiple guards with AND/OR logic
 */
export class CompositeGuard extends AuthGuard {
  readonly name = 'composite';

  constructor(
    private readonly guards: AuthGuard[],
    private readonly operator: 'AND' | 'OR' = 'AND'
  ) {
    super();
  }

  async canActivate(context: GuardContext): Promise<GuardResult> {
    const results: GuardResult[] = [];

    for (const guard of this.guards) {
      const result = await guard.canActivate(context);
      results.push(result);

      if (this.operator === 'AND' && !result.allowed) {
        // Short-circuit on first failure for AND
        return result;
      }

      if (this.operator === 'OR' && result.allowed) {
        // Short-circuit on first success for OR
        return result;
      }
    }

    if (this.operator === 'OR') {
      // All guards failed for OR
      return {
        allowed: false,
        reason: 'All guard conditions failed',
      };
    }

    // All guards passed for AND
    return {
      allowed: true,
    };
  }

  getConfig(): Record<string, any> {
    return {
      name: this.name,
      type: 'composite',
      description: `Combines multiple guards with ${this.operator} logic`,
      operator: this.operator,
      guards: this.guards.map(guard => guard.getConfig()),
    };
  }
}

/**
 * Guard Manager - Manages and executes guards
 */
export class GuardManager {
  private guards = new Map<string, AuthGuard>();

  /**
   * Register a guard
   */
  registerGuard(guard: AuthGuard): void {
    this.guards.set(guard.name, guard);
  }

  /**
   * Get guard by name
   */
  getGuard(name: string): AuthGuard | undefined {
    return this.guards.get(name);
  }

  /**
   * Execute multiple guards
   */
  async executeGuards(
    guardNames: string[],
    context: GuardContext,
    operator: 'AND' | 'OR' = 'AND'
  ): Promise<GuardResult> {
    const guards = guardNames
      .map(name => this.guards.get(name))
      .filter((guard): guard is AuthGuard => guard !== undefined);

    if (guards.length === 0) {
      return { allowed: true };
    }

    const compositeGuard = new CompositeGuard(guards, operator);
    return await compositeGuard.canActivate(context);
  }

  /**
   * Create a guard context from request data
   */
  createContext(data: {
    userId?: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
    sessionId?: string;
    ipAddress: string;
    userAgent: string;
    resource?: string;
    action?: string;
    metadata?: Record<string, any>;
  }): GuardContext {
    return {
      roles: [],
      permissions: [],
      ...data,
    };
  }

  /**
   * Get all registered guards configuration
   */
  getGuardsConfig(): Record<string, any> {
    const config: Record<string, any> = {};

    for (const [name, guard] of this.guards) {
      config[name] = guard.getConfig();
    }

    return config;
  }
}