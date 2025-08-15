/**
 * Security service interfaces
 */

/**
 * Base security service interface
 */
export interface SecurityService {
  readonly name: string;
  isHealthy(): Promise<boolean>;
  getHealthStatus(): Promise<Record<string, any>>;
}

/**
 * JWT service interface
 */
export interface JWTService extends SecurityService {
  generateTokenPair(payload: TokenPayload): TokenPair;
  verifyAccessToken(token: string): TokenPayload & JwtPayload;
  verifyRefreshToken(token: string): RefreshTokenPayload & JwtPayload;
  refreshAccessToken(refreshToken: string, newPayload: TokenPayload): string;
  generatePasswordResetToken(userId: string, email: string): string;
  verifyPasswordResetToken(token: string): { userId: string; email: string };
  generateEmailVerificationToken(userId: string, email: string): string;
  verifyEmailVerificationToken(token: string): { userId: string; email: string };
  isTokenExpired(token: string): boolean;
  getTokenExpiration(token: string): Date | null;
}

/**
 * JWT payload interfaces
 */
export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  tokenId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
}

/**
 * Password service interface
 */
export interface PasswordService extends SecurityService {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  checkPasswordStrength(password: string): PasswordStrength;
  validatePassword(password: string): { isValid: boolean; errors: string[] };
  generateSecurePassword(length?: number): string;
  needsRehashing(hash: string): Promise<boolean>;
}

/**
 * Password strength interface
 */
export interface PasswordStrength {
  score: number; // 0-100
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  feedback: string[];
  isValid: boolean;
}

/**
 * Encryption service interface
 */
export interface EncryptionService extends SecurityService {
  encrypt(data: string, key?: string): Promise<string>;
  decrypt(encryptedData: string, key?: string): Promise<string>;
  generateKey(): string;
  hash(data: string): string;
  compareHash(data: string, hash: string): boolean;
}

/**
 * Session management service interface
 */
export interface SessionService extends SecurityService {
  createSession(userId: string, metadata?: SessionMetadata): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  updateSession(sessionId: string, updates: Partial<Session>): Promise<boolean>;
  deleteSession(sessionId: string): Promise<boolean>;
  deleteUserSessions(userId: string): Promise<number>;
  isSessionValid(sessionId: string): Promise<boolean>;
  extendSession(sessionId: string, duration?: number): Promise<boolean>;
  getActiveSessions(userId: string): Promise<Session[]>;
}

/**
 * Session interface
 */
export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: SessionMetadata;
  isActive: boolean;
}

/**
 * Session metadata interface
 */
export interface SessionMetadata {
  deviceType?: string;
  location?: string;
  loginMethod?: string;
  [key: string]: any;
}

/**
 * Two-factor authentication service interface
 */
export interface TwoFactorAuthService extends SecurityService {
  generateSecret(userId: string): Promise<TwoFactorSecret>;
  verifyToken(userId: string, token: string): Promise<boolean>;
  generateBackupCodes(userId: string): Promise<string[]>;
  verifyBackupCode(userId: string, code: string): Promise<boolean>;
  disable(userId: string): Promise<boolean>;
  isEnabled(userId: string): Promise<boolean>;
}

/**
 * Two-factor authentication secret interface
 */
export interface TwoFactorSecret {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Input sanitization service interface
 */
export interface InputSanitizationService extends SecurityService {
  sanitizeHtml(input: string): string;
  sanitizeString(input: string): string;
  validateEmail(email: string): boolean;
  validateUrl(url: string): boolean;
  detectXSS(input: string): boolean;
  detectSQLInjection(input: string): boolean;
  sanitizeFilename(filename: string): string;
}

/**
 * Rate limiting service interface
 */
export interface RateLimitService extends SecurityService {
  checkLimit(
    identifier: string,
    action: string,
    limit: number,
    window: number
  ): Promise<RateLimitResult>;
  resetLimit(identifier: string, action: string): Promise<boolean>;
  getRemainingAttempts(
    identifier: string,
    action: string,
    limit: number,
    window: number
  ): Promise<number>;
}

/**
 * Rate limit result interface
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  totalHits: number;
}

/**
 * Audit logging service interface
 */
export interface AuditLoggingService extends SecurityService {
  logEvent(event: AuditEvent): void;
  logAuthenticationSuccess(context: AuditContext): void;
  logAuthenticationFailure(context: AuditContext, reason?: string): void;
  logAccessDenied(
    context: AuditContext,
    resource: string,
    action: string,
    reason?: string
  ): void;
  logSuspiciousActivity(
    context: AuditContext,
    activity: string,
    details?: Record<string, any>
  ): void;
  logDataAccess(
    context: AuditContext,
    resource: string,
    action: string,
    sensitive?: boolean
  ): void;
}

/**
 * Audit event interface
 */
export interface AuditEvent {
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  details?: Record<string, any>;
  timestamp: Date;
  requestId?: string;
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
 * RBAC (Role-Based Access Control) service interface
 */
export interface RBACService extends SecurityService {
  hasPermission(userId: string, permission: string): Promise<boolean>;
  hasRole(userId: string, role: string): Promise<boolean>;
  getUserRoles(userId: string): Promise<string[]>;
  getUserPermissions(userId: string): Promise<string[]>;
  assignRole(userId: string, role: string): Promise<boolean>;
  removeRole(userId: string, role: string): Promise<boolean>;
  createRole(role: string, permissions: string[]): Promise<boolean>;
  deleteRole(role: string): Promise<boolean>;
  getRolePermissions(role: string): Promise<string[]>;
}

/**
 * OAuth service interface
 */
export interface OAuthService extends SecurityService {
  generateAuthorizationUrl(
    provider: string,
    redirectUri: string,
    state?: string
  ): string;
  exchangeCodeForTokens(
    provider: string,
    code: string,
    redirectUri: string
  ): Promise<OAuthTokens>;
  getUserInfo(provider: string, accessToken: string): Promise<OAuthUserInfo>;
  refreshToken(provider: string, refreshToken: string): Promise<OAuthTokens>;
}

/**
 * OAuth tokens interface
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}

/**
 * OAuth user info interface
 */
export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified?: boolean;
  provider: string;
}

/**
 * API key service interface
 */
export interface APIKeyService extends SecurityService {
  generateAPIKey(userId: string, name: string, permissions?: string[]): Promise<APIKey>;
  validateAPIKey(key: string): Promise<APIKeyValidation | null>;
  revokeAPIKey(keyId: string): Promise<boolean>;
  getUserAPIKeys(userId: string): Promise<APIKey[]>;
  updateAPIKey(keyId: string, updates: Partial<APIKey>): Promise<boolean>;
}

/**
 * API key interface
 */
export interface APIKey {
  id: string;
  userId: string;
  name: string;
  key: string;
  permissions: string[];
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
}

/**
 * API key validation result interface
 */
export interface APIKeyValidation {
  valid: boolean;
  userId: string;
  permissions: string[];
  keyId: string;
}