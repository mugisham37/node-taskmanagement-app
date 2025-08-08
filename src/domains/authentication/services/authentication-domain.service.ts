import { UserAggregate } from '../aggregates/user.aggregate';
import { Email } from '../value-objects/email';
import { UserId } from '../value-objects/user-id';
import { IUserRepository } from '../repositories/user.repository.interface';

/**
 * Authentication Domain Service
 * Contains business logic that doesn't naturally fit within a single aggregate
 */
export class AuthenticationDomainService {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * Checks if a user can register with the given email
   */
  async canUserRegister(email: Email): Promise<boolean> {
    const existingUser = await this.userRepository.findByEmail(email);
    return !existingUser || existingUser.isDeleted;
  }

  /**
   * Determines if a user should be automatically verified based on email domain
   */
  shouldAutoVerifyEmail(email: Email): boolean {
    // Auto-verify corporate emails from trusted domains
    const trustedDomains = [
      'company.com', // Add your trusted domains here
    ];

    return trustedDomains.some(domain => email.isFromDomain(domain));
  }

  /**
   * Calculates risk score for a user based on various factors
   */
  async calculateUserRiskScore(user: UserAggregate): Promise<number> {
    let riskScore = 0;

    // Base risk factors
    if (user.email.isPersonalEmail()) {
      riskScore += 10;
    }

    if (user.failedLoginAttempts > 0) {
      riskScore += user.failedLoginAttempts * 5;
    }

    if (!user.emailVerified) {
      riskScore += 20;
    }

    if (!user.mfaEnabled) {
      riskScore += 15;
    }

    // Check for suspicious activity patterns
    if (user.isNewUser(1)) {
      // New user within 1 day
      riskScore += 25;
    }

    // Cap at 100
    return Math.min(riskScore, 100);
  }

  /**
   * Determines if MFA should be required for a user
   */
  shouldRequireMFA(user: UserAggregate): boolean {
    return user.hasHighRiskScore() || user.email.isCorporateEmail();
  }

  /**
   * Validates password strength
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters long');
    } else {
      score += 20;
    }

    if (password.length >= 12) {
      score += 10;
    }

    if (/[a-z]/.test(password)) {
      score += 10;
    } else {
      feedback.push('Password must contain lowercase letters');
    }

    if (/[A-Z]/.test(password)) {
      score += 10;
    } else {
      feedback.push('Password must contain uppercase letters');
    }

    if (/\d/.test(password)) {
      score += 10;
    } else {
      feedback.push('Password must contain numbers');
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
      score += 15;
    } else {
      feedback.push('Password must contain special characters');
    }

    // Check for common patterns
    if (/(.)\1{2,}/.test(password)) {
      score -= 10;
      feedback.push('Avoid repeating characters');
    }

    if (/123|abc|qwe/i.test(password)) {
      score -= 15;
      feedback.push('Avoid common sequences');
    }

    const isValid = score >= 60 && feedback.length === 0;

    return {
      isValid,
      score: Math.max(0, Math.min(100, score)),
      feedback,
    };
  }

  /**
   * Determines if a user account should be locked based on security policies
   */
  shouldLockAccount(user: UserAggregate): {
    shouldLock: boolean;
    reason?: string;
    durationMinutes?: number;
  } {
    // Already handled in aggregate for failed login attempts
    if (user.failedLoginAttempts >= 5) {
      return {
        shouldLock: true,
        reason: 'Too many failed login attempts',
        durationMinutes: 30,
      };
    }

    // Lock high-risk users without MFA
    if (user.hasHighRiskScore() && !user.mfaEnabled) {
      return {
        shouldLock: true,
        reason: 'High risk score without MFA',
        durationMinutes: 60,
      };
    }

    return { shouldLock: false };
  }

  /**
   * Generates secure backup codes for MFA
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-digit backup code
      const code = Math.random().toString().slice(2, 10);
      codes.push(code);
    }

    return codes;
  }

  /**
   * Validates if two users can be in the same workspace
   */
  async canUsersCollaborate(
    user1Id: UserId,
    user2Id: UserId
  ): Promise<boolean> {
    const [user1, user2] = await Promise.all([
      this.userRepository.findById(user1Id),
      this.userRepository.findById(user2Id),
    ]);

    if (!user1 || !user2) {
      return false;
    }

    // Both users must be verified and not deleted
    if (!user1.emailVerified || !user2.emailVerified) {
      return false;
    }

    if (user1.isDeleted || user2.isDeleted) {
      return false;
    }

    // Both users must not be locked
    if (user1.isLocked || user2.isLocked) {
      return false;
    }

    return true;
  }

  /**
   * Determines session timeout based on user risk profile
   */
  calculateSessionTimeout(user: UserAggregate): number {
    const baseTimeout = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (user.hasHighRiskScore()) {
      return baseTimeout / 4; // 6 hours for high-risk users
    }

    if (!user.mfaEnabled) {
      return baseTimeout / 2; // 12 hours without MFA
    }

    return baseTimeout; // 24 hours for secure users
  }
}
