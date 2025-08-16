/**
 * Authentication and authorization types
 * Platform-agnostic interfaces for auth functionality
 */

/**
 * Unified AuthenticatedUser interface
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  sessionId: string;
  workspaceId?: string;
  riskScore?: number;
  deviceId?: string;
  mfaEnabled?: boolean;
  emailVerified?: boolean;
}

/**
 * Security context for comprehensive security middleware
 */
export interface SecurityContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  endpoint: string;
  method: string;
  riskScore: number;
  deviceFingerprint?: string;
  geoLocation?: string;
  previousLogins: number;
  suspiciousActivity: boolean;
  rateLimitStatus: {
    remaining: number;
    reset: Date;
  };
}

/**
 * Workspace context
 */
export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  role: string;
  permissions: string[];
}

/**
 * Authentication context
 */
export interface AuthContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  requestPath: string;
  requestMethod: string;
  correlationId: string;
  loginTime?: Date;
  lastActivity?: Date;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  windowMs: number;
}

/**
 * Token payload interface
 */
export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  workspaceId?: string;
  sub: string;
  iat: number;
  exp: number;
}

/**
 * Audit context interface
 */
export interface AuditContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Access context for RBAC
 */
export interface AccessContext {
  userId: string;
  resource: string;
  action: string;
  resourceId?: string;
  workspaceId?: string;
}