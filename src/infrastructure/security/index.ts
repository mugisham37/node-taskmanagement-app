/**
 * Consolidated Security Infrastructure
 * Single point of access for all security functionality
 */

// JWT Service
export { JwtService, createJwtService, getJwtService } from './jwt-service';
export type {
  JwtConfig,
  JwtPayload,
  TokenPair,
  TokenValidationResult,
} from './jwt-service';

// Password Service
export {
  PasswordService,
  createPasswordService,
  getPasswordService,
} from './password-service';
export type {
  PasswordConfig,
  PasswordValidationResult,
  PasswordHashResult,
} from './password-service';

// MFA Service
export { MfaService, createMfaService, getMfaService } from './mfa-service';
export type {
  MfaConfig,
  TotpSetupResult,
  MfaVerificationResult,
} from './mfa-service';

// Rate Limiter
export {
  RateLimiter,
  RateLimiterFactory,
  MemoryRateLimitStore,
  RedisRateLimitStore,
  authRateLimiter,
  apiRateLimiter,
  passwordResetRateLimiter,
} from './rate-limiter';
export type {
  RateLimitConfig,
  RateLimitInfo,
  RateLimitResult,
  IRateLimitStore,
  RateLimitRecord,
} from './rate-limiter';

// Security Monitoring
export {
  SecurityMonitor,
  createSecurityMonitor,
  getSecurityMonitor,
} from './security-monitor';
export type {
  SecurityEvent,
  SecurityThreat,
  SecurityMetrics,
  SecurityConfig,
} from './security-monitor';
