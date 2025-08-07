import { FastifyRequest, FastifyReply } from 'fastify';
import { UserId } from '../domain/authentication/value-objects/UserId';
import { WorkspaceId } from '../domain/task-management/value-objects/WorkspaceId';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  workspaceId?: string;
  sessionId?: string;
  deviceId?: string;

  // Request information
  method: string;
  path: string;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;

  // Response information
  statusCode?: number;
  responseTime?: number;
  responseSize?: number;

  // Context information
  ipAddress?: string;
  userAgent?: string;
  referer?: string;

  // Security information
  riskScore?: number;
  authenticationMethod?: string;

  // Business context
  action: string;
  resource?: string;
  resourceId?: string;
  resourceType?: string;

  // Additional metadata
  metadata?: Record<string, any>;
  tags?: string[];

  // Data changes (for write operations)
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;

  // Error information
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export interface AuditConfig {
  // What to log
  logRequests: boolean;
  logResponses: boolean;
  logRequestBody: boolean;
  logResponseBody: boolean;
  logHeaders: boolean;
  logSensitiveData: boolean;

  // Filtering
  excludePaths?: string[];
  includePaths?: string[];
  excludeMethods?: string[];
  includeMethods?: string[];

  // Data sanitization
  sensitiveFields: string[];
  maxBodySize: number;
  maxResponseSize: number;

  // Storage
  batchSize: number;
  flushInterval: number;

  // Compliance
  retentionDays: number;
  encryptSensitiveData: boolean;
}

export interface AuditStorage {
  store(events: AuditEvent[]): Promise<void>;
  query(filters: AuditQueryFilters): Promise<AuditEvent[]>;
  count(filters: AuditQueryFilters): Promise<number>;
  cleanup(olderThan: Date): Promise<number>;
}

export interface AuditQueryFilters {
  userId?: string;
  workspaceId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  statusCode?: number;
  limit?: number;
  offset?: number;
}

/**
 * In-memory audit storage (for development/testing)
 * In production, use database or specialized audit logging service
 */
export class MemoryAuditStorage implements AuditStorage {
  private events: AuditEvent[] = [];

  async store(events: AuditEvent[]): Promise<void> {
    this.events.push(...events);

    // Keep only recent events to prevent memory issues
    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000);
    }
  }

  async query(filters: AuditQueryFilters): Promise<AuditEvent[]> {
    let filtered = this.events;

    if (filters.userId) {
      filtered = filtered.filter(e => e.userId === filters.userId);
    }

    if (filters.workspaceId) {
      filtered = filtered.filter(e => e.workspaceId === filters.workspaceId);
    }

    if (filters.action) {
      filtered = filtered.filter(e => e.action === filters.action);
    }

    if (filters.resource) {
      filtered = filtered.filter(e => e.resource === filters.resource);
    }

    if (filters.startDate) {
      filtered = filtered.filter(e => e.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      filtered = filtered.filter(e => e.timestamp <= filters.endDate!);
    }

    if (filters.ipAddress) {
      filtered = filtered.filter(e => e.ipAddress === filters.ipAddress);
    }

    if (filters.statusCode) {
      filtered = filtered.filter(e => e.statusCode === filters.statusCode);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;

    return filtered.slice(offset, offset + limit);
  }

  async count(filters: AuditQueryFilters): Promise<number> {
    const results = await this.query({
      ...filters,
      limit: undefined,
      offset: undefined,
    });
    return results.length;
  }

  async cleanup(olderThan: Date): Promise<number> {
    const initialCount = this.events.length;
    this.events = this.events.filter(e => e.timestamp > olderThan);
    return initialCount - this.events.length;
  }
}

/**
 * Comprehensive Audit Logging Middleware
 * Captures detailed audit trails for security event tracking and compliance
 */
export class ComprehensiveAuditMiddleware {
  private eventBuffer: AuditEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private readonly storage: AuditStorage,
    private readonly config: AuditConfig
  ) {
    this.startFlushTimer();
  }

  /**
   * Create audit logging middleware
   */
  createMiddleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();

      // Check if this request should be audited
      if (!this.shouldAudit(request)) {
        return;
      }

      // Capture request data
      const requestData = this.captureRequestData(request);

      // Hook into response to capture response data
      reply.addHook('onSend', async (request, reply, payload) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        try {
          const auditEvent = this.createAuditEvent(
            request,
            reply,
            requestData,
            responseTime,
            payload
          );

          await this.logEvent(auditEvent);
        } catch (error) {
          console.error('Audit logging failed:', error);
        }

        return payload;
      });
    };
  }

  /**
   * Log a custom audit event
   */
  async logCustomEvent(
    action: string,
    resource: string,
    resourceId: string,
    userId?: string,
    workspaceId?: string,
    metadata?: Record<string, any>,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Promise<void> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      userId,
      workspaceId,
      method: 'CUSTOM',
      path: `/${resource}/${resourceId}`,
      action,
      resource,
      resourceId,
      resourceType: resource,
      metadata,
      oldValues,
      newValues,
    };

    await this.logEvent(event);
  }

  /**
   * Log authentication event
   */
  async logAuthenticationEvent(
    action:
      | 'login'
      | 'logout'
      | 'login_failed'
      | 'mfa_required'
      | 'mfa_success'
      | 'mfa_failed',
    userId?: string,
    request?: FastifyRequest,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      userId,
      method: request?.method || 'AUTH',
      path: request?.url || '/auth',
      action: `auth_${action}`,
      resource: 'authentication',
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'],
      riskScore: (request as any)?.user?.riskScore,
      authenticationMethod: this.detectAuthMethod(request),
      metadata,
    };

    await this.logEvent(event);
  }

  /**
   * Log data access event
   */
  async logDataAccessEvent(
    action: 'read' | 'create' | 'update' | 'delete',
    resource: string,
    resourceId: string,
    userId: string,
    workspaceId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      userId,
      workspaceId,
      method: this.actionToMethod(action),
      path: `/${resource}/${resourceId}`,
      action: `${resource}_${action}`,
      resource,
      resourceId,
      resourceType: resource,
      oldValues: this.sanitizeData(oldValues),
      newValues: this.sanitizeData(newValues),
      metadata,
    };

    await this.logEvent(event);
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    eventType:
      | 'suspicious_activity'
      | 'rate_limit_exceeded'
      | 'unauthorized_access'
      | 'privilege_escalation',
    userId?: string,
    request?: FastifyRequest,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      userId,
      workspaceId: (request as any)?.workspaceContext?.workspaceId,
      sessionId: (request as any)?.user?.sessionId,
      method: request?.method || 'SECURITY',
      path: request?.url || '/security',
      action: `security_${eventType}`,
      resource: 'security',
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'],
      riskScore: (request as any)?.user?.riskScore,
      metadata,
      tags: ['security', 'alert'],
    };

    await this.logEvent(event);
  }

  /**
   * Query audit events
   */
  async queryEvents(filters: AuditQueryFilters): Promise<AuditEvent[]> {
    return this.storage.query(filters);
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(
    startDate: Date,
    endDate: Date,
    workspaceId?: string
  ): Promise<{
    totalEvents: number;
    eventsByAction: Record<string, number>;
    eventsByUser: Record<string, number>;
    eventsByResource: Record<string, number>;
    securityEvents: number;
    failedRequests: number;
  }> {
    const filters: AuditQueryFilters = {
      startDate,
      endDate,
      workspaceId,
      limit: 10000, // Get all events for stats
    };

    const events = await this.storage.query(filters);

    const stats = {
      totalEvents: events.length,
      eventsByAction: {} as Record<string, number>,
      eventsByUser: {} as Record<string, number>,
      eventsByResource: {} as Record<string, number>,
      securityEvents: 0,
      failedRequests: 0,
    };

    events.forEach(event => {
      // Count by action
      stats.eventsByAction[event.action] =
        (stats.eventsByAction[event.action] || 0) + 1;

      // Count by user
      if (event.userId) {
        stats.eventsByUser[event.userId] =
          (stats.eventsByUser[event.userId] || 0) + 1;
      }

      // Count by resource
      if (event.resource) {
        stats.eventsByResource[event.resource] =
          (stats.eventsByResource[event.resource] || 0) + 1;
      }

      // Count security events
      if (
        event.tags?.includes('security') ||
        event.action.startsWith('security_')
      ) {
        stats.securityEvents++;
      }

      // Count failed requests
      if (event.statusCode && event.statusCode >= 400) {
        stats.failedRequests++;
      }
    });

    return stats;
  }

  /**
   * Cleanup old audit events
   */
  async cleanup(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    return this.storage.cleanup(cutoffDate);
  }

  // Private methods

  private shouldAudit(request: FastifyRequest): boolean {
    const path = request.url;
    const method = request.method;

    // Check exclude patterns
    if (
      this.config.excludePaths?.some(pattern =>
        this.matchesPattern(path, pattern)
      )
    ) {
      return false;
    }

    if (this.config.excludeMethods?.includes(method)) {
      return false;
    }

    // Check include patterns (if specified, only these are included)
    if (
      this.config.includePaths &&
      !this.config.includePaths.some(pattern =>
        this.matchesPattern(path, pattern)
      )
    ) {
      return false;
    }

    if (
      this.config.includeMethods &&
      !this.config.includeMethods.includes(method)
    ) {
      return false;
    }

    return true;
  }

  private captureRequestData(request: FastifyRequest): any {
    const data: any = {
      method: request.method,
      path: request.url,
      query: request.query,
      headers: this.config.logHeaders
        ? this.sanitizeHeaders(request.headers)
        : undefined,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      referer: request.headers.referer,
    };

    // Capture request body if configured
    if (this.config.logRequestBody && request.body) {
      const bodySize = JSON.stringify(request.body).length;
      if (bodySize <= this.config.maxBodySize) {
        data.body = this.sanitizeData(request.body);
      } else {
        data.body = { _truncated: true, _size: bodySize };
      }
    }

    return data;
  }

  private createAuditEvent(
    request: FastifyRequest,
    reply: FastifyReply,
    requestData: any,
    responseTime: number,
    payload?: any
  ): AuditEvent {
    const user = (request as any).user;
    const workspaceContext = (request as any).workspaceContext;

    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      userId: user?.id,
      workspaceId: workspaceContext?.workspaceId,
      sessionId: user?.sessionId,
      deviceId: user?.deviceId,

      method: requestData.method,
      path: requestData.path,
      query: requestData.query,
      body: requestData.body,
      headers: requestData.headers,

      statusCode: reply.statusCode,
      responseTime,
      responseSize: payload ? Buffer.byteLength(payload.toString()) : undefined,

      ipAddress: requestData.ipAddress,
      userAgent: requestData.userAgent,
      referer: requestData.referer,

      riskScore: user?.riskScore,
      authenticationMethod: this.detectAuthMethod(request),

      action: this.determineAction(request, reply),
      resource: this.extractResource(requestData.path),
      resourceId: this.extractResourceId(requestData.path),
      resourceType: this.extractResourceType(requestData.path),

      metadata: {
        userRole: user?.role,
        workspaceName: workspaceContext?.workspaceName,
        permissions: user?.permissions,
      },
    };

    // Add response body if configured and not too large
    if (this.config.logResponseBody && payload) {
      const responseSize = Buffer.byteLength(payload.toString());
      if (responseSize <= this.config.maxResponseSize) {
        event.metadata = {
          ...event.metadata,
          responseBody: this.sanitizeData(JSON.parse(payload.toString())),
        };
      }
    }

    // Add error information for failed requests
    if (reply.statusCode >= 400) {
      event.error = {
        message: `HTTP ${reply.statusCode}`,
        code: reply.statusCode.toString(),
      };
      event.tags = ['error'];
    }

    // Add security tags for sensitive operations
    if (this.isSensitiveOperation(event)) {
      event.tags = [...(event.tags || []), 'sensitive'];
    }

    return event;
  }

  private async logEvent(event: AuditEvent): Promise<void> {
    this.eventBuffer.push(event);

    // Flush immediately for high-priority events
    if (this.isHighPriorityEvent(event)) {
      await this.flush();
    } else if (this.eventBuffer.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.storage.store(events);
    } catch (error) {
      console.error('Failed to store audit events:', error);
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...events);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flush();
    }, this.config.flushInterval);
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };

    this.config.sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private sanitizeHeaders(
    headers: Record<string, any>
  ): Record<string, string> {
    const sanitized = { ...headers };

    // Always redact authorization headers
    if (sanitized.authorization) {
      sanitized.authorization = '[REDACTED]';
    }

    if (sanitized.cookie) {
      sanitized.cookie = '[REDACTED]';
    }

    return sanitized;
  }

  private matchesPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/:\w+/g, '[^/]+');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  private detectAuthMethod(request?: FastifyRequest): string | undefined {
    if (!request) return undefined;

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return 'jwt';
    }

    if (request.cookies?.sessionToken) {
      return 'session';
    }

    return undefined;
  }

  private actionToMethod(action: string): string {
    switch (action) {
      case 'create':
        return 'POST';
      case 'read':
        return 'GET';
      case 'update':
        return 'PUT';
      case 'delete':
        return 'DELETE';
      default:
        return 'UNKNOWN';
    }
  }

  private determineAction(
    request: FastifyRequest,
    reply: FastifyReply
  ): string {
    const method = request.method.toLowerCase();
    const path = request.url;
    const resource = this.extractResource(path);

    // Map HTTP methods to actions
    const actionMap: Record<string, string> = {
      get: 'read',
      post: 'create',
      put: 'update',
      patch: 'update',
      delete: 'delete',
    };

    const baseAction = actionMap[method] || method;

    return resource ? `${resource}_${baseAction}` : baseAction;
  }

  private extractResource(path: string): string | undefined {
    // Extract resource from path like /api/v1/tasks/123 -> tasks
    const match = path.match(/\/api\/v\d+\/([^\/\?]+)/);
    return match ? match[1] : undefined;
  }

  private extractResourceId(path: string): string | undefined {
    // Extract ID from path like /api/v1/tasks/123 -> 123
    const match = path.match(/\/api\/v\d+\/[^\/]+\/([^\/\?]+)/);
    return match ? match[1] : undefined;
  }

  private extractResourceType(path: string): string | undefined {
    return this.extractResource(path);
  }

  private isSensitiveOperation(event: AuditEvent): boolean {
    const sensitiveActions = [
      'auth_login',
      'auth_logout',
      'user_create',
      'user_delete',
      'workspace_delete',
      'role_update',
      'permission_update',
    ];

    return (
      sensitiveActions.includes(event.action) ||
      event.path.includes('/admin/') ||
      event.statusCode === 401 ||
      event.statusCode === 403
    );
  }

  private isHighPriorityEvent(event: AuditEvent): boolean {
    return (
      event.tags?.includes('security') ||
      event.action.startsWith('security_') ||
      (event.statusCode && event.statusCode >= 500) ||
      (event.riskScore !== undefined && event.riskScore > 0.8)
    );
  }
}

/**
 * Factory function to create audit middleware with default configuration
 */
export function createAuditMiddleware(
  storage?: AuditStorage,
  customConfig?: Partial<AuditConfig>
): ComprehensiveAuditMiddleware {
  const defaultConfig: AuditConfig = {
    logRequests: true,
    logResponses: true,
    logRequestBody: true,
    logResponseBody: false,
    logHeaders: true,
    logSensitiveData: false,

    excludePaths: ['/health', '/metrics', '/favicon.ico', '/static/*'],

    sensitiveFields: [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'cookie',
      'ssn',
      'creditCard',
      'bankAccount',
    ],

    maxBodySize: 10000, // 10KB
    maxResponseSize: 10000, // 10KB

    batchSize: 100,
    flushInterval: 5000, // 5 seconds

    retentionDays: 90,
    encryptSensitiveData: true,
  };

  const config = { ...defaultConfig, ...customConfig };
  const auditStorage = storage || new MemoryAuditStorage();

  return new ComprehensiveAuditMiddleware(auditStorage, config);
}
