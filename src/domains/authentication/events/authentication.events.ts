import { BaseDomainEvent } from '../../../shared/domain/domain-event';
import { UserId } from '../value-objects/user-id';
import { Email } from '../value-objects/email';
import { SessionId } from '../value-objects/session-id';

// User Authentication Events
export class UserLoginAttemptedEvent extends BaseDomainEvent {
  constructor(
    email: Email,
    success: boolean,
    ipAddress?: string,
    userAgent?: string
  ) {
    super(email.value, 'UserLoginAttempted', {
      email: email.value,
      success,
      ipAddress,
      userAgent,
    });
  }
}

export class UserLoggedInEvent extends BaseDomainEvent {
  constructor(
    userId: UserId,
    sessionId: SessionId,
    ipAddress?: string,
    userAgent?: string
  ) {
    super(userId.value, 'UserLoggedIn', {
      userId: userId.value,
      sessionId: sessionId.value,
      ipAddress,
      userAgent,
    });
  }
}

export class UserLoggedOutEvent extends BaseDomainEvent {
  constructor(
    userId: UserId,
    sessionId: SessionId,
    reason: 'manual' | 'expired' | 'revoked'
  ) {
    super(userId.value, 'UserLoggedOut', {
      userId: userId.value,
      sessionId: sessionId.value,
      reason,
    });
  }
}

export class UserPasswordChangedEvent extends BaseDomainEvent {
  constructor(userId: UserId, changedBy: 'user' | 'admin' | 'system') {
    super(userId.value, 'UserPasswordChanged', {
      userId: userId.value,
      changedBy,
    });
  }
}

export class UserPasswordResetRequestedEvent extends BaseDomainEvent {
  constructor(email: Email, resetToken: string, ipAddress?: string) {
    super(email.value, 'UserPasswordResetRequested', {
      email: email.value,
      resetToken,
      ipAddress,
    });
  }
}

export class UserPasswordResetCompletedEvent extends BaseDomainEvent {
  constructor(userId: UserId, resetToken: string) {
    super(userId.value, 'UserPasswordResetCompleted', {
      userId: userId.value,
      resetToken,
    });
  }
}

// MFA Events
export class UserMFASetupStartedEvent extends BaseDomainEvent {
  constructor(userId: UserId, method: 'totp' | 'sms' | 'email') {
    super(userId.value, 'UserMFASetupStarted', {
      userId: userId.value,
      method,
    });
  }
}

export class UserMFAVerificationAttemptedEvent extends BaseDomainEvent {
  constructor(
    userId: UserId,
    method: 'totp' | 'sms' | 'email' | 'backup_code',
    success: boolean
  ) {
    super(userId.value, 'UserMFAVerificationAttempted', {
      userId: userId.value,
      method,
      success,
    });
  }
}

export class UserMFABackupCodeUsedEvent extends BaseDomainEvent {
  constructor(userId: UserId, codeUsed: string, remainingCodes: number) {
    super(userId.value, 'UserMFABackupCodeUsed', {
      userId: userId.value,
      codeUsed,
      remainingCodes,
    });
  }
}

// Security Events
export class SuspiciousActivityDetectedEvent extends BaseDomainEvent {
  constructor(
    userId: UserId,
    activityType: string,
    details: Record<string, any>,
    riskScore: number
  ) {
    super(userId.value, 'SuspiciousActivityDetected', {
      userId: userId.value,
      activityType,
      details,
      riskScore,
    });
  }
}

export class UserRiskScoreUpdatedEvent extends BaseDomainEvent {
  constructor(
    userId: UserId,
    previousScore: number,
    newScore: number,
    reason: string
  ) {
    super(userId.value, 'UserRiskScoreUpdated', {
      userId: userId.value,
      previousScore,
      newScore,
      reason,
    });
  }
}

export class UserAccountCompromisedEvent extends BaseDomainEvent {
  constructor(userId: UserId, reason: string, evidence: Record<string, any>) {
    super(userId.value, 'UserAccountCompromised', {
      userId: userId.value,
      reason,
      evidence,
    });
  }
}

// Session Events
export class SessionSecurityViolationEvent extends BaseDomainEvent {
  constructor(
    sessionId: SessionId,
    userId: UserId,
    violationType: string,
    details: Record<string, any>
  ) {
    super(sessionId.value, 'SessionSecurityViolation', {
      sessionId: sessionId.value,
      userId: userId.value,
      violationType,
      details,
    });
  }
}

export class MultipleSessionsDetectedEvent extends BaseDomainEvent {
  constructor(userId: UserId, sessionCount: number, locations: string[]) {
    super(userId.value, 'MultipleSessionsDetected', {
      userId: userId.value,
      sessionCount,
      locations,
    });
  }
}

// Email Verification Events
export class EmailVerificationRequestedEvent extends BaseDomainEvent {
  constructor(userId: UserId, email: Email, verificationToken: string) {
    super(userId.value, 'EmailVerificationRequested', {
      userId: userId.value,
      email: email.value,
      verificationToken,
    });
  }
}

export class EmailVerificationFailedEvent extends BaseDomainEvent {
  constructor(email: Email, token: string, reason: string) {
    super(email.value, 'EmailVerificationFailed', {
      email: email.value,
      token,
      reason,
    });
  }
}
